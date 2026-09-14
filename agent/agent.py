"""Native Strands control; admitted records and queued human choice are server-owned.

No model tool accepts a run ID, evidence, actor, decision, grant or effect fields.
This worker uses a restricted backend port. It has no Memory/grant/vendor write
SDK in its tool closure. The hosting/IAM adapter is qualified separately.
"""
from __future__ import annotations

from copy import deepcopy
import hashlib
import json
import re
from typing import Any

from strands import Agent, tool
from strands.hooks import HookProvider, HookRegistry, BeforeModelCallEvent
from strands.interrupt import InterruptException
from strands.types.tools import ToolContext

MODEL_ID = "us.amazon.nova-lite-v1:0"
AGENT_ID = "g45b-demo-worker"
INTERRUPT_NAME = "vendor-bank-change-human-decision"
RUN_PATTERN = r"demo-[0-9]{8}-[a-f0-9]{32}"
OP_PATTERN = r"operation-[a-f0-9]{64}"


def canonical_json(value: Any) -> str:
    return json.dumps(value, sort_keys=True, separators=(",", ":"), ensure_ascii=False, allow_nan=False)


def digest(value: Any) -> str:
    return hashlib.sha256(canonical_json(value).encode()).hexdigest()


class ModelBudget(HookProvider):
    def __init__(self) -> None:
        self.calls = 0

    def register_hooks(self, registry: HookRegistry) -> None:
        registry.add_callback(BeforeModelCallEvent, self.before)

    def before(self, event: BeforeModelCallEvent) -> None:
        self.calls += 1
        if self.calls > 8:
            raise RuntimeError("DEMO_MODEL_CALL_LIMIT")


