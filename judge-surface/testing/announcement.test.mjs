import test from 'node:test';
import assert from 'node:assert/strict';
import {readFileSync} from 'node:fs';
import {runInNewContext} from 'node:vm';
import {escape,AccessPanel,RecordedProofBadge,AuditDrawer} from '../public/components.mjs';
const source=readFileSync(new URL('../public/app.mjs',import.meta.url),'utf8');
async function harness() {
  const nodes={app:{innerHTML:''},announcement:{textContent:''},'transport-message':{innerHTML:''}},calls=[],panels=[];
  let view={bundle:null,ui:{interactive:true,view_id:'opaque-current-view',notice:null,pending:false}},post=null;
  const api=runInNewContext(source.replace(/^import .*;\n/,'')+'\n;({refresh,act})',{
    document:{getElementById:id=>nodes[id]??null,querySelectorAll:()=>[]},location:{search:''},URLSearchParams,
    AdmissibleDemoShell:()=>'',AccessPanel:(...args)=>{panels.push(args);return '';},escape,setTimeout:()=>1,clearTimeout:()=>{},
    fetch:async(url,options)=>{calls.push({url,options});if(url==='/action')return post?await post():{ok:true};
      return {ok:true,json:async()=>structuredClone(view)};}
  });
  await new Promise(resolve=>setImmediate(resolve));
  return {api,nodes,calls,panels,setView:v=>{view={...view,ui:{...view.ui,...v}};},setBundle:bundle=>{view={...view,bundle};},setPost:p=>{post=p;}};
}
test('completed submission clears live-region Submitting while preserving the bounded request envelope',async()=>{
  const h=await harness();await h.api.act('CREATE','opaque-current-view');
  assert.equal(h.nodes.announcement.textContent,'');
  const calls=h.calls.filter(c=>c.url==='/action');assert.equal(calls.length,1);
  assert.equal(calls[0].options.body.toString(),'action=CREATE&view_id=opaque-current-view');
});
test('server uncertainty notice remains announced; clearing it follows a changed server view only',async()=>{
  const h=await harness();h.setView({pending:true,notice:'SUBMISSION_OUTCOME_UNCONFIRMED'});
  await h.api.act('CREATE','opaque-current-view');
  assert.match(h.nodes.announcement.textContent,/outcome is not yet confirmed/);
  h.setView({pending:false,notice:null,view_id:'new-display-view'});await h.api.refresh();
  assert.equal(h.nodes.announcement.textContent,'');
});
test('failed or stale action preserves its error announcement and never repeats the action',async()=>{
  for(const outcome of [()=>{throw Error('transport');},()=>({ok:false,json:async()=>({reason_code:'STALE_VIEW_CONTEXT'})})]){
    const h=await harness();h.setPost(outcome);await h.api.act('CREATE','old-view');
    assert.match(h.nodes.announcement.textContent,/not yet confirmed|changed since this page/);
    await h.api.refresh();assert.notEqual(h.nodes.announcement.textContent,'');
    assert.equal(h.calls.filter(c=>c.url==='/action').length,1);
  }
});
test('unrelated refresh cannot clear the live-region while a submission is actually in flight',async()=>{
  const h=await harness();let finish;h.setPost(()=>new Promise(resolve=>{finish=resolve;}));
  const submitted=h.api.act('CREATE','opaque-current-view');
  h.setView({view_id:'refresh-during-request'});await h.api.refresh();
  assert.equal(h.nodes.announcement.textContent,'Submitting the selected action…');
  finish({ok:true});await submitted;assert.equal(h.nodes.announcement.textContent,'');
});
test('no-case access screens omit the empty state refresh but retain entry and recovery controls',()=>{
  for(const authenticated of [false,true]){
    const html=AccessPanel({authenticated,can_start_fresh:true},false);
    assert.match(html,/Recorded execution proof/);
    assert.doesNotMatch(html,/Recorded G4 proof|id="refresh-state"|Check case state/);
    assert.match(html,authenticated ? /data-action="CREATE"/ : /<form method="post" action="\/session"/);
  }
  const pending=AccessPanel({authenticated:true,can_start_fresh:false,actions:['RECONCILE']},false);
  assert.match(pending,/data-action="RECONCILE">Check submitted action/);
  assert.doesNotMatch(pending,/data-action="CREATE"/);
});
test('recorded footer has a return to the interactive demo but no self-link',()=>{
  const recorded=AccessPanel({interactive:false},true,true);
  assert.match(recorded,/href="\/demo\/vendor-payment-exception">Interactive demo/);
  assert.doesNotMatch(recorded,/recorded=1|Recorded execution proof|data-action/);
  const live=AccessPanel({interactive:false},true,false);
  assert.match(live,/recorded=1">Recorded execution proof/);
});
test('recorded display copy retains archive disclosure without internal phase wording',()=>{
  const recorded={source:{},technical:{},observed_at_note:'Archived sample'};
  const before=JSON.stringify(recorded);
  const html=RecordedProofBadge(recorded)+AuditDrawer(null,recorded);
  assert.match(html,/Recorded execution proof/);
  assert.match(html,/September 7/);
  assert.match(html,/Archived evidence · Not a live demo run/);
  assert.doesNotMatch(html,/Recorded G4 proof/);
  assert.equal(JSON.stringify(recorded),before);
});
test('footer mode follows the supplied recorded bundle without a workflow action',async()=>{
  const h=await harness();
  h.setBundle({recorded:{}});await h.api.refresh();
  assert.equal(h.panels.at(-1)[1],true);assert.equal(h.panels.at(-1)[2],true);
  h.setBundle({projection:{}});await h.api.refresh();
  assert.equal(h.panels.at(-1)[1],true);assert.equal(h.panels.at(-1)[2],false);
  assert(h.calls.every(call=>call.url!=='/action'));
});
