# Application architecture

The diagram below is the same intentionally simple conceptual view as the README. A [PNG diagram](architecture/overview.png), [editable SVG](architecture/overview.svg), and [plain-text diagram source](architecture/overview.txt) are provided; no private resource identifiers or implementation internals are included.

```text
Finance Operator / Judge
          |
          v
     Hosted Demo
          |
          v
 Secure Session Bridge
          |
          v
 API Gateway (AWS_IAM)
          |
          v
    Finance Workflow
          |
          +----------------------+
          |                      |
          v                      v
   Strands Agent            Admissible
   + Nova Lite          proprietary runtime
          |                      |
          v                      |
 AgentCore Runtime               |
   + Memory                      |
          |                      |
          +----------+-----------+
                     |
                     v
          AgentCore Gateway
              + Policy
                     |
                     v
          Exact Effect Execution
                     |
                     v
          Synthetic Vendor Record
```

## Responsibility boundaries

- **Hosted Demo / Secure Session Bridge:** one authenticated judge session, bounded actions, no AWS credentials or executable authority material in browser JavaScript.
- **API Gateway / Finance Workflow:** AWS-authenticated application transport and independent checks of the caller, current case and permitted transition.
- **Strands Agent + Nova Lite:** ordinary invoice work, preparation/coordination of missing evidence, and a selective human interruption when sufficient evidence leaves human authority as the remaining requirement.
- **AgentCore Runtime + Memory:** the agent runs inside the managed runtime; Memory supports continuity. The diagram is a conceptual view, not a claim that the agent and its runtime are separate sequential services. Remembered content does not become trusted merely because it was persisted.
- **Admissible:** the pre-existing proprietary runtime/service evaluates evidence and authority. Its implementation is intentionally omitted, not rebuilt in this repository.
- **AgentCore Gateway + Policy / Exact Effect Execution:** the downstream request must match the specific authorized change. A changed destination is blocked; the correct change executes once and replay creates no new effect.
- **Synthetic Vendor Record:** authoritative synthetic state, not a real vendor directory or payment system.

## Evidence and human authority

Ordinary work belongs to the agent. Missing evidence stays with the agent system to gather, verify or coordinate; missing human authority is the reason to ask a person. In this demo, **Advance synthetic verification** represents independently gathered evidence arriving. It does not represent a judge verifying the vendor and does not confer human approval.

The bounded synthetic demo prepares verification work and accepts the controlled evidence-arrival event. It does not contact a real vendor or deploy a multi-agent evidence-gathering system. Those broader integrations are not claimed as demonstrated capabilities.

Once evidence is sufficient, the person approves or rejects **4812 → 9371**. Approval alone leaves the record at **4812**. The intentional **9351** mismatch is blocked; the exact **9371** update can commit once, followed by a no-new-effect replay result. No payment is released.

## Source and rendering notes

The application/integration source in this repository is a deliberately bounded subset; the hosted demo is the end-to-end evaluation path. See [the source boundary](SOURCE_BOUNDARY.md) for included work, exclusions and licensing.

The PNG retains the public components, connections and proprietary-service distinction from `architecture/overview.txt`, with a subtle AWS Agent Layer heading. Its editable source is `architecture/overview.svg`. The README ASCII version uses the same Finance Workflow label. No private identifiers, credentials or internal subsystem names are included.
