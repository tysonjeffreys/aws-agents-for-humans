# Admissible Vendor & Payment Exception Operator

**AWS Agents for Humans Hackathon · Professional Agents**

Admissible Vendor & Payment Exception Operator is an AI agent for finance operations. It handles routine invoice work on its own, continues working to gather or coordinate missing evidence when a case is incomplete, and asks a person for a decision only when human authority is actually required.

The demo uses a synthetic vendor case involving a request to change a bank destination from `4812` to `9371`. After a human approves that exact change, the downstream request is deliberately changed to `9351`. The system blocks it while still allowing the originally approved `9371` change to execute once.

The important point is simple: **correct reasoning + valid human approval still does not authorize the wrong effect.**

All vendor, bank, invoice and transaction data in the demo is synthetic. No payment is released.

## The problem

AI agents are becoming capable of doing real business work: reconciling invoices, researching exceptions, gathering evidence, updating records and triggering downstream actions.

Human approval is often treated as the safety boundary for consequential work. But approval by itself does not guarantee that the action eventually executed is still the action the person actually approved.

A finance agent might correctly understand a vendor request, and a human might legitimately approve a bank change. Between that decision and execution, however, the downstream request could change, stale authority could be reused, or the approval could be applied to a different action.

This project focuses on that gap. Instead of asking only whether a person approved a workflow, Admissible checks whether the exact downstream effect is still supported by the evidence and the human decision that authorized it.

It also draws a line between two very different kinds of missing information. If evidence is missing, that is still work for the agent system: it can gather information, prepare verification, delegate a research step to another agent, call tools, or continue other safe work while the evidence is obtained. A person is interrupted only when the remaining gap is something uniquely human: authority to approve a consequential change.

## What the agent does

In the synthetic case, the agent matches invoice `INV-8831` to purchase order `PO-4417`, verifies that the freight charge is within approved terms, and identifies a requested vendor-bank change from `4812` to `9371`.

At that point it does not ask a person for approval, because the missing information is independent vendor verification. The agent prepares the verification work and carries the case forward while that evidence is being gathered. In a larger workflow, that evidence-gathering step can also be delegated to another specialized agent or service rather than being pushed to a human.

In the hosted demo, **Advance synthetic verification** represents the arrival of that independently gathered evidence. It adds evidence to the case; it does not add human authority.

Once the verification is available, the case reaches the point where a human decision is actually necessary. The user can approve or reject the exact `4812 → 9371` change.

If approved, the decision creates short-lived, single-use authority for that specific change. It does not update the vendor record by itself, and it does not authorize a payment.

The demo then deliberately changes the downstream destination from `9371` to `9351`. That request is blocked. The originally approved `9371` change remains available and can execute once. A replay after completion produces no new effect.

## Try the live demo

