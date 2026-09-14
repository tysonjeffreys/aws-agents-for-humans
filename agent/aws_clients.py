"""Bounded SigV4-only transport; URLs are trusted deployment configuration."""
from __future__ import annotations

import json
import re
import uuid
from typing import Any
from urllib.error import HTTPError
from urllib.parse import urlparse
from urllib.request import Request, build_opener, HTTPRedirectHandler

import boto3
from botocore.auth import SigV4Auth
from botocore.awsrequest import AWSRequest


class NoRedirect(HTTPRedirectHandler):
    def redirect_request(self, request, fp, code, msg, headers, newurl):
        raise ValueError("SIGNED_AWS_REDIRECT_FORBIDDEN")


class SignedHttp:
    def __init__(self, url: str, service: str, *, session: Any = None, opener: Any = None) -> None:
        parsed = urlparse(url)
        host = (r"[a-z0-9]+\.lambda-url\.us-west-2\.on\.aws" if service == "lambda" else
                r"[a-z0-9-]+\.gateway\.bedrock-agentcore\.us-west-2\.amazonaws\.com")
        path = "/internal/work" if service == "lambda" else "/mcp"
        if (service not in {"lambda", "bedrock-agentcore"} or parsed.scheme != "https" or
                not re.fullmatch(host, parsed.hostname or "") or parsed.username or parsed.password or
                parsed.port not in (None, 443) or parsed.path != path or parsed.query or parsed.fragment):
            raise ValueError("EXACT_AWS_HTTPS_ENDPOINT_REQUIRED")
        self.url, self.service = url, service
        self.session, self.opener = session or boto3.Session(region_name="us-west-2"), opener or build_opener(NoRedirect()).open

    def post(self, payload: dict[str, Any]) -> tuple[int, Any, str | None]:
        data = json.dumps(payload, separators=(",", ":")).encode()
        signed = AWSRequest(method="POST", url=self.url, data=data,
            headers={"Content-Type": "application/json", "Accept": "application/json, text/event-stream"})
        SigV4Auth(self.session.get_credentials().get_frozen_credentials(), self.service, "us-west-2").add_auth(signed)
        try:
            response = self.opener(Request(self.url, data=data, headers=dict(signed.headers)), timeout=120)
        except HTTPError as error:
            response = error
        with response:
            raw_bytes = response.read(1048577)
            if len(raw_bytes) > 1048576:
                raise ValueError("AWS_RESPONSE_LIMIT_EXCEEDED")
            raw = raw_bytes.decode()
            status = response.status
            request_id = response.headers.get("x-amzn-requestid", response.headers.get("x-amzn-request-id"))
        try:
            body = json.loads(raw)
        except json.JSONDecodeError:
            candidates = [json.loads(line[5:].strip()) for line in raw.splitlines() if line.startswith("data:")]
            replies = [value for value in candidates if "result" in value or "error" in value]
            if len(replies) != 1:
                raise ValueError("UNCONFIRMED_GATEWAY_STREAM")
            body = replies[0]
        return status, body, request_id


class WorkBackend:
    def __init__(self, client: SignedHttp) -> None:
        self.client = client

    def begin(self, run_id: str, operation_id: str) -> Any:
        return self.call(run_id, operation_id, "begin", {})

    def call(self, run_id: str, operation_id: str, action: str, args: dict[str, Any]) -> Any:
        status, body, _ = self.client.post({"demo_run_id": run_id, "operation_id": operation_id, "action": action, "args": args})
        if status != 200:
            raise ValueError(body.get("reason_code", "WORK_OUTCOME_UNCONFIRMED"))
        return body


class EffectGateway:
    def __init__(self, client: SignedHttp) -> None:
        self.client = client

    def call(self, arguments: dict[str, Any]) -> dict[str, Any]:
        message_id = "g45b-" + uuid.uuid4().hex
        status, body, request_id = self.client.post({"jsonrpc": "2.0", "id": message_id, "method": "tools/call",
            "params": {"name": "DemoVendorEffectBroker___commit_vendor_bank_change", "arguments": arguments}})
        result = None
        for entry in body.get("result", {}).get("content", []):
            if entry.get("type") == "text":
                try:
                    candidate = json.loads(entry["text"])
                    if isinstance(candidate, dict) and "decision" in candidate:
                        result = candidate
                except json.JSONDecodeError:
                    pass
        return {"http_status": status, "aws_request_id": request_id, "mcp_message_id": message_id, "broker_result": result}
