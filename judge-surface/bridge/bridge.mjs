import {JudgeSessions,BridgeError,requireValue,cookies,form,equal,SESSION_COOKIE,CSRF_COOKIE} from './security.mjs';
import {RUN_PATTERN,ADMIN_ROUTES} from './aws-port.mjs';
export const CASE_PATH='/demo/vendor-payment-exception';
export const SECURITY_HEADERS=Object.freeze({'cache-control':'no-store','x-content-type-options':'nosniff',
  'referrer-policy':'no-referrer','permissions-policy':'camera=(), microphone=(), geolocation=()',
  'content-security-policy':"default-src 'self'; script-src 'self'; style-src 'self'; font-src 'self'; img-src 'self'; connect-src 'self'; base-uri 'none'; form-action 'self'; frame-ancestors 'none'"});
const response=(status,body,extra={},setCookies=[])=>({status,headers:{...SECURITY_HEADERS,'content-type':'application/json',...extra},body:JSON.stringify(body),cookies:setCookies});
const redirect=(setCookies=[])=>response(303,{status:'CHECK_SERVER_STATE'},{location:CASE_PATH},setCookies);
const reason=value=>typeof value==='string' && /^[A-Z][A-Z0-9_]{0,100}$/.test(value)?value:'BACKEND_OUTCOME_UNCONFIRMED';
const actionsFor=p=>[...p.available_actions.human,...p.available_actions.demo].filter(a=>Object.hasOwn(ADMIN_ROUTES,a));
const decision=a=>['APPROVE_CANDIDATE','REJECT_CANDIDATE'].includes(a);
const failureStatus=status=>status>=400 && status<500?status:503;
export const viewSignature=b=>b?JSON.stringify({run:b.projection.demo_run_id,state:b.projection.business_state,
  experience:b.projection.experience_state,overlay:b.projection.proof_overlay,reason:b.projection.reason_code,
  actions:b.projection.available_actions,card:b.projection.decision_card,digest:b.audit?.technical?.decision_card_digest??null}):'NO_ACTIVE_RUN';
