from __future__ import annotations

import asyncio
import json
import os
from datetime import datetime, timezone
from pathlib import Path
from typing import Any, Dict, List, Optional

from dotenv import load_dotenv
from fastapi import FastAPI, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from pydantic import BaseModel, Field

from ai_agent import analyze_invoice, local_analyze, require_nvidia_key

BASE_DIR = Path(__file__).resolve().parent
load_dotenv(BASE_DIR / ".env")
INVOICES_PATH = BASE_DIR / "invoices.json"
CACHE_PATH = BASE_DIR / "analysis_cache.json"

app = FastAPI(
    title="Alfred Mini",
    description="Human-in-the-loop accounts receivable assistant",
    version="1.0.0",
)

_extra_origins = [
    origin.strip()
    for origin in os.getenv("ALLOWED_ORIGINS", "").split(",")
    if origin.strip()
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=[
        "http://localhost:3000",
        "http://127.0.0.1:3000",
        *_extra_origins,
    ],
    allow_origin_regex=r"https://.*\.vercel\.app",
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

_cache_lock = asyncio.Lock()
_analyze_lock = asyncio.Lock()


class ApproveRequest(BaseModel):
    draftEmail: Optional[str] = Field(default=None)


def _read_json(path: Path, default: Any) -> Any:
    if not path.exists():
        return default
    with path.open("r", encoding="utf-8") as handle:
        return json.load(handle)


def _write_json(path: Path, data: Any) -> None:
    with path.open("w", encoding="utf-8") as handle:
        json.dump(data, handle, indent=2)
        handle.write("\n")


def load_invoices() -> List[dict]:
    invoices = _read_json(INVOICES_PATH, [])
    if not isinstance(invoices, list):
        raise HTTPException(status_code=500, detail="invoices.json is invalid.")
    return invoices


def save_invoices(invoices: List[dict]) -> None:
    _write_json(INVOICES_PATH, invoices)


def load_cache() -> Dict[str, dict]:
    cache = _read_json(CACHE_PATH, {})
    return cache if isinstance(cache, dict) else {}


def save_cache(cache: Dict[str, dict]) -> None:
    _write_json(CACHE_PATH, cache)


def merge_invoice(invoice: dict, analysis: Optional[dict] = None) -> dict:
    merged = {
        "id": invoice["id"],
        "customerName": invoice["customerName"],
        "amount": invoice["amount"],
        "dueDate": invoice["dueDate"],
        "daysOverdue": invoice["daysOverdue"],
        "status": invoice.get("status", "Overdue"),
        "approvedAt": invoice.get("approvedAt"),
        "priority": None,
        "reason": None,
        "draftEmail": None,
    }
    if analysis:
        merged["priority"] = analysis.get("priority")
        merged["reason"] = analysis.get("reason")
        merged["draftEmail"] = analysis.get("draftEmail")
    return merged


def is_complete(analysis: Optional[dict]) -> bool:
    return bool(
        analysis
        and analysis.get("priority")
        and analysis.get("reason")
        and analysis.get("draftEmail")
    )


def sort_invoices(invoices: List[dict]) -> List[dict]:
    priority_rank = {"High": 0, "Medium": 1, "Low": 2}
    invoices.sort(
        key=lambda item: (
            1 if item["status"] == "Approved" else 0,
            priority_rank.get(item.get("priority") or "", 3),
            -int(item.get("daysOverdue") or 0),
        )
    )
    return invoices


@app.get("/")
def root() -> dict:
    return {
        "name": "Alfred Mini — Finance Assistant",
        "docs": "/docs",
        "invoices": "/invoices",
    }


@app.get("/invoices")
async def get_invoices() -> List[dict]:
    invoices = load_invoices()
    cache = load_cache()
    dirty = False
    merged = []
    for invoice in invoices:
        analysis = cache.get(invoice["id"])
        if not is_complete(analysis):
            analysis = local_analyze(invoice)
            cache[invoice["id"]] = analysis
            dirty = True
        merged.append(merge_invoice(invoice, analysis))
    if dirty:
        save_cache(cache)
    return sort_invoices(merged)


@app.post("/invoices/{invoice_id}/analyze")
async def analyze_one(invoice_id: str) -> dict:
    invoices = load_invoices()
    target = next((item for item in invoices if item["id"] == invoice_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} was not found.")

    async with _cache_lock:
        cache = load_cache()
        existing = cache.get(invoice_id)
        if is_complete(existing):
            return merge_invoice(target, existing)

    try:
        require_nvidia_key()
        async with _analyze_lock:
            analysis = await asyncio.to_thread(analyze_invoice, target)
    except RuntimeError as exc:
        raise HTTPException(status_code=503, detail=str(exc)) from exc
    except Exception as exc:
        raise HTTPException(
            status_code=502,
            detail=f"Alfred could not analyze {invoice_id}: {exc}",
        ) from exc

    async with _cache_lock:
        cache = load_cache()
        cache[invoice_id] = analysis
        save_cache(cache)
    return merge_invoice(target, analysis)


@app.post("/invoices/{invoice_id}/approve")
async def approve_invoice(invoice_id: str, body: Optional[ApproveRequest] = None) -> dict:
    invoices = load_invoices()
    target = next((item for item in invoices if item["id"] == invoice_id), None)
    if target is None:
        raise HTTPException(status_code=404, detail=f"Invoice {invoice_id} was not found.")

    stamp = datetime.now(timezone.utc).isoformat(timespec="seconds")
    target["status"] = "Approved"
    target["approvedAt"] = stamp
    save_invoices(invoices)

    async with _cache_lock:
        cache = load_cache()
        analysis = cache.get(invoice_id, {})
        edited = (body.draftEmail if body else None) or None
        if edited is not None:
            analysis = {**analysis, "draftEmail": edited}
            cache[invoice_id] = analysis
            save_cache(cache)

    return merge_invoice(target, analysis)


if __name__ == "__main__":
    import uvicorn

    uvicorn.run(
        "main:app",
        host="0.0.0.0",
        port=int(os.getenv("PORT", "8000")),
        reload=False,
    )
