"""In-memory cache for Kannada TTS clips (Parler) — avoids re-synth on repeats."""

from __future__ import annotations

import base64
import hashlib
import io
import os
import sys
from typing import Callable

_CACHE: dict[str, str] = {}


def _max_cache_entries() -> int:
    try:
        return max(32, int(os.environ.get("BANK_TTS_CACHE_MAX", "160")))
    except ValueError:
        return 160


def _cache_key(text: str, speaker: str | None = None) -> str:
    sp = (speaker or os.environ.get("BANK_TTS_SPEAKER", "")).strip()
    payload = f"{sp}\0{(text or '').strip()}"
    return hashlib.sha256(payload.encode("utf-8")).hexdigest()[:20]


def get_cached_b64(text: str, *, speaker: str | None = None) -> str | None:
    if not text or not text.strip():
        return None
    return _CACHE.get(_cache_key(text, speaker))


def put_cached_b64(text: str, audio_b64: str, *, speaker: str | None = None) -> None:
    if not text.strip() or not audio_b64:
        return
    key = _cache_key(text, speaker)
    max_entries = _max_cache_entries()
    if key not in _CACHE and len(_CACHE) >= max_entries:
        _CACHE.pop(next(iter(_CACHE)))
    _CACHE[key] = audio_b64


def kannada_to_b64(text: str, *, free_vram: Callable[[], None] | None = None) -> str:
    """Synthesise Kannada text to base64 WAV; uses LRU-style cache."""
    text = (text or "").strip()
    if not text:
        return ""

    from backend.tts.remote_bridge import fetch_kannada_b64_remote, remote_tts_configured

    engine = os.environ.get("BANK_TTS_ENGINE", "mms").strip().lower()
    from backend.tts.parler_bridge import parler_available

    use_parler = engine in {"parler", "indic-parler"} or (
        engine == "auto" and parler_available()
    )

    try:
        from api.app_settings import get_tts_speaker

        speaker = get_tts_speaker()
    except Exception:
        speaker = os.environ.get("BANK_TTS_SPEAKER", "Suresh")

    hit = get_cached_b64(text, speaker=speaker if (use_parler or remote_tts_configured()) else None)
    if hit:
        return hit

    # Split deploy: kiosk must use remote GPU box — never load local Parler here.
    if remote_tts_configured() and engine in {"parler", "indic-parler", "auto", "remote"}:
        print(
            f"[tts] remote speak → {os.environ.get('BANK_TTS_REMOTE_URL', '').rstrip('/')} "
            f"speaker={speaker}",
            file=sys.stderr,
            flush=True,
        )
        b64 = fetch_kannada_b64_remote(text, speaker=speaker)
        if not b64:
            raise RuntimeError(
                "Remote TTS returned empty audio. Check https://tts.sarastralabs.com/api/health"
            )
        put_cached_b64(text, b64, speaker=speaker)
        return b64

    if use_parler and free_vram is not None:
        free_vram()

    from backend.tts import synthesise_kannada

    result = synthesise_kannada(text)
    if result is None:
        return ""

    audio, sr = result
    from backend.tts.audio_util import trim_trailing_silence

    audio = trim_trailing_silence(audio, sr)
    buf = io.BytesIO()
    import soundfile as sf

    sf.write(buf, audio, sr, format="WAV")
    b64 = base64.b64encode(buf.getvalue()).decode("ascii")
    put_cached_b64(text, b64, speaker=speaker if use_parler else None)
    return b64


def prewarm_phrases(phrases: tuple[str, ...] | list[str], *, free_vram: Callable[[], None] | None = None) -> int:
    """Pre-synthesise common phrases; returns count cached."""
    n = 0
    for phrase in phrases:
        if not phrase or not phrase.strip():
            continue
        if get_cached_b64(phrase):
            n += 1
            continue
        if kannada_to_b64(phrase, free_vram=free_vram):
            n += 1
    return n