class DemoAgent:
    def __init__(self, *, run_id: str, operation_id: str, backend: Any,
                 session_manager: Any, model: Any, effect_gateway: Any = None) -> None:
        if not re.fullmatch(RUN_PATTERN, run_id) or not re.fullmatch(OP_PATTERN, operation_id):
            raise ValueError("EXACT_SERVER_OPERATION_REQUIRED")
        self.run_id, self.operation_id = run_id, operation_id
        self.backend, self.session_manager, self.model = backend, session_manager, model
        self.effect_gateway = effect_gateway
        self.events: list[dict[str, Any]] = []
        self.protocol_error = False

    def call(self, action: str, **args: Any) -> Any:
        return self.backend.call(self.run_id, self.operation_id, action, args)

    def exact_tool(self, context: ToolContext, name: str) -> None:
        # The framework filters unknown kwargs before the Python function call;
        # examine its original input too, as in the frozen G4 tool boundary.
        if context.tool_use["input"] != {}:
            self.protocol_error = True
            raise ValueError("NO_MODEL_AUTHORITY_FIELDS_ALLOWED")
        self.events.append({"stage": "strands.tool_selected", "demo_run_id": self.run_id, "tool": name})

    def run(self) -> dict[str, Any]:
        context = self.backend.begin(self.run_id, self.operation_id)
        if context.get("demo_run_id") != self.run_id or context.get("operation_id") != self.operation_id:
            raise ValueError("TRUSTED_OPERATION_MISMATCH")
        if context.get("claimed") is False:
            return {"demo_run_id": self.run_id, "operation_id": self.operation_id,
                    "duplicate_suppressed": True, "model_invoked": False}
        if context.get("claimed") is not True:
            raise ValueError("TRUSTED_OPERATION_REQUIRED")
        try:
            return self.execute(context)
        except Exception:
            if context.get("kind") in {"SHOW_ENFORCEMENT_PROOF", "EXECUTE_APPROVED_CHANGE", "VERIFY_SINGLE_USE_PROTECTION"}:
                try:
                    projection = self.call("complete")
                    return {"demo_run_id": self.run_id, "operation_id": self.operation_id,
                            "projection": projection, "reconciled_from_durable_facts": True,
                            "gateway_result": None, "events": self.events}
                except Exception:
                    pass
            # Reconciliation disposition only. No new model run, authority,
            # decision context or blind effect retry is an error-recovery step.
            try:
                self.call("fail")
            except Exception:
                pass  # A failed settlement must not hide the original failure.
            raise

    def execute(self, context: dict[str, Any]) -> dict[str, Any]:
        kind = context.get("kind")
        if kind in {"SHOW_ENFORCEMENT_PROOF", "EXECUTE_APPROVED_CHANGE", "VERIFY_SINGLE_USE_PROTECTION"}:
            return self.execute_effect(context)
        if kind not in {"START", "ADVANCE_SYNTHETIC_VERIFICATION", "DECISION"}:
            raise ValueError("UNSUPPORTED_NATIVE_WORK_OPERATION")
        pending = deepcopy(context.get("pending"))
        response = deepcopy(context.get("response"))
        if kind == "DECISION":
            if (not isinstance(pending, dict) or pending.get("demo_run_id") != self.run_id
                    or not isinstance(response, dict) or set(response) != {"decision"}
                    or response["decision"] not in {"APPROVE_CANDIDATE", "REJECT_CANDIDATE"}):
                raise ValueError("TRUSTED_PENDING_DECISION_REQUIRED")
        elif pending is not None or response is not None:
            raise ValueError("NO_STANDING_HUMAN_DECISION")
        if kind == "ADVANCE_SYNTHETIC_VERIFICATION":
            self.call("verification_arrival")  # IAM operator event, never a model tool.
        read_observed = False
        work_observed = False
        accepted_in_tool = False
        native_pending = None

        @tool(context=True)
        def read_case(tool_context: ToolContext) -> dict[str, Any]:
            """Read this run's governed synthetic CASE-1042 status. No arguments."""
            nonlocal read_observed
            self.exact_tool(tool_context, "read_case")
            result = self.call("read_case")
            if result.get("demo_run_id") != self.run_id:
                raise ValueError("RUN_BINDING_MISMATCH")
            read_observed = True
            return result

        @tool(context=True)
        def prepare_case_work(tool_context: ToolContext) -> dict[str, Any]:
            """Evaluate the fixture invoice/PO and prepare independent verification. No evidence is invented."""
            nonlocal work_observed
            self.exact_tool(tool_context, "prepare_case_work")
            if kind != "START" or not read_observed:
                raise ValueError("ORDINARY_WORK_NOT_AVAILABLE")
            result = self.call("prepare_case_work")
            work_observed = result.get("ordinary_work_completed") is True
            return result

        @tool(context=True)
        def request_human_decision(tool_context: ToolContext) -> dict[str, Any]:
            """Request the exact server-derived card only when human authority is missing. No arguments."""
            nonlocal native_pending, accepted_in_tool
            self.exact_tool(tool_context, "request_human_decision")
            if not read_observed and kind != "DECISION":
                raise ValueError("READ_CASE_BEFORE_HUMAN_ATTENTION")
            view = self.call("read_case")
            if view.get("human_decision_eligible") is not True:
                return {"human_attention_required": False, "reason_code": "WAITING_FOR_INDEPENDENT_VERIFICATION"}
            card = view.get("decision_card")
            if not isinstance(card, dict) or card.get("demo_run_id") != self.run_id:
                raise ValueError("RUN_BOUND_CARD_REQUIRED")
            reason = {"decision_card": card, "decision_card_digest": digest(card)}
            try:
                choice = tool_context.interrupt(INTERRUPT_NAME, reason=reason)
            except InterruptException as interruption:
                if kind != "ADVANCE_SYNTHETIC_VERIFICATION":
                    raise ValueError("UNEXPECTED_NATIVE_INTERRUPT")
                native_pending = self.call("bind_interrupt", interrupt_id=interruption.interrupt.id)
                if (native_pending.get("demo_run_id") != self.run_id
                        or native_pending.get("interrupt_id") != interruption.interrupt.id
                        or native_pending.get("decision_card_digest") != reason["decision_card_digest"]):
                    raise ValueError("NATIVE_CARD_CHANGED_BEFORE_PERSISTENCE")
                raise
            if kind != "DECISION" or pending is None or canonical_json(choice) != canonical_json(response):
                raise ValueError("SESSION_STATE_IS_NOT_HUMAN_AUTHORITY")
            result = self.call("accept_decision", interrupt_id=pending["interrupt_id"], response=choice)
            if result.get("authority_status") != "NOT_DELEGATED" or result.get("decision") != response["decision"]:
                raise ValueError("DECISION_RECORD_NOT_CONFIRMED")
            accepted_in_tool = True
            return result

        budget = ModelBudget()
        agent = Agent(model=self.model, agent_id=AGENT_ID, session_manager=self.session_manager,
                      tools=[read_case, prepare_case_work, request_human_decision], hooks=[budget],
                      retry_strategy=None, callback_handler=None,
                      system_prompt="Operate only the current synthetic CASE-1042 run. First call read_case. "
                      "If next_action=PREPARE_CASE_WORK, call prepare_case_work and stop. "
                      "If next_action=REQUEST_HUMAN_DECISION, call request_human_decision. "
                      "Otherwise stop and wait. All tools take no arguments. Never invent evidence, eligibility, "
                      "a human response, identity, authority or effect. After a human choice is recorded, stop.")
        if kind == "DECISION":
            state = agent._interrupt_state.to_dict()
            restored = state.get("interrupts", {}).get(pending["interrupt_id"])
            if (not state.get("activated") or restored is None or restored.get("name") != INTERRUPT_NAME
                    or digest(restored.get("reason", {}).get("decision_card")) != pending["decision_card_digest"]):
                raise ValueError("NATIVE_RESTORATION_DOES_NOT_MATCH_ADMITTED_CARD")
            self.events.append({"stage": "strands.interrupt_restored", "demo_run_id": self.run_id,
                                "interrupt_id": pending["interrupt_id"]})
            result = agent([{"interruptResponse": {"interruptId": pending["interrupt_id"], "response": response}}])
            if not accepted_in_tool:
                raise ValueError("EXACT_INTERRUPTED_TOOL_DID_NOT_ACCEPT_HUMAN_CHOICE")
        else:
            result = agent("Read the current run and select its next exposed action. Stop at the runtime boundary.")
            if not read_observed or (kind == "START" and not work_observed):
                raise ValueError("STRANDS_DID_NOT_COMPLETE_ORDINARY_WORK")
            if kind == "ADVANCE_SYNTHETIC_VERIFICATION":
                if (result.stop_reason != "interrupt" or len(result.interrupts) != 1 or native_pending is None
                        or result.interrupts[0].id != native_pending["interrupt_id"]):
                    raise ValueError("ONE_DURABLY_BOUND_NATIVE_INTERRUPT_REQUIRED")
            elif result.stop_reason == "interrupt" or native_pending is not None:
                raise ValueError("PREMATURE_HUMAN_INTERRUPT")
        if self.protocol_error:
            raise ValueError("MODEL_ATTEMPTED_UNDECLARED_AUTHORITY_FIELDS")
        projection = self.call("complete")
        return {"demo_run_id": self.run_id, "operation_id": self.operation_id, "model_id": self.model.get_config().get("model_id"),
                "model_invoked": True, "model_calls": budget.calls, "stop_reason": result.stop_reason,
                "projection": projection, "events": self.events}

    def execute_effect(self, context: dict[str, Any]) -> dict[str, Any]:
        if self.effect_gateway is None:
            raise ValueError("GOVERNED_EFFECT_GATEWAY_REQUIRED")
        kind = context["kind"]
        arguments = self.call("effect_request")  # Exact trusted derivation; never model parameters.
        if arguments.get("demo_run_id") != self.run_id or "nonce" in arguments or "grant" in arguments:
            raise ValueError("INVALID_PUBLIC_EFFECT_REFERENCE")
        sent = False
        result = None
        def effect() -> Any:
            nonlocal sent, result
            if sent:
                if result is None:
                    raise ValueError("EFFECT_OUTCOME_UNCONFIRMED_NO_RETRY")
                return result
            sent = True  # Set before the network call, including unknown outcomes.
            result = self.effect_gateway.call(arguments)
            return result
        budget = ModelBudget()
        if kind == "EXECUTE_APPROVED_CHANGE":
            @tool(context=True)
            def execute_approved_change(tool_context: ToolContext) -> dict[str, Any]:
                """Continue this run's already approved exact single-use change. No arguments."""
                self.exact_tool(tool_context, "execute_approved_change")
                return effect()
            agent = Agent(model=self.model, agent_id=AGENT_ID + "-effect", tools=[execute_approved_change],
                          hooks=[budget], retry_strategy=None, callback_handler=None,
                          system_prompt="Call execute_approved_change once with no arguments, then stop. "
                          "The backend already holds an exact human-approved synthetic change. Never invent authority, "
                          "bank data, identity, inputs or payment. The Broker, not you, determines success.")
            agent("Continue the already-authorized exact synthetic vendor change through the governed tool.")
            if not sent or self.protocol_error:
                raise ValueError("STRANDS_DID_NOT_SELECT_EXACT_EFFECT_TOOL")
        else:
            effect()  # The fixed proof is an explicit IAM operator action, not a model invention.
        # Do not feed the result back as authority. The service independently reads
        # the Broker-owned proof or atomic receipt/vendor/consumption records.
        projection = self.call("complete")
        return {"demo_run_id": self.run_id, "operation_id": self.operation_id,
                "model_invoked": kind == "EXECUTE_APPROVED_CHANGE", "model_calls": budget.calls,
                "model_id": self.model.get_config().get("model_id") if kind == "EXECUTE_APPROVED_CHANGE" else None,
                "projection": projection, "events": self.events, "gateway_result": result}
