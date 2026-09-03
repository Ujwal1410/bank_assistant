"""
Bridge to the long-lived pipeline worker (warm STT / translation / NLU / TTS).

Falls back to one-shot subprocess if BANK_PIPELINE_WORKER=0.
"""
from __future__ import annotations

import json
import os
import subprocess
import sys
import threading
from typing import Any

_HERE = os.path.dirname(os.path.abspath(__file__))
PROJECT_ROOT = os.path.dirname(_HERE)
WORKER_SCRIPT = os.path.join(PROJECT_ROOT, "run_pipeline_worker.py")

_lock = threading.Lock()
_proc: subprocess.Popen[str] | None = None
_ready = False


def worker_enabled() -> bool:
    flag = os.environ.get("BANK_PIPELINE_WORKER", "1").strip().lower()
    return flag not in {"0", "false", "off", "no"}


def _read_json_line(stdout) -> dict[str, Any]:
    """Read stdout until a JSON object line (skip torch/triton noise)."""
    while True:
        line = stdout.readline()
        if not line:
            raise RuntimeError("Pipeline worker died (no output)")
        line = line.strip()
        if not line:
            continue
        if not line.startswith("{"):
            # e.g. "import error: No module named 'triton'"
            continue
        try:
            return json.loads(line)
        except json.JSONDecodeError:
            continue


def _extract_json_payload(text: str) -> dict[str, Any]:
    """Parse JSON from mixed stdout (noise lines + one JSON object)."""
    text = (text or "").strip()
    if not text:
        raise RuntimeError("empty pipeline output")
    # Prefer last JSON object in output
    for chunk in reversed(text.splitlines()):
        chunk = chunk.strip()
        if chunk.startswith("{") and chunk.endswith("}"):
            try:
                return json.loads(chunk)
            except json.JSONDecodeError:
                continue
    # Fallback: find first { … last }
    start = text.find("{")
    end = text.rfind("}")
    if start >= 0 and end > start:
        return json.loads(text[start : end + 1])
    raise RuntimeError(f"no JSON in pipeline output: {text[:200]}")


def _start_locked() -> None:
    global _proc, _ready
    if _proc is not None and _proc.poll() is None and _ready:
        return
    env = {
        **os.environ,
        "TRANSFORMERS_OFFLINE": "1",
        "HF_HUB_OFFLINE": "1",
        "HF_DATASETS_OFFLINE": "1",
        "BANK_PIPELINE_KEEP_LOADED": os.environ.get("BANK_PIPELINE_KEEP_LOADED", "1"),
        "PYTHONUNBUFFERED": "1",
    }
    _proc = subprocess.Popen(
        [sys.executable, WORKER_SCRIPT],
        stdin=subprocess.PIPE,
        stdout=subprocess.PIPE,
        stderr=subprocess.PIPE,
        text=True,
        cwd=PROJECT_ROOT,
        env=env,
        bufsize=1,
    )
    assert _proc.stdout is not None
    try:
        payload = _read_json_line(_proc.stdout)
    except Exception as exc:
        err = ""
        if _proc.stderr:
            try:
                err = _proc.stderr.read()[:500]
            except Exception:
                pass
        _proc = None
        _ready = False
        raise RuntimeError(f"Pipeline worker failed to start: {exc}; {err}") from exc
    if not payload.get("ok"):
        _ready = False
        raise RuntimeError(payload.get("error") or "Pipeline worker not ready")
    _ready = True


def _request(payload: dict[str, Any]) -> dict[str, Any]:
    global _proc, _ready
    with _lock:
        _start_locked()
        assert _proc is not None and _proc.stdin and _proc.stdout
        try:
            _proc.stdin.write(json.dumps(payload) + "\n")
            _proc.stdin.flush()
        except BrokenPipeError:
            _proc = None
            _ready = False
            _start_locked()
            assert _proc is not None and _proc.stdin and _proc.stdout
            _proc.stdin.write(json.dumps(payload) + "\n")
            _proc.stdin.flush()
        try:
            return _read_json_line(_proc.stdout)
        except Exception as exc:
            err = ""
            if _proc.stderr:
                try:
                    err = _proc.stderr.read()[:800]
                except Exception:
                    pass
            _proc = None
            _ready = False
            raise RuntimeError(f"Pipeline worker died: {exc}; {err}") from exc


def stop_worker() -> None:
    global _proc, _ready
    with _lock:
        if _proc is None:
            return
        try:
            if _proc.stdin and _proc.poll() is None:
                _proc.stdin.write(json.dumps({"cmd": "quit"}) + "\n")
                _proc.stdin.flush()
                _proc.wait(timeout=15)
        except Exception:
            try:
                _proc.kill()
            except Exception:
                pass
        _proc = None
        _ready = False


