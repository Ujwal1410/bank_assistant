"""Runtime app settings (in-memory) — adjustable from admin without restart."""

from __future__ import annotations

import json
import os
from threading import Lock

_lock = Lock()
VALID_SPEAKERS = frozenset({"Suresh", "Anu"})

_PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
_SETTINGS_PATH = os.environ.get(
    "BANK_RUNTIME_SETTINGS_FILE",
    os.path.join(_PROJECT_ROOT, "data", "runtime_settings.json"),
)


def _normalise_speaker(name: str) -> str:
    raw = (name or "").strip().lower()
    if raw == "anu":
        return "Anu"
    if raw == "suresh":
        return "Suresh"
    raise ValueError(f"Unknown speaker {name!r}. Choose Suresh or Anu.")


def _load_saved_speaker() -> str | None:
    try:
        with open(_SETTINGS_PATH, encoding="utf-8") as handle:
            payload = json.load(handle)
        return _normalise_speaker(str(payload.get("speaker") or ""))
    except (OSError, ValueError, TypeError, json.JSONDecodeError):
        return None


_DEFAULT = _load_saved_speaker()
if _DEFAULT is None:
    try:
        _DEFAULT = _normalise_speaker(os.environ.get("BANK_TTS_SPEAKER", "Suresh"))
    except ValueError:
        _DEFAULT = "Suresh"
_speaker: str = _DEFAULT
os.environ["BANK_TTS_SPEAKER"] = _speaker


def get_tts_speaker() -> str:
    with _lock:
        return _speaker


def set_tts_speaker(name: str) -> str:
    global _speaker
    normalized = _normalise_speaker(name)
    with _lock:
        _speaker = normalized
        os.environ["BANK_TTS_SPEAKER"] = normalized
        settings_dir = os.path.dirname(_SETTINGS_PATH)
        if settings_dir:
            os.makedirs(settings_dir, exist_ok=True)
        temporary = f"{_SETTINGS_PATH}.{os.getpid()}.tmp"
        with open(temporary, "w", encoding="utf-8") as handle:
            json.dump({"speaker": normalized}, handle)
        os.replace(temporary, _SETTINGS_PATH)
    return normalized
