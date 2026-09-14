import {randomBytes,createHash,createHmac,timingSafeEqual} from 'node:crypto';
export const SESSION_COOKIE='__Host-g45c-session',TICKET_COOKIE='__Host-g45c-action',CSRF_COOKIE='__Host-g45c-entry';
export const token=()=>randomBytes(32).toString('base64url');
export const hash=value=>createHash('sha256').update(String(value)).digest('hex');
export const equal=(a,b)=>timingSafeEqual(Buffer.from(hash(a),'hex'),Buffer.from(hash(b),'hex'));
export const cookie=(name,value,seconds)=>`${name}=${value}; Path=/; Max-Age=${seconds}; HttpOnly; Secure; SameSite=Strict`;
export class BridgeError extends Error {constructor(status,code){super(code);this.status=status;this.code=code;}}
export function requireValue(value,status,code){if(!value)throw new BridgeError(status,code);}
export function cookies(header='') {
  const result=Object.create(null);
  for(const part of header.split(';')) {const match=/^\s*([^=;\s]+)=([^;]*)\s*$/.exec(part);if(!match)continue;
    requireValue(!Object.hasOwn(result,match[1]),400,'DUPLICATE_COOKIE');result[match[1]]=match[2].trim();}
  return result;
}
export function form(body,expected) {
  requireValue(typeof body==='string' && Buffer.byteLength(body)<=2048,400,'INVALID_FORM');
  const data=new URLSearchParams(body);
  requireValue(JSON.stringify([...data.keys()].sort())===JSON.stringify([...expected].sort()),400,'UNEXPECTED_INPUT');
  return Object.fromEntries(data);
}
/** Shared durable access coordination, not Admissible authority or evidence. */
export class JudgeSessions {
  constructor({codeSha256,store,clock=Date.now,ttlSeconds=7200}) {
    requireValue(/^[a-f0-9]{64}$/.test(codeSha256) && store,500,'SESSION_CONFIGURATION_REQUIRED');
    requireValue(Number.isInteger(ttlSeconds) && ttlSeconds>=60 && ttlSeconds<=7200,500,'INVALID_SESSION_LIFETIME');
    this.codeSha256=codeSha256;this.store=store;this.clock=clock;this.ttlSeconds=ttlSeconds;
  }
  mac(value){return createHmac('sha256',this.codeSha256).update(JSON.stringify(value)).digest('hex');}
  live(session){requireValue(session && session.kind==='session' && session.expires>this.clock(),401,'SESSION_REQUIRED_OR_EXPIRED');return session;}
  async lookup(raw){if(typeof raw!=='string' || !/^[A-Za-z0-9_-]{43}$/.test(raw))return null;
    const row=await this.store.get('session#'+hash(raw));return row && row.expires>this.clock()?row:null;}
  async authenticate(values){const session=this.live(await this.lookup(values[SESSION_COOKIE]));
    requireValue(typeof values[TICKET_COOKIE]==='string' && equal(hash(values[TICKET_COOKIE]),session.ticket_hash),403,'ACTION_TICKET_REQUIRED');return session;}
  async put(before,after){this.live(before);this.live(after);
    const next={...after,revision:before.revision+1};
    requireValue(await this.store.cas(before.key,before.revision,next),409,'SESSION_CONTEXT_CHANGED');return next;}
  async limit(kind,source,max,windowMs) {
    const now=this.clock(),window=Math.floor(now/windowMs),key='rate#'+this.mac([kind,source,window]);
    for(let i=0;i<10;i++){
      const row=await this.store.get(key),count=row?.count??0;requireValue(count<max,429,'RATE_LIMITED');
      const next={key,kind:'rate',revision:(row?.revision??0)+1,expires:(window+1)*windowMs,count:count+1};
      if(await this.store.cas(key,row?.revision??null,next))return;
    }throw new BridgeError(429,'RATE_LIMITED');
  }
  async entry(source){await this.limit('entry',source,60,300_000);const raw=token(),key='entry#'+hash(raw);
    requireValue(await this.store.cas(key,null,{key,kind:'entry',revision:1,expires:this.clock()+300_000,used:false}),503,'ENTRY_UNAVAILABLE');
    return cookie(CSRF_COOKIE,raw,300);}
  async entryExists(raw){if(!raw)return false;const row=await this.store.get('entry#'+hash(raw));return !!row && !row.used && row.expires>this.clock();}
  async login(code,entryToken,source){
    await this.limit('code-ip',source,20,300_000);
    const key='entry#'+hash(entryToken??''),entry=await this.store.get(key);
    requireValue(entry && !entry.used && entry.expires>this.clock(),403,'ENTRY_CONTEXT_REQUIRED');
    requireValue(await this.store.cas(key,entry.revision,{...entry,used:true,revision:entry.revision+1}),403,'ENTRY_CONTEXT_REQUIRED');
    requireValue(timingSafeEqual(Buffer.from(hash(code),'hex'),Buffer.from(this.codeSha256,'hex')),401,'CODE_NOT_ACCEPTED');
    // Every successful code entry creates an independent session. GET never does.
    const raw=token(),ticket=token(),sessionKey='session#'+hash(raw);
    const session={key:sessionKey,kind:'session',revision:1,expires:this.clock()+this.ttlSeconds*1000,
      run:null,generation:0,view_generation:0,view_context:null,ticket_hash:hash(ticket),created:0,action:null};
    requireValue(await this.store.cas(sessionKey,null,session),503,'SESSION_CREATION_UNCONFIRMED');
    return {session,setCookies:[cookie(SESSION_COOKIE,raw,this.ttlSeconds),cookie(TICKET_COOKIE,ticket,this.ttlSeconds),cookie(CSRF_COOKIE,'',0)]};
  }
  context(session,signature){return this.mac(['context',session.key,session.generation,signature]);}
  viewId(session){return this.mac(['view',session.key,session.generation,session.view_generation,session.view_context]);}
  binding(session,action,cardDigest){return this.mac(['binding',session.key,session.run,session.generation,action,cardDigest??null]);}
  actionTag(session,requestId,action){return this.mac(['action',session.key,requestId,action]);}
  async bindView(session,signature){this.live(session);if(session.action)return session;
    const context=this.context(session,signature);if(session.view_context===context)return session;
    return this.put(session,{...session,view_generation:session.view_generation+1,view_context:context});}
  checkView(session,id){this.live(session);requireValue(equal(id,this.viewId(session)),409,'STALE_VIEW_CONTEXT');}
  async claim(session,action,binding){this.live(session);requireValue(!session.action,409,'ACTION_IN_PROGRESS');
    if(action==='CREATE')requireValue(session.created<4,429,'FRESH_RUN_LIMIT');
    const requestId='g45c-'+token(),owner=hash(token());
    return this.put(session,{...session,created:session.created+(action==='CREATE'?1:0),action:{
      tag:this.actionTag(session,requestId,action),request_id:requestId,binding,
      phase:action==='CREATE'?'CREATE':'SUBMIT',lease_owner:owner,lease_until:this.clock()+45_000,attempts:1}});}
  async reclaim(session){this.live(session);requireValue(session.action && session.action.lease_until<=this.clock(),409,'ACTION_IN_PROGRESS');
    requireValue(session.action.attempts<8,409,'RECONCILIATION_LIMIT');
    return this.put(session,{...session,action:{...session.action,lease_owner:hash(token()),lease_until:this.clock()+45_000,attempts:session.action.attempts+1}});}
  async owned(session){const latest=this.live(await this.store.get(session.key));
    requireValue(latest.action && latest.action.lease_owner===session.action?.lease_owner && latest.action.lease_until>this.clock(),409,'ACTION_LEASE_LOST');return latest;}
  async finish(session){const current=await this.owned(session);return this.put(current,{...current,action:null,view_context:null,view_generation:current.view_generation+1});}
  async uncertain(session){const current=await this.owned(session);return this.put(current,{...current,action:{...current.action,lease_until:0}});}
}
