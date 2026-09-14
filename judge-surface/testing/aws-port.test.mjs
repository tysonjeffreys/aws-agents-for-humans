import test from 'node:test';
import assert from 'node:assert/strict';
import {execFileSync} from 'node:child_process';
import {AwsDemoPort,signPost} from '../bridge/aws-port.mjs';
const credentials={accessKeyId:'AKIDEXAMPLE',secretAccessKey:'example-secret-not-real',sessionToken:'example-session-not-real'};
const readUrl='https://read.lambda-url.us-west-2.on.aws/',adminUrl='https://admin.lambda-url.us-west-2.on.aws/';
test('SigV4 matches the independent AWS botocore implementation on exact decision request',() => {
  const python = process.env.G45C_TEST_PYTHON;
  assert.ok(python,'Set G45C_TEST_PYTHON to the existing qualified boto3 environment');
  const url=adminUrl+'demo/admin/runs/demo-20260910-'+ '1'.repeat(32)+'/decision';
  const body=JSON.stringify({decision:'APPROVE_CANDIDATE'}),extra={'idempotency-key':'g45c-test-request-0001','x-decision-card-digest':'a'.repeat(64)};
  const signed=signPost(url,body,extra,credentials,new Date('2026-09-10T12:34:56Z'));
  const script=`import json,sys,datetime\nimport botocore.auth\nfrom botocore.awsrequest import AWSRequest\nfrom botocore.credentials import Credentials\ndata=json.load(sys.stdin)\nbotocore.auth.get_current_datetime=lambda:datetime.datetime(2026,9,10,12,34,56)\nheaders=data['headers']\nheaders.pop('authorization',None)\nr=AWSRequest(method='POST',url=data['url'],data=data['body'],headers=headers)\nbotocore.auth.SigV4Auth(Credentials('AKIDEXAMPLE','example-secret-not-real','example-session-not-real'),'lambda','us-west-2').add_auth(r)\nprint(r.headers['Authorization'])\n`;
  const expected=execFileSync(python,['-c',script],{input:JSON.stringify({url,body,headers:signed}),encoding:'utf8'}).trim();
  assert.equal(signed.authorization,expected);
});
test('AWS port signs only bounded actions, no redirects/retries/credentials returned',async () => {
  const calls=[];
  const port=new AwsDemoPort({readUrl,adminUrl,credentials:async()=>credentials,fetcher:async(url,options)=>{
    calls.push({url,options});return {status:202,text:async()=>'{"operation":{"status":"QUEUED"}}',headers:new Headers()};
  }});
  const id='demo-20260910-'+ '1'.repeat(32);
  const result=await port.admin('REJECT_CANDIDATE',id,'g45c-test-request-0001','a'.repeat(64));
  assert.deepEqual(JSON.parse(calls[0].options.body),{decision:'REJECT_CANDIDATE'});
  assert.equal(calls[0].options.redirect,'error'); assert.equal(calls.length,1);
  assert.doesNotMatch(JSON.stringify(result),/AKID|example-secret|example-session/);
  for(const [action,run,digest] of [['PAYMENT',id,null],['CREATE',id,null],['APPROVE_CANDIDATE',id,null],['START','other',null]])
    await assert.rejects(()=>port.admin(action,run,'g45c-test-request-0001',digest));
  assert.equal(calls.length,1);
  assert.throws(()=>new AwsDemoPort({readUrl,adminUrl:'https://evil.example/',credentials:async()=>credentials}));
});
