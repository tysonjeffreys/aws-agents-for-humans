import { AdmissibleDemoShell, AccessPanel, escape } from './components.mjs';
const app = document.getElementById('app');
const announcement = document.getElementById('announcement');
let current = null, fingerprint = '', sending = false, timer;
const query = new URLSearchParams(location.search);
const endpoint = '/api/view' + (query.size ? '?' + query.toString() : '');
function inspection() {
  const drawer = document.getElementById('audit-drawer'), opener = document.getElementById('open-audit');
  const technical = document.getElementById('technical-panel'), more = document.getElementById('open-technical');
  const setTechnical = (open,focus=true) => {
    if (!technical) return;
    technical.hidden = !open; more.setAttribute('aria-expanded',String(open));
    if (focus) (open ? document.getElementById('technical-title') : more).focus();
  };
  const setDrawer = open => {
    drawer.hidden = !open; if (!open) setTechnical(false,false);
    document.querySelector('.audit-layout').classList.toggle('is-open',open);
    opener.setAttribute('aria-expanded',String(open));
    (open ? document.getElementById('audit-title') : opener).focus({preventScroll:true});
  };
  opener?.addEventListener('click',() => setDrawer(drawer.hidden));
  document.getElementById('close-audit')?.addEventListener('click',() => setDrawer(false));
  drawer?.addEventListener('keydown',e => { if (e.key === 'Escape') setDrawer(false); });
  more?.addEventListener('click',() => setTechnical(technical.hidden));
  document.getElementById('close-technical')?.addEventListener('click',() => setTechnical(false));
  technical?.addEventListener('keydown',e => { if (e.key === 'Escape') setTechnical(false); });
}
const notices = {
  STALE_VIEW_CONTEXT:'The case changed since this page was shown. Review the current state before choosing again.',
  STALE_DECISION_CARD:'That decision card is no longer current. No decision was submitted.',
  SESSION_REQUIRED_OR_EXPIRED:'Your demo session ended. Enter the code again. Existing run evidence is preserved.',
  SUBMISSION_OUTCOME_UNCONFIRMED:'The submission outcome is not yet confirmed. No action has been repeated.',
  FRESH_RUN_LIMIT:'The fresh-run limit for this session has been reached.',
  RATE_LIMITED:'Please wait before trying another action.',
};
function notice(code) {
  const target = document.getElementById('transport-message');
  const text = notices[code] ?? 'The request could not be confirmed. Check the current case state before continuing.';
  if (target) target.innerHTML = `<p class="transport-notice" role="status">${escape(text)}</p>`;
  announcement.textContent = text;
}
function render(data) {
  const drawerOpen = document.getElementById('audit-drawer')?.hidden === false;
  const technicalOpen = document.getElementById('technical-panel')?.hidden === false;
  const options = {interactive:data.ui.interactive,ui:data.ui};
  app.innerHTML = data.bundle ? AdmissibleDemoShell(data.bundle,options) + AccessPanel(data.ui,true,Boolean(data.bundle.recorded)) : AccessPanel(data.ui,false);
  inspection();
  if (drawerOpen) {
    document.getElementById('audit-drawer')?.removeAttribute('hidden');
    document.querySelector('.audit-layout')?.classList.add('is-open');
    document.getElementById('open-audit')?.setAttribute('aria-expanded','true');
  }
  if (technicalOpen) {
    document.getElementById('technical-panel')?.removeAttribute('hidden');
    document.getElementById('open-technical')?.setAttribute('aria-expanded','true');
  }
  for (const button of document.querySelectorAll('[data-action]')) {
    const viewId = data.ui.view_id; // Capture this displayed revision, never rebind a stale click.
    button.addEventListener('click',() => act(button.dataset.action,viewId));
  }
  document.getElementById('refresh-state')?.addEventListener('click',() => refresh());
  if (data.ui.notice) notice(data.ui.notice);
  else if (!sending) announcement.textContent = ''; // A completed submission must not remain announced as in flight.
}
async function refresh() {
  clearTimeout(timer);
  try {
    const response = await fetch(endpoint,{cache:'no-store',credentials:'same-origin',redirect:'error'});
    if (!response.ok) throw new Error('read');
    const data = await response.json();
    const signature = JSON.stringify(data,(key,value) => key === 'observed_at' ? undefined : value);
    current = data;
    if (signature !== fingerprint) { fingerprint = signature; render(data); }
    timer = setTimeout(refresh,data.ui.pending ? 2000 : 10000); // GET only; never advances workflow.
  } catch {
    if (!current) app.innerHTML = '<main class="shell" id="case"><h1>Case view unavailable</h1><p>No outcome has been assumed.</p><button class="button" id="refresh-state">Check case state</button><div id="transport-message"></div></main>';
    for (const button of document.querySelectorAll('[data-action]')) button.disabled = true;
    document.getElementById('refresh-state')?.addEventListener('click',() => {fingerprint='';refresh();},{once:true});
    notice('READ_UNAVAILABLE'); fingerprint = ''; timer = setTimeout(refresh,10000);
  }
}
async function act(action,viewId) {
  if (sending) return;
  sending = true; clearTimeout(timer);
  for (const button of document.querySelectorAll('[data-action]')) button.disabled = true;
  announcement.textContent = 'Submitting the selected action…';
  let error = null;
  try {
    const response = await fetch('/action',{method:'POST',credentials:'same-origin',redirect:'error',
      headers:{'content-type':'application/x-www-form-urlencoded'},body:new URLSearchParams({action,view_id:viewId})});
    if (!response.ok) error = (await response.json()).reason_code;
  } catch { error = 'SUBMISSION_OUTCOME_UNCONFIRMED'; }
  finally { sending = false; fingerprint = ''; await refresh(); if (error) notice(error); }
}
// Code entry is a native POST form: this script never reads or stores its input.
refresh();
