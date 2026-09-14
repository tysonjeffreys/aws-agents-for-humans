/** Presentation only. No runtime, authority, provider, SDK or private-record imports. */
export const escape = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const bank = value => value === null ? 'Unconfirmed' : `<span class="mask" aria-hidden="true">••••</span><span class="sr-only">ending in </span>${escape(value)}`;
const check = text => `<span class="check" aria-hidden="true">✓</span>${escape(text)}`;
export const ACTION_LABELS = Object.freeze({ START:'Start case work', ADVANCE_SYNTHETIC_VERIFICATION:'Advance synthetic verification', SHOW_ENFORCEMENT_PROOF:'Show enforcement proof', EXECUTE_APPROVED_CHANGE:'Execute approved change', VERIFY_SINGLE_USE_PROTECTION:'Verify single-use protection' });
export const TIMELINE_LABELS = Object.freeze({ INVOICE_MATCHED:'Invoice matched', BANK_CHANGE_OBSERVED:'Bank change observed', VERIFICATION_PREPARED:'Verification prepared', VERIFICATION_CONFIRMED:'Verification confirmed', HUMAN_APPROVAL_RECORDED:'Human approval recorded', CHANGED_EFFECT_BLOCKED:'Changed downstream effect blocked', APPROVED_CHANGE_COMPLETED:'Approved change completed' });
export function BankChangePanel(from, to, fromLabel = 'Current', toLabel = 'Requested') {
  return `<dl class="bank-pair"><div class="bank-value"><dt>${escape(fromLabel)}</dt><dd>${bank(from)}</dd></div><span class="bank-arrow" aria-hidden="true">→</span><div class="bank-value"><dt>${escape(toLabel)}</dt><dd>${bank(to)}</dd></div></dl>`;
}
export function InvoiceSummary(view) {
  return `<section class="invoice-summary" aria-label="Invoice work"><h2>Invoice ${escape(view.case.invoice)}</h2><div class="invoice-checks"><p>${view.invoice.matched ? check(`Matched to ${view.case.purchase_order}`) : 'Invoice match not yet confirmed'}</p><p>${view.invoice.freight_within_terms ? check('$125 freight is within approved terms') : 'Freight terms not yet confirmed'}</p></div></section>`;
}
export function CaseHeader(caseInfo) {
  return `<header class="case-header"><div><h1>${escape(caseInfo.vendor)}</h1><p>Vendor &amp; Payment Exception</p></div><span class="case-number">${escape(caseInfo.display_case_id)}</span></header>`;
}
export function StatusMessage(view) {
  const copy = {
    WORK_NOT_STARTED:['Ready to begin','Case work has not started.'],
    ORDINARY_WORK_QUEUED:['Case work queued','Waiting for the agent to begin.'],
    PREPARING_HUMAN_BOUNDARY:['Verification recorded','Preparing the exact decision. No action needed from you.'],
    PREPARING_EXACT_AUTHORITY:['Approval recorded.','Preparing this exact change.'],
    HUMAN_REJECTED_CHANGE:['Bank change rejected.','No change will be made.'],
    DECISION_CARD_EXPIRED:['This decision is no longer available.','Case status needs to be checked.'],
    EXACT_AUTHORITY_EXPIRED:['This approval can no longer be used to make a change.','The original decision is preserved.'],
    OPERATION_OUTCOME_UNCONFIRMED:['The final vendor record has not yet been verified.','The outcome needs to be checked. No action has been repeated.'],
    RECORDS_NEED_REVIEW:['Final state needs review.','The current records could not be confirmed.'],
  }[view.reason_code] ?? ['Case status needs to be checked.','No outcome has been assumed.'];
  return `<section class="bank-panel" aria-labelledby="bank-heading"><p class="eyebrow">Bank change</p><h2 id="bank-heading">${escape(copy[0])}</h2><p class="status-note">${escape(copy[1])}</p>${view.reason_code === 'HUMAN_REJECTED_CHANGE' && view.bank_change.current !== null ? `<p class="status-foot">Vendor record remains ${bank(view.bank_change.current)}</p>` : ''}</section>`;
}
export function DecisionCard(view, options) {
  // The server supplies both the current card and available actions. No browser eligibility rule.
  const card = view.decision_card;
  if (!card) return `<section class="bank-panel"><h2>Case status needs to be checked.</h2><p>No decision card is available.</p></section>`;
  const canShowPreview = options.review && options.operatorPreview;
  const interactive = options.interactive && options.ui?.interactive;
  const actions = canShowPreview || interactive ? ['REJECT_CANDIDATE','APPROVE_CANDIDATE'].filter(a => view.available_actions.human.includes(a) && (!interactive || options.ui.actions.includes(a))).map(a => `<button type="button" class="button ${a === 'APPROVE_CANDIDATE' ? 'primary' : ''}" ${interactive ? 'data-action' : 'data-preview-action'}="${a}">${a === 'APPROVE_CANDIDATE' ? 'Approve' : 'Reject'}</button>`).join('') : '';
  return `<section class="bank-panel decision-panel" aria-labelledby="bank-heading"><p class="eyebrow">Decision needed</p><h2 id="bank-heading">${escape(view.case.vendor)} · Bank change</h2>${BankChangePanel(card.current, card.proposed)}<p class="verification-line">${check('Independently verified through known vendor contact')}</p><div class="decision-footer"><div><h3>Approve this vendor bank change?</h3><p>This does not approve or release a payment.</p></div>${actions ? `<div class="actions" aria-label="${interactive ? 'Your decision' : 'Decision preview'}">${actions}</div>` : `<p class="secondary">Read-only view · Decision requested from the authorized operator.</p>`}</div></section>`;
}
export function ProofComparison(view) {
  return `<section class="bank-panel proof-panel" aria-labelledby="bank-heading"><p class="eyebrow">Demo enforcement proof</p><h2 id="bank-heading">What if the downstream request changes after approval?</h2><div class="proof-grid"><div class="proof-column"><p class="proof-label">Approved</p><div class="proof-numbers">${bank('4812')}<span class="arrow" aria-label="to">→</span><span class="destination">${bank('9371')}</span></div></div><div class="proof-column"><p class="proof-label">Attempted</p><div class="proof-numbers">${bank('4812')}<span class="arrow" aria-label="to">→</span><span class="destination">${bank('9351')}</span></div></div></div><p class="blocked-label">BLOCKED</p><p class="status-copy">The attempted change does not match the approved change.</p><div class="proof-assurance"><span>Vendor record unchanged: ${bank(view.bank_change.current)}</span><span>Single-use authority remains unused.</span></div></section>`;
}
export function CompletionSummary(view, replay = false, recorded = false) {
  const checklist = recorded ? ['Exact approved change completed','Final vendor record verified'] : ['Invoice resolved','Independent verification completed','Human approval recorded','Exact approved change completed','Final vendor record verified'];
  return `<section class="bank-panel completion-panel" aria-labelledby="bank-heading"><h2 id="bank-heading">Change completed</h2><p class="status-copy">Executed once · Final state verified</p><div class="completion-content"><div>${BankChangePanel('4812',view.bank_change.current,'Previous','Current')}<dl class="completion-facts"><div><dt>Vendor bank</dt><dd>${bank(view.bank_change.current)}</dd></div><div><dt>Status</dt><dd>Complete</dd></div></dl></div><ul class="completion-list">${checklist.map(text => `<li>${check(text)}</li>`).join('')}</ul></div><p class="status-foot">No payment was released.</p>${replay ? `<div class="replay-note"><strong>No new effect</strong><p>This change was already completed.<br>Authority was consumed after one use.</p></div>` : ''}</section>`;
}
export function MainState(view, options = {}) {
  // Switch only on server presentation enums. Never infer commitment from digits or receipts.
  if (view.experience_state === null) return StatusMessage(view);
  switch (view.experience_state) {
    case 'WORKING': return `<section class="bank-panel"><p class="eyebrow">Agent working</p><h2 id="bank-heading">Matching ${escape(view.case.invoice)} to ${escape(view.case.purchase_order)}.</h2><p class="status-note">No action needed from you.</p></section>`;
    case 'WAITING_FOR_VERIFICATION': return `<section class="bank-panel" aria-labelledby="bank-heading"><h2 id="bank-heading">Bank change</h2>${BankChangePanel(view.bank_change.current,view.bank_change.requested)}<p class="status-copy">Waiting for independent verification.</p><p class="status-note">No action needed from you.</p></section>`;
    case 'DECISION_REQUIRED': return DecisionCard(view, options);
    case 'APPROVED_EXACT_CHANGE': return `<section class="bank-panel" aria-labelledby="bank-heading"><p class="eyebrow">Approved</p><h2 class="sr-only" id="bank-heading">Exact bank change approved</h2>${BankChangePanel('4812',view.bank_change.requested,'From','To')}<p class="approved-line">Authorized for <strong>this change only</strong> · <strong>Single use</strong></p><p class="status-note">The approval cannot authorize a different bank change or payment.</p>${view.bank_change.current !== null ? `<p class="status-foot">Vendor record is still ${bank(view.bank_change.current)}</p>` : ''}${view.proof_overlay === 'CHECKING_CHANGED_EFFECT' ? '<p class="transport-notice">Checking the outcome…</p>' : ''}</section>`;
    case 'CHANGED_EFFECT_BLOCKED': return ProofComparison(view);
    case 'EFFECT_COMMITTED': return CompletionSummary(view) + (view.proof_overlay === 'CHECKING_REPLAY' ? '<p class="transport-notice">Checking single-use protection…</p>' : '');
    case 'REPLAY_BLOCKED': return CompletionSummary(view,true);
    default: return `<section class="bank-panel"><h2>Case status needs to be checked.</h2><p>This experience state is not supported by this client.</p></section>`;
  }
}
export function CaseTimeline(timeline) {
  const events = timeline?.events ?? [];
  return `<ol class="timeline" aria-label="Case progress">${events.slice(0,7).map(e => `<li>${escape(TIMELINE_LABELS[e.kind] ?? 'Case event')} ${e.demo_proof ? '<small>· Demo proof</small>' : ''}</li>`).join('')}</ol>`;
}
export function DemoOperatorRail(view, options) {
  if (options.interactive && options.ui?.interactive) {
    const controls = view.available_actions.demo.filter(a => options.ui.actions.includes(a) && Object.hasOwn(ACTION_LABELS,a)).map(a => `<button class="button" type="button" data-action="${escape(a)}">${escape(ACTION_LABELS[a])}</button>`).join('') + (options.ui.actions.includes('RECONCILE') ? '<button class="button" data-action="RECONCILE">Check submitted action</button>' : '');
    return `<aside class="operator-rail" aria-label="Demo verification · Synthetic events"><div class="rail-heading"><h2>Demo verification · Synthetic events</h2><span class="rail-note">Demo operator controls</span></div><div class="actions">${controls}${options.ui.can_start_fresh ? '<button class="text-button" type="button" data-action="CREATE">Start fresh demo</button>' : ''}</div><p class="secondary">Fresh demos create a separate run. Previous decisions and evidence are preserved.</p>${['DECISION_CARD_EXPIRED','EXACT_AUTHORITY_EXPIRED'].includes(view.reason_code) ? '<p>This run is no longer eligible. Start a fresh demo to continue.</p>' : ''}</aside>`;
  }
  if (!options.operatorPreview) return '';
  // A visibility request is NEVER authentication. This phase has no mutation transport.
  const previews = options.review ? view.available_actions.demo.filter(a => Object.hasOwn(ACTION_LABELS,a)).map(a => `<button class="button" type="button" data-preview-action="${escape(a)}">${escape(ACTION_LABELS[a])}</button>`).join('') : '';
  return `<aside class="operator-rail" aria-label="Demo verification — synthetic events"><div class="rail-heading"><h2>Demo verification — synthetic events</h2><span class="rail-note">${options.review ? 'Control preview · No live actions' : 'Private operator bridge unavailable'}</span></div>${options.review ? `<div class="actions">${previews}<button class="text-button" type="button" data-preview-action="CREATE">Start fresh demo</button></div>` : ''}<p class="secondary">Creates a new synthetic run. Previous demo evidence is preserved.</p><p class="rail-note">${options.review ? 'Review controls do not send requests or change the displayed state.' : 'Operator mode is not authorization. This surface cannot mutate.'}</p></aside>`;
}
const auditLabel = { APPROVE_CANDIDATE:'APPROVED', REJECT_CANDIDATE:'REJECTED', NOT_RECORDED:'Not recorded', NONE:'None', PREPARING:'Preparing', ACTIVE:'SINGLE USE / UNUSED', CONSUMED:'SINGLE USE / CONSUMED', EXPIRED:'Expired', UNCONFIRMED:'Unconfirmed', NOT_YET_VERIFIED:'Not yet verified', ENFORCED:'ENFORCED', COMMITTED:'COMMITTED', VERIFIED:'VERIFIED', BLOCKED_NO_NEW_EFFECT:'BLOCKED — no new effect', NOT_CHECKED:'Not checked' };
const labels = { decision:'Decision', approved_change:'Approved change', authority:'Authority', aws_enforcement:'AWS enforcement', effect:'Effect', final_state:'Final state', replay:'Replay' };
// Explicit projection paths: do not render arbitrary JSON, private grant fields or future extras.
const receiptKeys = ['decision','trace_id','request_id','policy_version','reason','authorized_payload_sha256'];
const effectKeys = ['schema','demo_run_id','effect_execution_id','authority_id','grant_digest','effect_digest','case_id','candidate_id','case_state_version','vendor_id','pre_bank_fingerprint','post_bank_fingerprint','pre_vendor_state_version','post_vendor_state_version','broker_principal','executed_at','status'];
const proofKeys = ['kind','observed_at','decision','reason','gateway_request_id','broker_request_id','new_effect'];
const pickScalars = (object, keys) => Object.fromEntries(keys.filter(k => object && Object.hasOwn(object,k) && (object[k] === null || ['string','number','boolean'].includes(typeof object[k]))).map(k => [k,object[k]]));
export function safeTechnical(technical = {}) {
  const out = pickScalars(technical,['decision_card_digest','authority_id','grant_digest','effect_digest','candidate_digest']);
  for (const [name,keys] of [['decision_receipt',receiptKeys],['issuance_receipt',receiptKeys],['committed_receipt',effectKeys],['effect_receipt',effectKeys],['changed_effect',proofKeys],['replay',proofKeys]]) if (technical[name]) out[name] = pickScalars(technical[name],keys);
  return out;
}
function TechnicalCard(title, fields) {
  return `<section class="technical-card${Object.keys(fields).length > 10 ? ' wide' : ''}"><h3>${escape(title)}</h3><dl class="technical-fields">${Object.entries(fields).map(([key,value]) => `<div><dt>${escape(key.replaceAll('_',' '))}</dt><dd>${escape(value === null ? 'null' : value)}</dd></div>`).join('')}</dl></section>`;
}
function TechnicalPanel(details, audit, recorded) {
  // Reformat only the existing allowlisted fields; no new projection or inference.
  const scalarFields = Object.fromEntries(Object.entries(details).filter(([,value]) => value === null || typeof value !== 'object'));
  const cards = [];
  if (audit?.demo_run_id) scalarFields.demo_run_id = audit.demo_run_id;
  if (Object.keys(scalarFields).length) cards.push(TechnicalCard('Identity and binding',scalarFields));
  if (recorded) cards.push(TechnicalCard('Recorded source',pickScalars(recorded.source,['checkpoint','commit','artifact','sha256'])));
  for (const [name,value] of Object.entries(details)) if (value && typeof value === 'object') cards.push(TechnicalCard(name.replaceAll('_',' '),value));
  return `<section class="technical-panel" id="technical-panel" aria-labelledby="technical-title" hidden><div class="section-row"><h2 id="technical-title" tabindex="-1">Technical details</h2><button class="text-button" id="close-technical" aria-label="Close technical details">Close ×</button></div><p class="technical-note">ACME Components is a display alias for Example Industrial Supply (Synthetic). Bank digits are synthetic fingerprints, not account numbers.</p>${recorded ? `<p class="technical-note">${escape(recorded.observed_at_note)}</p>` : ''}<div class="technical-grid">${cards.join('')}</div></section>`;
}
export function AuditDrawer(audit, recorded = null, review = false) {
  const summary = audit?.summary;
  const rows = summary ? Object.keys(labels).filter(k => Object.hasOwn(summary,k)).map(k => {
    const value = k === 'approved_change' ? (summary[k] ? `${bank(summary[k].from)} → ${bank(summary[k].to)}` : 'Not recorded') : escape(auditLabel[summary[k]] ?? summary[k]);
    return `<div><dt>${labels[k]}</dt><dd>${value}</dd></div>`;
  }).join('') : '';
  const details = safeTechnical(audit?.technical ?? recorded?.technical);
  const context = recorded ? 'Recorded execution proof — September 7. Not a live demo run.' : `${review ? 'Mock live-run projection · sample observation' : 'Live demo run · observed'} ${audit?.observed_at ?? 'not available'}`;
  return `<section class="audit-drawer" id="audit-drawer" aria-labelledby="audit-title" hidden><div class="section-row"><h2 id="audit-title" tabindex="-1">Audit proof</h2><button class="text-button" id="close-audit" aria-label="Close audit proof">Close ×</button></div><p class="audit-context">${escape(context)}</p>${summary ? `<dl class="audit-facts">${rows}</dl>` : `<p class="status-note">${recorded ? 'Recorded final state verified. One committed receipt; authority consumed after one use.' : 'Audit records are not yet available or need review.'}</p>`}<button type="button" class="text-button technical-toggle" id="open-technical" aria-controls="technical-panel" aria-expanded="false">Technical details ↗</button></section>${TechnicalPanel(details,audit,recorded)}`;
}
export function RecordedProofBadge(recorded) {
  return `<div class="recorded-badge"><strong>Recorded execution proof</strong><span>September 7</span><span>Archived evidence · Not a live demo run</span></div>`;
}
export function AdmissibleDemoShell(bundle, options = {}) {
  const recorded = bundle.recorded;
  const view = bundle.projection;
  const header = `<div class="brand-row"><a class="brand" href="https://admissible.io" aria-label="Admissible AI"><strong>Admissible</strong><span>AI</span></a><span class="context-label">${options.interactive ? 'Interactive demo · Synthetic case' : `Synthetic case${!options.operatorPreview ? ' · Read only' : ''}`}</span></div>`;
  if (recorded) {
    // Separate recorded component path: never synthesize a LIVE_DEMO_RUN or timeline.
    const historical = { bank_change: { current: recorded.summary.vendor_bank } };
    return `<main class="shell" id="case">${header}${CaseHeader({vendor:'ACME Components',display_case_id:'CASE-1042'})}${RecordedProofBadge(recorded)}<div class="audit-layout"><div>${CompletionSummary(historical,recorded.summary.replay === 'BLOCKED_NO_NEW_EFFECT',true)}<div class="section-row"><span class="secondary">Recorded effect ${escape(recorded.recorded_effect_at)}</span><button class="text-button" id="open-audit" aria-controls="audit-drawer" aria-expanded="false">View audit proof ↗</button></div></div>${AuditDrawer(null,recorded)}</div></main>`;
  }
  return `<main class="shell ${options.operatorPreview ? 'recording' : ''}" id="case">${header}${CaseHeader(view.case)}${InvoiceSummary(view)}<div class="audit-layout"><div>${MainState(view,options)}<div class="section-row"><h2>Case progress</h2><button class="text-button" id="open-audit" aria-controls="audit-drawer" aria-expanded="false">View audit proof ↗</button></div>${CaseTimeline(bundle.timeline)}${DemoOperatorRail(view,options)}</div>${AuditDrawer(bundle.audit,null,options.review)}</div><div id="transport-message"></div></main>`;
}
export function AccessPanel(ui,hasCase,recorded = false) {
  const paths = recorded ? '' : '<a class="text-button" href="/demo/vendor-payment-exception?recorded=1">Recorded execution proof ↗</a>';
  if (hasCase) return `<footer class="shell access-footer">${!ui.interactive ? '<a class="button" href="/demo/vendor-payment-exception">Interactive demo</a>' : '<span class="secondary">Short-lived demo session. Decision and single-use authority expiries remain enforced.</span>'}${ui.interactive && ui.public_run_link ? `<a class="text-button" href="${escape(ui.public_run_link)}" target="_blank" rel="noopener">Read-only proof of this run ↗</a>` : ''}${paths}</footer>`;
  return `<main class="shell" id="case"><div class="brand-row"><span class="brand"><strong>Admissible</strong><span>AI</span></span><span class="context-label">Interactive demo · Synthetic case</span></div>${CaseHeader({vendor:'ACME Components',display_case_id:'CASE-1042'})}<section class="bank-panel access-panel"><h2>${ui.authenticated ? 'Ready for a fresh demo' : 'Enter your demo code'}</h2><p class="status-note">One synthetic vendor case. One exact human decision. One governed change.</p>${ui.authenticated ? `<p>No run is created until you choose to begin.</p>${ui.can_start_fresh ? '<button class="button primary" data-action="CREATE">Start fresh demo</button>' : '<p>Check the submission outcome before starting another run.</p>'}${ui.actions?.includes('RECONCILE') ? '<button class="button" data-action="RECONCILE">Check submitted action</button>' : ''}` : '<form method="post" action="/session" autocomplete="off"><label for="demo-code">Judge Demo Access Code</label><input id="demo-code" name="code" type="password" autocomplete="off" required maxlength="128" spellcheck="false"><button class="button primary" type="submit">Enter interactive demo</button></form><p class="secondary">No account or registration. Your browser session lasts two hours. Enter the same shared code again if it expires. Previous demo evidence is preserved.</p>'}</section><div class="section-row">${paths}</div><div id="transport-message"></div></main>`;
}
