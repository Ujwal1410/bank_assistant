"""
Minimal TTS-only API for a dedicated GPU machine (Parler Suresh/Anu).

Usage (TTS box):
    .\\scripts\\run_tts_server.ps1

Expose via Cloudflare tunnel, then on the kiosk machine set:
    BANK_TTS_REMOTE_URL=https://tts.sarastralabs.com
    BANK_TTS_REMOTE_KEY=same-secret-as-TTS-box
"""

from __future__ import annotations

import asyncio
import os
import sys
from contextlib import asynccontextmanager

from dotenv import load_dotenv

_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
load_dotenv(dotenv_path=os.path.join(_ROOT, ".env"), override=True)

# TTS box: Parler only — no pipeline worker, no STT on GPU
os.environ.setdefault("BANK_TTS_ENGINE", "parler")
os.environ.setdefault("BANK_PIPELINE_WORKER", "0")
os.environ.setdefault("BANK_TTS_ALLOW_MMS", "0")
os.environ.setdefault("BANK_TTS_SPEAKER", "Suresh")
os.environ.setdefault("BANK_PARLER_DTYPE", "fp16")
os.environ.setdefault("BANK_PARLER_DO_SAMPLE", "1")
os.environ.setdefault("BANK_TTS_CACHE_MAX", "512")
# Never call remote TTS from the TTS service itself (would loop to localhost:8001).
os.environ.pop("BANK_TTS_REMOTE_URL", None)

from fastapi import Depends, FastAPI, Header, HTTPException  # noqa: E402
from pydantic import BaseModel, Field  # noqa: E402

from backend.tts.parler_bridge import (  # noqa: E402
    default_speaker,
    parler_available,
    parler_ready,
    parler_warm_error,
    stop_worker,
)
from backend.tts.speak_cache import get_cached_b64, kannada_to_b64  # noqa: E402
from backend.tts.warmup import warm_parler_service  # noqa: E402

_warm_stats: dict = {}


def _synth_b64(text: str, speaker: str | None) -> tuple[str, bool]:
    """Returns (audio_b64, cache_hit)."""
    sp = speaker or default_speaker()
    hit = get_cached_b64(text, speaker=sp)
    if hit:
        return hit, True
    prev = os.environ.get("BANK_TTS_SPEAKER")
    os.environ["BANK_TTS_SPEAKER"] = sp
    try:
        b64 = kannada_to_b64(text)
    finally:
        if prev is None:
            os.environ.pop("BANK_TTS_SPEAKER", None)
        else:
            os.environ["BANK_TTS_SPEAKER"] = prev
    return b64, False


@asynccontextmanager
async def _lifespan(_app: FastAPI):
    """Block server accept until Parler is loaded and lobby phrases are cached."""
    global _warm_stats
    print(
        "[tts-server] Loading Parler FP16 model + caching phrases "
        "(first start may take 1–2 minutes)…",
        file=sys.stderr,
        flush=True,
    )
    _warm_stats = await asyncio.to_thread(
        warm_parler_service,
        extra_phrases=(
            "ದಯವಿಟ್ಟು ಮತ್ತೆ ಹೇಳಿ",
            "ದಯವಿಟ್ಟು ಸಂಖ್ಯೆ ಅಥವಾ ಅರ್ಜಿ ಹೆಸರು ಹೇಳಿ",
            "ನಿಮ್ಮ ಅರ್ಜಿ ಸಿದ್ಧ.",
            "ಪ್ರಿಂಟ್ ಮಾಡಬಹುದು.",
        ),
    )
    if _warm_stats.get("ok"):
        print(
            f"[tts-server] Ready — speaker={_warm_stats.get('speaker')} "
            f"phrases={_warm_stats.get('phrases_cached')} "
            f"elapsed={_warm_stats.get('elapsed_s')}s",
            file=sys.stderr,
            flush=True,
        )
    else:
        print(
            f"[tts-server] WARN: warmup incomplete — {_warm_stats.get('error')}",
            file=sys.stderr,
            flush=True,
        )
    yield
    stop_worker()


app = FastAPI(title="Kannada TTS Service (Parler)", version="1.0.0", lifespan=_lifespan)


class SpeakBody(BaseModel):
    text: str = Field(..., min_length=1, max_length=2000)
    speaker: str | None = Field(default=None, description="Suresh or Anu")


def _require_key(x_bank_tts_key: str | None = Header(default=None, alias="X-Bank-Tts-Key")) -> None:
    expected = os.environ.get("BANK_TTS_REMOTE_KEY", "").strip()
    if expected and x_bank_tts_key != expected:
        raise HTTPException(status_code=401, detail="Invalid TTS API key")


@app.get("/api/health/live")
def health_live() -> dict:
    """Fast liveness — no GPU work."""
    return {"status": "ok", "live": True, "service": "tts"}


@app.get("/api/health")
def health() -> dict:
    ready = parler_ready()
    status = "ready" if ready else ("warming" if parler_available() else "unavailable")
    return {
        "status": status,
        "service": "tts",
        "parler": parler_available(),
        "ready": ready,
        "speaker": default_speaker(),
        "warmup": _warm_stats,
        "error": parler_warm_error(),
    }


@app.post("/api/speak-kannada")
async def speak_kannada(body: SpeakBody, _: None = Depends(_require_key)) -> dict:
    text = body.text.strip()
    if not text:
        raise HTTPException(status_code=400, detail="Empty text")
    if not parler_available():
        raise HTTPException(
            status_code=503,
            detail="Parler TTS not available on this machine",
        )
    if not parler_ready():
        raise HTTPException(
            status_code=503,
            detail="Parler is still warming up — retry in a few seconds",
        )

    speaker = (body.speaker or "").strip() or None
    try:
        audio_b64, cached = await asyncio.to_thread(_synth_b64, text, speaker)
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"TTS failed: {exc}") from exc

    if not audio_b64:
        raise HTTPException(status_code=500, detail="TTS returned empty audio")
    return {
        "text": text,
        "audio_b64": audio_b64,
        "speaker": speaker or default_speaker(),
        "engine": "indic-parler-tts",
        "cached": cached,
    }
