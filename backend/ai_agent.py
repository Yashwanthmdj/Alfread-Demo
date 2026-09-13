from __future__ import annotations

import json
import os
import re
import time
from pathlib import Path
from typing import Literal

from dotenv import load_dotenv
from langchain_core.prompts import ChatPromptTemplate
from langchain_nvidia_ai_endpoints import ChatNVIDIA
from pydantic import BaseModel, Field, field_validator

load_dotenv(Path(__file__).resolve().parent / ".env")

Priority = Literal["High", "Medium", "Low"]
DEFAULT_MODEL = "nvidia/nemotron-3.5-lightning-30b-a3b"
FALLBACK_MODELS = (
    "nvidia/nemotron-3.5-lightning-30b-a3b",
    "nvidia/nemotron-3-super-120b-a12b",
    "nvidia/nemotron-3-nano-30b-a3b",
)
_working_model = None


class InvoiceAnalysis(BaseModel):
    priority: Priority = Field(
        description="Collection priority: High, Medium, or Low."
    )
    reason: str = Field(
        description="One sentence explaining why this priority was assigned."
    )
    draftEmail: str = Field(
        description="Short, polite, professional payment reminder email."
    )

    @field_validator("priority", mode="before")
    @classmethod
    def normalize_priority(cls, value: str) -> str:
        if not isinstance(value, str):
            return value
        cleaned = value.strip().title()
        aliases = {"Hi": "High", "Med": "Medium", "Lo": "Low"}
        return aliases.get(cleaned, cleaned)


SYSTEM_PROMPT = """You are Alfred, an accounts receivable assistant.

Analyze one overdue invoice and return a single JSON object only.
Do not wrap it in markdown. Do not add commentary.

JSON shape:
{{
  "priority": "High" | "Medium" | "Low",
  "reason": "one sentence",
  "draftEmail": "short email body"
}}

priority rules:
- High: large balance (about $40,000+) or long overdue (about 30+ days), especially both
- Medium: moderate balance or a mid-range delay
- Low: small balance and only a few days late

reason: exactly one specific sentence. Mention the customer, amount, and days overdue.

draftEmail: a short payment reminder (4–7 sentences). Tone is polite, calm, and professional.
Include the customer name, invoice id, amount (USD), due date, and days overdue.
Do not threaten legal action. Do not offer a discount. Do not invent extra facts.
Sign as Accounts Receivable, Alfred Mini."""


def require_nvidia_key() -> str:
    key = (os.getenv("NVIDIA_API_KEY") or "").strip()
    if not key:
        raise RuntimeError(
            "NVIDIA_API_KEY is missing. Open backend/.env, paste your NVIDIA API key "
            "(it usually starts with nvapi-), and restart the server."
        )
    return key


def _message_text(result) -> str:
    content = getattr(result, "content", result)
    if isinstance(content, list):
        parts = []
        for block in content:
            if isinstance(block, dict):
                parts.append(block.get("text") or "")
            else:
                text = getattr(block, "text", None)
                parts.append(text if text is not None else str(block))
        return "".join(parts)
    return str(content)


def _parse_analysis(raw) -> dict:
    if isinstance(raw, InvoiceAnalysis):
        return raw.model_dump()
    if isinstance(raw, dict):
        return InvoiceAnalysis.model_validate(raw).model_dump()

    text = _message_text(raw).strip()
    fenced = re.search(r"```(?:json)?\s*([\s\S]*?)```", text)
    if fenced:
        text = fenced.group(1).strip()
    else:
        start = text.find("{")
        end = text.rfind("}")
        if start != -1 and end != -1:
            text = text[start : end + 1]
    return InvoiceAnalysis.model_validate_json(text).model_dump()


def _candidate_models() -> list:
    preferred = (os.getenv("NVIDIA_MODEL") or DEFAULT_MODEL).strip()
    models = []
    for name in (preferred, *FALLBACK_MODELS):
        if name and name not in models:
            models.append(name)
    return models


def _error_text(exc: Exception) -> str:
    return str(exc).lower()


def _is_retired_model_error(exc: Exception) -> bool:
    text = _error_text(exc)
    return "[410]" in text or "end of life" in text or "no longer available" in text


def _is_transient_error(exc: Exception) -> bool:
    text = _error_text(exc)
    return any(
        token in text
        for token in (
            "503",
            "overloaded",
            "temporarily",
            "timeout",
            "429",
            "rate limit",
            "too many requests",
            "service unavailable",
        )
    )


def _build_llm(model_name: str) -> ChatNVIDIA:
    return ChatNVIDIA(
        model=model_name,
        nvidia_api_key=require_nvidia_key(),
        temperature=0.2,
        max_tokens=700,
    )


def _analyze_with_model(invoice: dict, model_name: str) -> dict:
    payload = {
        "id": invoice["id"],
        "customerName": invoice["customerName"],
        "amount": invoice["amount"],
        "dueDate": invoice["dueDate"],
        "daysOverdue": invoice["daysOverdue"],
        "status": invoice.get("status", "Overdue"),
    }
    prompt = ChatPromptTemplate.from_messages(
        [
            ("system", SYSTEM_PROMPT),
            (
                "human",
                "Analyze this overdue invoice and draft a reminder:\n{invoice_json}",
            ),
        ]
    )
    result = (prompt | _build_llm(model_name)).invoke(
        {"invoice_json": json.dumps(payload, indent=2)}
    )
    return _parse_analysis(result)


def local_analyze(invoice: dict) -> dict:
    amount = float(invoice.get("amount") or 0)
    days = int(invoice.get("daysOverdue") or 0)
    name = invoice["customerName"]
    invoice_id = invoice["id"]
    due = invoice["dueDate"]
    dollars = f"${amount:,.0f}"

    if amount >= 40000 or days >= 30:
        priority = "High"
        reason = (
            f"{name} has {dollars} outstanding for {days} days, "
            "so this should be worked first."
        )
    elif amount >= 10000 or days >= 10:
        priority = "Medium"
        reason = (
            f"{name} is {days} days past due on {dollars} "
            "and needs a timely reminder."
        )
    else:
        priority = "Low"
        reason = (
            f"{name} is only {days} days late on a smaller balance of {dollars}."
        )

    draft_email = (
        f"Dear {name} Accounts Payable,\n\n"
        f"I hope you are well. I am writing about invoice {invoice_id} for {dollars}, "
        f"which was due on {due} and is now {days} days overdue.\n\n"
        "Please arrange payment at your earliest convenience, or let us know if this "
        "invoice is already in process. We are happy to resend the original invoice "
        "or supporting documents if that would help.\n\n"
        "Thank you for your partnership.\n\n"
        "Kind regards,\n"
        "Accounts Receivable\n"
        "Alfred Mini"
    )
    return {"priority": priority, "reason": reason, "draftEmail": draft_email}


def analyze_invoice(invoice: dict) -> dict:
    """Return {priority, reason, draftEmail}, using NVIDIA when it responds quickly."""
    global _working_model
    models = _candidate_models()
    if _working_model:
        models = [_working_model] + [name for name in models if name != _working_model]

    if not (os.getenv("NVIDIA_API_KEY") or "").strip():
        return local_analyze(invoice)

    for model_name in models[:1]:
        try:
            analysis = _analyze_with_model(invoice, model_name)
            _working_model = model_name
            return analysis
        except Exception:
            _working_model = None
            break

    return local_analyze(invoice)
