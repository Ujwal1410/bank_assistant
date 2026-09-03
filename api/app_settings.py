"""Runtime app settings (in-memory) — adjustable from admin without restart."""

from __future__ import annotations

import os
from threading import Lock

_lock = Lock()
VALID_SPEAKERS = frozenset({"Suresh", "Anu"})
_DEFAULT = os.environ.get("BANK_TTS_SPEAKER", "Suresh").strip()
if _DEFAULT.lower() == "anu":
    _DEFAULT = "Anu"
elif _DEFAULT.lower() != "suresh":
    _DEFAULT = "Suresh"
_speaker: str = _DEFAULT


def get_tts_speaker() -> str:
    with _lock:
        return _speaker


def set_tts_speaker(name: str) -> str:
    global _speaker
    raw = (name or "").strip()
    if raw.lower() == "anu":
        normalized = "Anu"
    elif raw.lower() == "suresh":
        normalized = "Suresh"
    else:
        raise ValueError(f"Unknown speaker {name!r}. Choose Suresh or Anu.")
    with _lock:
        _speaker = normalized
        os.environ["BANK_TTS_SPEAKER"] = normalized
    return normalized
