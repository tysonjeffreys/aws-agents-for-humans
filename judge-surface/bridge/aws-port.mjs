import { createHmac, createHash } from 'node:crypto';
import { requireValue, BridgeError } from './security.mjs';
const sha = value => createHash('sha256').update(value).digest('hex');
const hmac = (key,value) => createHmac('sha256',key).update(value).digest();
export const RUN_PATTERN = /^demo-[0-9]{8}-[a-f0-9]{32}$/;
export const ADMIN_ROUTES = Object.freeze({ START:'start', ADVANCE_SYNTHETIC_VERIFICATION:'advance-verification',
  APPROVE_CANDIDATE:'decision', REJECT_CANDIDATE:'decision', SHOW_ENFORCEMENT_PROOF:'show-enforcement-proof',
  EXECUTE_APPROVED_CHANGE:'execute-approved-change', VERIFY_SINGLE_USE_PROTECTION:'verify-replay' });
function endpoint(base,transport = 'FUNCTION_URL') {
  const url = new URL(base);
  const host = transport === 'HTTP_API' ? /^[a-z0-9]{10}\.execute-api\.us-west-2\.amazonaws\.com$/ :
    /^[a-z0-9]+\.lambda-url\.us-west-2\.on\.aws$/;
  requireValue(['FUNCTION_URL','HTTP_API'].includes(transport) && url.protocol === 'https:' && host.test(url.hostname) &&
    url.pathname === '/' && !url.search && !url.hash && !url.username && !url.password && !url.port,500,'INVALID_BACKEND_URL');
  return url.origin;
}
/** Server-only SigV4, fixed service/region/URLs. Credentials never enter return values. */
export function signPost(url,body,headers,credentials,now = new Date(),service = 'lambda') {
  const target = new URL(url);
  requireValue(credentials.accessKeyId && credentials.secretAccessKey && credentials.sessionToken,503,'MACHINE_CREDENTIALS_UNAVAILABLE');
  const stamp = now.toISOString().replace(/[:-]|\.\d{3}/g,''), day = stamp.slice(0,8);
  requireValue(['lambda','dynamodb','execute-api'].includes(service),500,'INVALID_SIGNING_SERVICE');
  const signed = {...headers,host:target.host,'content-type':headers['content-type'] ?? 'application/json','x-amz-date':stamp,
    'x-amz-security-token':credentials.sessionToken,'x-amz-content-sha256':sha(body)};
  const names = Object.keys(signed).sort();
  const canonicalHeaders = names.map(key => `${key}:${String(signed[key]).trim().replace(/\s+/g,' ')}\n`).join('');
  const request = ['POST',target.pathname,'',canonicalHeaders,names.join(';'),sha(body)].join('\n');
  const scope = `${day}/us-west-2/${service}/aws4_request`;
  const key = hmac(hmac(hmac(hmac('AWS4'+credentials.secretAccessKey,day),'us-west-2'),service),'aws4_request');
  const signature = hmac(key,`AWS4-HMAC-SHA256\n${stamp}\n${scope}\n${sha(request)}`).toString('hex');
  signed.authorization = `AWS4-HMAC-SHA256 Credential=${credentials.accessKeyId}/${scope}, SignedHeaders=${names.join(';')}, Signature=${signature}`;
  return signed;
}
export class AwsDemoPort {
  constructor({readUrl,adminUrl,adminTransport = 'FUNCTION_URL',credentials,fetcher = fetch,clock = () => new Date()}) {
    this.readBase = endpoint(readUrl); this.adminBase = endpoint(adminUrl,adminTransport);
    this.adminService = adminTransport === 'HTTP_API' ? 'execute-api' : 'lambda';
    requireValue(this.readBase !== this.adminBase,500,'SEPARATE_ENDPOINTS_REQUIRED');
    this.credentials = credentials; this.fetcher = fetcher; this.clock = clock;
  }
  async request(url,options) {
    try {
      const response = await this.fetcher(url,{...options,redirect:'error',signal:AbortSignal.timeout(35_000)});
      const raw = await response.text();
      requireValue(Buffer.byteLength(raw) <= 1_048_576,503,'BACKEND_RESPONSE_LIMIT');
      return {status:response.status,body:JSON.parse(raw),requestId:response.headers.get('x-amzn-requestid') ?? response.headers.get('apigw-requestid')};
    } catch { throw new BridgeError(503,'BACKEND_OUTCOME_UNCONFIRMED'); }
  }
  async read(id,part = '') {
    requireValue(RUN_PATTERN.test(id) && ['', 'audit','timeline'].includes(part),400,'INVALID_READ');
    const result = await this.request(`${this.readBase}/demo/runs/${id}${part ? '/'+part : ''}`,{method:'GET'});
    requireValue(result.status === 200 && result.body.evidence_context === 'LIVE_DEMO_RUN' && result.body.demo_run_id === id,503,'RUN_READ_UNCONFIRMED');
    return result.body;
  }
  async recorded() {
    const result = await this.request(`${this.readBase}/demo/recorded-proof/g4`,{method:'GET'});
    requireValue(result.status === 200 && result.body.evidence_context === 'RECORDED_G4_PROOF' && !result.body.demo_run_id,503,'RECORDED_PROOF_UNAVAILABLE');
    return result.body;
  }
  async admin(action,id,requestToken,cardDigest) {
    requireValue(action === 'CREATE' || Object.hasOwn(ADMIN_ROUTES,action),400,'INVALID_ACTION');
    requireValue(action === 'CREATE' ? id === null : RUN_PATTERN.test(id),400,'INVALID_RUN_BINDING');
    requireValue(/^[A-Za-z0-9_-]{16,128}$/.test(requestToken),400,'INVALID_REQUEST_IDENTITY');
    const decision = ['APPROVE_CANDIDATE','REJECT_CANDIDATE'].includes(action);
    requireValue(!decision || /^[a-f0-9]{64}$/.test(cardDigest ?? ''),409,'EXACT_CARD_REQUIRED');
    const path = action === 'CREATE' ? '/demo/admin/runs' : `/demo/admin/runs/${id}/${ADMIN_ROUTES[action]}`;
    const body = JSON.stringify(decision ? {decision:action} : {});
    const extra = {'idempotency-key':requestToken,...(decision ? {'x-decision-card-digest':cardDigest} : {})};
    return this.request(this.adminBase+path,{method:'POST',body,headers:signPost(this.adminBase+path,body,extra,await this.credentials(),this.clock(),this.adminService)});
  }
  /** One fixed transport control: missing required idempotency key fails before any store call. */
  async qualifyHttpApi() {
    requireValue(this.adminService === 'execute-api',500,'HTTP_API_REQUIRED');
    const url=this.adminBase+'/demo/admin/runs',body='{}';
    const result=await this.request(url,{method:'POST',body,headers:signPost(url,body,{},await this.credentials(),this.clock(),'execute-api')});
    return {schema:'G45C_HTTP_API_CONTROL_V1',http_status:result.status,reason_code:result.body?.reason_code??null,
      message:typeof result.body?.message==='string'?result.body.message.slice(0,512):null,request_id:result.requestId,
      target_host:new URL(url).host,method:'POST',path:'/demo/admin/runs',signing_service:'execute-api',region:'us-west-2',
      idempotency_key_present:false,payload_sha256:sha(body),session_writes:false,business_effect:'NONE',
      pass:result.status===400 && result.body?.reason_code==='IDEMPOTENCY_KEY_REQUIRED'};
  }
}
