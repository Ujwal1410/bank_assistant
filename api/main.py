"""
FastAPI server for the Kannada Voice Banking Assistant.

Usage:
    uvicorn api.main:app --reload --port 8000
"""

from __future__ import annotations

import os

# Load .env from project root BEFORE any backend imports
from dotenv import load_dotenv as _load_dotenv
_load_dotenv(dotenv_path=os.path.join(os.path.dirname(os.path.dirname(__file__)), ".env"), override=True)

from fastapi import FastAPI, Request
from fastapi.middleware.cors import CORSMiddleware
from fastapi.responses import JSONResponse

from api.cors_config import cors_middleware_kwargs

from backend.cuda_runtime import ensure_compatible_cudnn

ensure_compatible_cudnn()

from api.history import init_db
from api.routes import admin, balance, forms, history, kiosk, landing, pipeline

os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")
os.environ.setdefault("HF_HUB_OFFLINE", "1")
os.environ.setdefault("HF_DATASETS_OFFLINE", "1")
# TTS: auto tries Parler (natural Kannada) then MMS (offline fallback).
_tts = os.environ.get("BANK_TTS_ENGINE", "mms").strip().lower()
os.environ["BANK_TTS_ENGINE"] = _tts
os.environ.setdefault("BANK_TTS_ALLOW_MMS", "1")
os.environ.setdefault("BANK_TTS_SPEAKER", "Suresh")

app = FastAPI(title="Kannada Voice Banking API", version="1.0.0")

app.add_middleware(CORSMiddleware, **cors_middleware_kwargs())


@app.exception_handler(Exception)
async def _unhandled_exception(_request: Request, exc: Exception) -> JSONResponse:
    """Consistent JSON for unexpected server errors."""
    import sys

    print(f"[api] unhandled: {exc}", file=sys.stderr)
    return JSONResponse(
        status_code=500,
        content={"error": str(exc), "detail": "Internal server error"},
    )

app.include_router(pipeline.router, prefix="/api")
app.include_router(balance.router, prefix="/api")
app.include_router(history.router, prefix="/api")
app.include_router(landing.router, prefix="/api")
app.include_router(forms.router, prefix="/api")
app.include_router(kiosk.router, prefix="/api")
app.include_router(admin.router, prefix="/api")


@app.on_event("startup")
def _startup() -> None:
    init_db()
    from backend.pipeline_bridge import warm_pipeline, worker_enabled

    warm_on_start = os.environ.get("BANK_PIPELINE_WARM_ON_START", "1").strip().lower()
    if not worker_enabled() or warm_on_start in {"0", "false", "off", "no"}:
        return
    try:
        result = warm_pipeline()
        print(
            f"[startup] pipeline ready model={result.get('model')} "
            f"stages={result.get('stage_times')}"
        )
    except Exception as exc:
        import sys

        print(f"[startup] pipeline pre-warm failed: {exc}", file=sys.stderr)


@app.on_event("shutdown")
def _shutdown() -> None:
    try:
        from backend.pipeline_bridge import stop_worker

        stop_worker()
    except Exception:
        pass
    try:
        from backend.tts.parler_bridge import stop_worker as stop_parler

        stop_parler()
    except Exception:
        pass


@app.get("/api/health/live")
def health_live() -> dict:
    """Fast liveness probe — no TTS/STT checks (used by frontend online indicator)."""
    return {"status": "ok", "live": True}


@app.get("/api/health")
def health() -> dict:
    from backend.db.store import mongo_enabled, ping_mongo
    from backend.tts import parler_status

    mongo = "disabled"
    if mongo_enabled():
        mongo = "connected" if ping_mongo() else "error"

    tts_info = parler_status()
    pipeline_worker = os.environ.get("BANK_PIPELINE_WORKER", "1").strip().lower() not in {
        "0",
        "false",
        "off",
        "no",
    }

    status = "ok"
    remote = tts_info.get("remote") or {}
    if remote.get("configured"):
        if not remote.get("healthy"):
            status = "degraded"
        elif not tts_info.get("ready"):
            status = "warming"

    return {
        "status": status,
        "mongodb": mongo,
        "pipeline_worker": pipeline_worker,
        "tts": tts_info,
    }