/** Fixed browser action bridge. Session storage is coordination, never authority. */
export class JudgeBridge {
  constructor({origin,port,codeSha256,store,clock=Date.now,ttlSeconds=7200,assets}) {
    const url=new URL(origin);
    requireValue(url.origin===origin && (url.protocol==='https:' || (url.protocol==='http:' && ['127.0.0.1','localhost'].includes(url.hostname))),500,'EXACT_ORIGIN_REQUIRED');
    this.origin=origin;this.port=port;this.assets=assets;
    this.sessions=new JudgeSessions({codeSha256,store,clock,ttlSeconds});
  }
  async bundle(id){const [projection,audit,timeline]=await Promise.all([this.port.read(id),this.port.read(id,'audit'),this.port.read(id,'timeline')]);return {projection,audit,timeline};}
  async view(request,url,values,attempt=0) {
    const publicRun=url.searchParams.get('run'),recorded=url.searchParams.get('recorded')==='1';
    requireValue([...url.searchParams.keys()].every(k=>['run','recorded'].includes(k)) && url.searchParams.size<=1 &&
      (!url.searchParams.has('run') || RUN_PATTERN.test(publicRun)) && (!url.searchParams.has('recorded') || recorded),400,'INVALID_VIEW_SELECTOR');
    // Explicit public evidence does not depend on the availability of session storage.
    let session=publicRun || recorded?null:await this.sessions.lookup(values[SESSION_COOKIE]);
    const bundle=publicRun?await this.bundle(publicRun):recorded?{recorded:await this.port.recorded()}:session?.run?await this.bundle(session.run):null;
    const ui={authenticated:!!session,interactive:!!session,view_id:null,notice:null,session_expires_at:session?new Date(session.expires).toISOString():null,
      can_start_fresh:false,pending:false,actions:[],public_run_link:session?.run?`${CASE_PATH}?run=${session.run}`:null};
    const setCookies=[];
    if(session){
      try{session=await this.sessions.bindView(session,viewSignature(bundle));}
      catch(error){if(error.code==='SESSION_CONTEXT_CHANGED' && attempt<3)return this.view(request,url,values,attempt+1);throw error;}
      ui.view_id=this.sessions.viewId(session); // Non-secret display revision; action credential stays HttpOnly.
      if(session.action){
        const canReconcile=session.action.lease_until<=this.sessions.clock() && session.action.attempts<8;
        ui.actions=canReconcile?['RECONCILE']:[];ui.pending=true;ui.notice='SUBMISSION_OUTCOME_UNCONFIRMED';
      }else{
        ui.actions=bundle?actionsFor(bundle.projection):[];ui.can_start_fresh=session.created<4;
        ui.pending=!!bundle && /QUEUED|WORKING|PREPARING|CHECKING/.test(`${bundle.projection.reason_code} ${bundle.projection.proof_overlay}`);
      }
    }else if(!publicRun && !recorded && !(await this.sessions.entryExists(values[CSRF_COOKIE])))setCookies.push(await this.sessions.entry(request.source));
    return response(200,{bundle,ui},{},setCookies);
  }
  originalAction(session){const matches=['CREATE',...Object.keys(ADMIN_ROUTES)].filter(a=>equal(this.sessions.actionTag(session,session.action.request_id,a),session.action.tag));
    requireValue(matches.length===1,503,'INVALID_ACTION_COORDINATION');return matches[0];}
  async perform(claimed) {
    let session=await this.sessions.owned(claimed),action=this.originalAction(session);
    if(session.action.phase==='CREATE'){
      requireValue(action==='CREATE' && equal(session.action.binding,this.sessions.binding(session,'CREATE',null)),409,'ACTION_BINDING_CHANGED');
      const result=await this.port.admin('CREATE',null,session.action.request_id,null);
      requireValue(result.status===201,failureStatus(result.status),reason(result.body?.reason_code));
      requireValue(RUN_PATTERN.test(result.body.demo_run_id) && result.body.evidence_context==='LIVE_DEMO_RUN',503,'CREATION_OUTCOME_UNCONFIRMED');
      session=await this.sessions.owned(session);
      const next={...session,run:result.body.demo_run_id,generation:session.generation+1,view_generation:session.view_generation+1,view_context:null};
      next.action={...session.action,phase:'START',binding:this.sessions.binding(next,'START',null),lease_until:this.sessions.clock()+45_000};
      // Atomic active-run switch only AFTER definitive creation/reconciliation.
      session=await this.sessions.put(session,next);
    }
    let cardDigest=null,downstream=action,requestId=session.action.request_id;
    if(session.action.phase==='START'){downstream='START';requestId+='-start';}
    else if(decision(action)){const current=await this.bundle(session.run);cardDigest=current.audit.technical.decision_card_digest;}
    session=await this.sessions.owned(session);
    requireValue(equal(session.action.binding,this.sessions.binding(session,downstream,cardDigest)),409,'ACTION_BINDING_CHANGED');
    const result=await this.port.admin(downstream,session.run,requestId,cardDigest);
    requireValue(result.status===202,failureStatus(result.status),reason(result.body?.reason_code));
    await this.sessions.finish(session);
    return response(202,{status:'ACCEPTED_CHECK_SERVER_STATE'});
  }
  async act(values,body) {
    let session=await this.sessions.authenticate(values);
    const {action,view_id}=form(body,['action','view_id']);
    requireValue(['CREATE','RECONCILE',...Object.keys(ADMIN_ROUTES)].includes(action),400,'INVALID_ACTION');
    await this.sessions.limit('actions',session.key,40,60_000);
    this.sessions.checkView(session,view_id);
    let claimed=null;
    try{
      if(session.action){
        requireValue(action==='RECONCILE' || action===this.originalAction(session),409,'ACTION_IN_PROGRESS');
        claimed=await this.sessions.reclaim(session);
      }else{
        requireValue(action!=='RECONCILE',409,'NO_PENDING_ACTION');
        const current=session.run?await this.bundle(session.run):null;
        requireValue(equal(session.view_context,this.sessions.context(session,viewSignature(current))),409,'STALE_VIEW_CONTEXT');
        requireValue(action==='CREATE' || (current && actionsFor(current.projection).includes(action)),409,'ACTION_NOT_AVAILABLE');
        const cardDigest=decision(action)?current.audit.technical.decision_card_digest:null;
        claimed=await this.sessions.claim(session,action,this.sessions.binding(session,action,cardDigest));
      }
      return await this.perform(claimed);
    }catch(error){
      if(claimed){try{if(error instanceof BridgeError && error.status<500)await this.sessions.finish(claimed);else await this.sessions.uncertain(claimed);}catch{/* Stored action remains fenced; retry must acquire its persisted identity. */}}
      return response(error instanceof BridgeError?error.status:503,{reason_code:error instanceof BridgeError?error.code:'SUBMISSION_OUTCOME_UNCONFIRMED'});
    }
  }
  async handle(request) {
    let headers;
    try{
      headers=Object.fromEntries(Object.entries(request.headers??{}).map(([k,v])=>[k.toLowerCase(),v]));
      requireValue(headers.host===new URL(this.origin).host,403,'HOST_NOT_ALLOWED');
      const url=new URL(request.path,this.origin);requireValue(url.origin===this.origin && !url.hash,400,'INVALID_PATH');
      const values=cookies(headers.cookie),method=request.method;
      if(method==='POST'){
        requireValue(headers.origin===this.origin && (!headers['sec-fetch-site'] || headers['sec-fetch-site']==='same-origin'),403,'ORIGIN_NOT_ALLOWED');
        requireValue(!url.search,400,'NO_MUTATION_QUERY');
        requireValue((headers['content-type']??'').split(';')[0]==='application/x-www-form-urlencoded',415,'FORM_REQUIRED');
        if(url.pathname==='/session'){const input=form(request.body,['code']);const login=await this.sessions.login(input.code,values[CSRF_COOKIE],request.source);return redirect(login.setCookies);}
        if(url.pathname==='/action')return await this.act(values,request.body);
        throw new BridgeError(404,'ROUTE_NOT_FOUND');
      }
      requireValue(method==='GET' || method==='HEAD',405,'METHOD_NOT_ALLOWED');
      if(url.pathname==='/api/view')return await this.view(request,url,values);
      if(url.pathname==='/health' && !url.search)return response(200,{service:'g45c-judge-surface',reachable:true});
      if(url.pathname==='/' && !url.search)return redirect();
      if(url.pathname===CASE_PATH || url.pathname.startsWith('/assets/')){
        const file=await this.assets(url.pathname===CASE_PATH?'/index.html':url.pathname);requireValue(file,404,'ROUTE_NOT_FOUND');
        // Native same-origin form POSTs need a non-opaque Origin; do not relax POST validation.
        return {status:200,headers:{...SECURITY_HEADERS,...(url.pathname===CASE_PATH?{'referrer-policy':'same-origin'}:{}),'content-type':file.type},body:file.body,cookies:[]};
      }
      throw new BridgeError(404,'ROUTE_NOT_FOUND');
    }catch(error){
      const status=error instanceof BridgeError?error.status:503,code=error instanceof BridgeError?error.code:'SERVICE_UNAVAILABLE';
      if(request.path==='/session' && headers?.accept?.includes('text/html'))return {status,headers:{...SECURITY_HEADERS,'content-type':'text/html'},cookies:[],
        body:`<!doctype html><html lang="en"><meta name="viewport" content="width=device-width"><link rel="stylesheet" href="/assets/theme.css"><link rel="stylesheet" href="/assets/surface.css"><title>Demo access — Admissible</title><main class="shell"><h1>Demo access could not be confirmed</h1><p>${status===429?'Please wait before trying again.':'Check the shared demo code and try again.'}</p><a class="button" href="${CASE_PATH}">Return to demo</a></main></html>`};
      return response(status,{reason_code:code});
    }
  }
}
