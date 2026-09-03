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
    import threading
    from backend.pipeline_bridge import worker_enabled, _start_locked, _lock

    def _warm_pipeline() -> None:
        if not worker_enabled():
            return
        try:
            with _lock:
                _start_locked()
        except Exception as exc:
            import sys
            print(f"[startup] pipeline worker pre-warm failed: {exc}", file=sys.stderr)

    def _warm_phrases() -> None:
        """Pre-cache common Kannada TTS clips after pipeline / remote TTS is ready."""
        import sys
        import time

        from backend.tts.remote_bridge import remote_tts_configured

        if remote_tts_configured():
            from backend.tts.warmup import warm_via_remote_phrases

            result = warm_via_remote_phrases(
                extra_phrases=("ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ", "ದಯವಿಟ್ಟು ನಿಮ್ಮ ಖಾತೆ ಸಂಖ್ಯೆಯನ್ನು ಹೇಳಿ"),
            )
            if not result.get("ok"):
                print(f"[startup] remote TTS pre-warm failed: {result.get('error')}", file=sys.stderr)
            try:
                from backend.greet_warm import warm_first_greeting_variants

                warm_first_greeting_variants()
            except Exception as exc:
                print(f"[startup] greeting WAV warm failed: {exc}", file=sys.stderr)
            return

        from backend.pipeline_bridge import worker_enabled, _lock, _ready, _start_locked

        # Wait for pipeline worker before loading local TTS on GPU (avoids VRAM race).
        if worker_enabled():
            for _ in range(90):
                with _lock:
                    if _ready:
                        break
                time.sleep(1)
            else:
                try:
                    with _lock:
                        _start_locked()
                    time.sleep(5)
                except Exception as exc:
                    print(f"[startup] pipeline not ready for TTS prewarm: {exc}", file=sys.stderr)
        else:
            time.sleep(2)

        try:
            from backend.tts.warmup import warm_parler_service

            result = warm_parler_service(
                extra_phrases=("ದಯವಿಟ್ಟು ನಿಮ್ಮ ಖಾತೆ ಸಂಖ್ಯೆಯನ್ನು ಹೇಳಿ",),
            )
            if result.get("ok"):
                print(
                    f"[startup] local Parler ready; cached {result.get('phrases_cached')} phrase(s)",
                    file=sys.stderr,
                )
            else:
                print(f"[startup] local Parler pre-warm failed: {result.get('error')}", file=sys.stderr)
        except Exception as exc:
            print(f"[startup] TTS phrase pre-warm failed: {exc}", file=sys.stderr)

    threading.Thread(target=_warm_pipeline, daemon=True, name="pipeline-warmup").start()
    threading.Thread(target=_warm_phrases, daemon=True, name="tts-phrase-warmup").start()


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