def process_wav(wav_path: str, context: dict | None = None) -> dict[str, Any]:
    payload: dict[str, Any] = {"cmd": "process", "wav": wav_path}
    if context:
        payload["context"] = context
    try:
        resp = _request(payload)
    except RuntimeError:
        stop_worker()
        resp = _request(payload)
    if resp.get("error") and "kannada_text" not in resp and not resp.get("ok"):
        raise RuntimeError(resp.get("error") or "process failed")
    return {k: v for k, v in resp.items() if k not in {"ok", "trace", "ready", "keep_loaded", "bye"}}


def transcribe_wav(wav_path: str) -> dict[str, Any]:
    """STT + Kn→En only (no NLU/TTS)."""
    try:
        resp = _request({"cmd": "transcribe", "wav": wav_path})
    except RuntimeError:
        stop_worker()
        resp = _request({"cmd": "transcribe", "wav": wav_path})
    if resp.get("error") and not resp.get("kannada_text") and not resp.get("ok"):
        raise RuntimeError(resp.get("error") or "transcribe failed")
    return {
        "kannada_text": resp.get("kannada_text") or "",
        "english_text": resp.get("english_text") or "",
        "error": resp.get("error"),
    }


def fill_field(wav_path: str, field_type: str = "text", field_id: str = "") -> dict[str, Any]:
    try:
        resp = _request(
            {
                "cmd": "fill",
                "wav": wav_path,
                "field_type": field_type,
                "field_id": field_id,
            }
        )
    except RuntimeError:
        stop_worker()
        resp = _request(
            {
                "cmd": "fill",
                "wav": wav_path,
                "field_type": field_type,
                "field_id": field_id,
            }
        )
    if resp.get("error") and not resp.get("kannada_text") and not resp.get("value") and not resp.get("ok"):
        raise RuntimeError(resp.get("error") or "fill failed")
    return {
        "kannada_text": resp.get("kannada_text") or "",
        "english_text": resp.get("english_text") or "",
        "value": resp.get("value") or "",
        "error": resp.get("error"),
    }


def speak_kannada(text: str) -> str:
    """Synthesise Kannada TTS in-process (cached). Does not block the STT worker."""
    from backend.tts.speak_cache import kannada_to_b64

    b64 = kannada_to_b64(text.strip())
    if not b64:
        raise RuntimeError("TTS returned empty audio")
    return b64


def speak_batch(texts: dict[str, str]) -> dict[str, str]:
    from backend.tts.speak_cache import kannada_to_b64

    out: dict[str, str] = {}
    for key, phrase in texts.items():
        if not phrase or not str(phrase).strip():
            continue
        b64 = kannada_to_b64(str(phrase).strip())
        if b64:
            out[key] = b64
    return out


def oneshot_process(wav_path: str, context: dict[str, Any] | None = None) -> dict[str, Any]:
    script = os.path.join(PROJECT_ROOT, "run_pipeline_subprocess.py")
    args = [sys.executable, script, wav_path]
    if context:
        args.append(json.dumps(context))
    proc = subprocess.run(
        args,
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        env={
            **os.environ,
            "TRANSFORMERS_OFFLINE": "1",
            "HF_HUB_OFFLINE": "1",
            "HF_DATASETS_OFFLINE": "1",
            "BANK_PIPELINE_KEEP_LOADED": "0",
        },
    )
    if (proc.stdout or "").strip():
        try:
            return _extract_json_payload(proc.stdout)
        except Exception as exc:
            raise RuntimeError(
                f"pipeline parse failed: {exc}; stderr={(proc.stderr or '')[:400]}"
            ) from exc
    if proc.returncode != 0:
        raise RuntimeError(proc.stderr.strip() or "pipeline subprocess failed")
    raise RuntimeError("pipeline subprocess returned empty output")


def oneshot_fill(wav_path: str, field_type: str, field_id: str) -> dict[str, Any]:
    script = os.path.join(PROJECT_ROOT, "run_form_fill_subprocess.py")
    proc = subprocess.run(
        [sys.executable, script, wav_path, field_type, field_id],
        capture_output=True,
        text=True,
        cwd=PROJECT_ROOT,
        env={
            **os.environ,
            "TRANSFORMERS_OFFLINE": "1",
            "HF_HUB_OFFLINE": "1",
            "HF_DATASETS_OFFLINE": "1",
        },
    )
    try:
        payload = _extract_json_payload(proc.stdout or "{}")
    except Exception as exc:
        raise RuntimeError((proc.stderr or proc.stdout or "")[:400]) from exc
    if proc.returncode != 0 and not payload.get("value"):
        raise RuntimeError(payload.get("error") or proc.stderr.strip() or "fill failed")
    return payload