**Live demo:** [Open the interactive demo](https://3p2vv4sfjwsxqiyqtochpdhnb40huhnz.lambda-url.us-west-2.on.aws/demo/vendor-payment-exception)

The Judge Demo Access Code is provided privately in the hackathon testing instructions and is not stored in this repository.

To run the demo:

1. Click **Start fresh demo** and let the agent complete the ordinary invoice work.
2. Click **Advance synthetic verification** to represent the arrival of independently gathered vendor-verification evidence.
3. Approve or reject the exact `4812 → 9371` bank-change request.
4. If you approve it, click **Show enforcement proof** to attempt the changed `9351` destination.
5. Execute the original `9371` change and then verify that replay produces no new effect.
6. Open **View audit proof** to inspect the decision, authority, enforcement and final effect.

Each attempt creates a new disposable run. Completed and rejected runs are preserved rather than reset.

See [`JUDGE_GUIDE.md`](JUDGE_GUIDE.md) for the walkthrough.

## Why the approval step matters

The human approval in this workflow is not a general permission to continue. It authorizes one specific change.

For example:

```text
Approved
4812 → 9371

Attempted later
4812 → 9351

Result
BLOCKED
```

Immediately after the human approves `9371`, the vendor record is still `4812`. The downstream action must independently match the approved change before anything is committed.

This is also why the approval cannot be reused indefinitely. Once the correct change is executed, the authority is consumed. A replay returns the existing completed result instead of producing another effect.

## Architecture

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

The browser never receives AWS credentials or authority material. The hosted bridge exposes only the small set of actions needed for the demo. AWS IAM authenticates the server-side application path, and the workflow independently checks the current case state and authenticated caller before consequential actions proceed.

## AWS and agent stack

The professional agent is built with the **Strands Agents SDK** and uses **Amazon Nova Lite** for model reasoning.

**Amazon Bedrock AgentCore Runtime** hosts the managed agent execution path, while **AgentCore Memory** carries case continuity across sessions. **AgentCore Gateway + Policy** provides an independent AWS enforcement layer around consequential actions.

The hosted judge experience uses **Amazon API Gateway with AWS_IAM** for authenticated application transport. **AWS Lambda** hosts bounded application services and the judge-access bridge, while **Amazon DynamoDB** stores synthetic application state, single-use authority state, effect receipts and isolated judge-session coordination.

## Memory without automatic trust

Long-running agents need memory, but persisted information should not automatically become trusted business state.

In this project, AgentCore Memory can preserve observations and workflow context across sessions, while Admissible determines what information can participate in consequential decisions.

The principle we use is: **persistence is not admission**.

A future agent can recover the case without silently treating every remembered claim as authoritative.

## Approval stays bound to execution

Human approval creates authority, not the effect itself.

The actual downstream action still has to match what was approved. In the demo, approval for `4812 → 9371` does not authorize `4812 → 9351`, and it does not authorize a payment.

When the correct `9371` change executes, the vendor record is updated and the authority is consumed. A second attempt creates no additional effect.

## Selective human interruption

The agent does not ask a person to solve every uncertainty.

When evidence is missing, the agent system keeps working. It can gather information, prepare verification, call tools, or delegate an evidence-gathering task to another agent while continuing any other safe work that can proceed.

A human is interrupted only when the available evidence is sufficient and human authority itself is the remaining requirement.

In practice, the division of work looks like this:

```text
ordinary work        → agent
missing evidence     → agent gathers or coordinates evidence
human authority      → ask a person
exact execution      → enforce what was approved
```

## Source boundary and pre-existing work

Admissible is a **pre-existing proprietary runtime/service** developed before this hackathon. Its underlying runtime implementation is not included in this public repository.

The proprietary runtime provides capabilities for authority evaluation, evidence handling, exact delegation, effect enforcement and reconciliation. Those capabilities are not claimed as work created during this hackathon and are not licensed through this repository.

This repository contains the hackathon application layer that is safe to publish, including the AWS/Strands agent application, integration clients, vendor/payment workflow, hosted judge interface, bounded judge-session bridge, selected application-layer tests and public documentation.

The repository is therefore not a standalone deployment of the proprietary Admissible runtime. The complete system can be evaluated through the hosted demo.

See [`SOURCE_BOUNDARY.md`](SOURCE_BOUNDARY.md) for the exact public-source boundary.

## What was built for the hackathon

The hackathon work includes the Vendor & Payment Exception Operator and the AWS-native application around it:

- Strands and Nova professional-agent workflow
- vendor and invoice exception handling
- agent-driven evidence gathering and verification coordination
- AgentCore Runtime integration
- AgentCore Memory continuity
- selective human interruption
- approval-to-effect binding for the finance workflow
- AgentCore Gateway / Policy enforcement
- hosted interactive judge experience
- shared-code judge access and isolated browser sessions
- IAM-protected API Gateway transport
- synthetic downstream effect demonstration
- browser-visible audit proof and replay protection

The underlying proprietary Admissible runtime predates the hackathon.

## Repository structure

```text
agent/
  agent.py
  aws_clients.py
  requirements-agentcore.txt

judge-surface/
  public/
  bridge/
  testing/

JUDGE_GUIDE.md
SOURCE_BOUNDARY.md
THIRD_PARTY_NOTICES.md
LICENSE
README.md
```

## Local source checks

The public source subset is intended for code review and application-layer testing rather than standalone deployment of the proprietary Admissible service.

Requirements are Node.js 20+, Python 3, and optionally a Python virtual environment.

```bash
python3 -m venv .venv
.venv/bin/python -m pip install -r agent/requirements-agentcore.txt

G45C_TEST_PYTHON="$PWD/.venv/bin/python" npm test
```

The included tests do not make requests to AWS or the proprietary Admissible service. Signing tests use fake credentials and compare the JavaScript signer against botocore locally.

No cloud-deployment command is included in this public source subset.

## Demo safety

The hosted demo uses synthetic data only. It does not execute or release payments, use real vendor bank-account information, alter real financial systems, expose AWS credentials to the browser, or let the browser construct arbitrary authority or effect payloads.

## Demo video

**Video:** [Watch the demo](https://youtu.be/uWbr9ACuwyQ)

The video follows a fresh live run from ordinary agent work through independent verification, human approval, changed-effect rejection, correct single execution, replay protection and audit proof.

## License

The hackathon-created source included in this repository is licensed under the **Apache License 2.0**.

The license applies only to the files included in this repository. It does not grant rights to the proprietary Admissible runtime, services, trademarks or other omitted intellectual property.

See [`THIRD_PARTY_NOTICES.md`](THIRD_PARTY_NOTICES.md) for third-party notices.
