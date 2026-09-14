# Judge walkthrough

Open the [hosted demo](https://3p2vv4sfjwsxqiyqtochpdhnb40huhnz.lambda-url.us-west-2.on.aws/demo/vendor-payment-exception). The shared Judge Demo Access Code is provided privately in the hackathon testing instructions. Never put it in a URL, repository or public issue. No account creation is required.

The agent handles ordinary work and prepares or coordinates the evidence still needed. **Missing evidence stays with the agent system; missing authority goes to the human.** The demo uses a bounded synthetic event to represent independently gathered verification arriving; it does not ask you to verify the vendor yourself.

1. Enter the code. **Ready for a fresh demo** means no run has been created yet.
2. Choose **Start fresh demo**. Watch the agent match the invoice, check freight terms and prepare the independent-verification work. The case then shows **Waiting for independent verification** while that evidence remains outstanding. Bank remains **4812**; the evidence gap is not escalated to you for approval.
3. Under **Demo verification · Synthetic events**, choose **Advance synthetic verification**. This represents the arrival of independently gathered vendor-verification evidence. It adds evidence, not human authority; clicking it is a demo-environment action, not you personally verifying the vendor.
4. Once the evidence is sufficient and human authority is the remaining requirement, read the exact **4812 → 9371** card and make your genuine **Approve** or **Reject** choice. No payment is authorized.
5. If approved, wait for **this change only / Single use**, then choose **Show enforcement proof**. The fixed attempted **9351** mismatch is **BLOCKED**, leaving the bank unchanged and authority unused.
6. Choose **Execute approved change**. The exact **9371** destination commits once. **Previous/Current** distinguish the before and after state.
7. Choose **Verify single-use protection**. Replay creates **No new effect**.
8. Open **View audit proof** and, if desired, **Technical details**. Refresh reconstructs server-authoritative state; no workflow action is performed by refresh.

**Reject is a valid result.** Rejection is durable, the vendor stays at **4812**, no authority/effect is created, and execution controls disappear. A different choice requires a new disposable run, never editing a rejected decision.

**Start fresh demo** creates a distinct run and preserves previous decisions and evidence; it is not a reset. Sessions last two hours and have a bounded fresh-run allowance. Re-enter the same private code when access expires. Decision-card and 600-second single-use authority expiries remain enforced independently; an expired run needs a fresh demo, not renewed authority.

**Read-only proof of this run** has no action capability. The historical recorded-proof link shows explicitly labeled September 7 evidence, not the current live run. The primary experience is the authenticated interactive synthetic demo.

This demo does not contact a real vendor, use real email, or deploy a team of evidence-gathering agents. Its synthetic verification event represents evidence arrival at the integration boundary. The distinction between agent evidence work and human authority remains the same.

Do not double-click or improvise retries after an unconfirmed outcome. Use the displayed status/check control; the backend remains authoritative. All displayed bank digits are synthetic fingerprints, not account numbers. No real finance system or payment execution is connected.
