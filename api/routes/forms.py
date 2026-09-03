"""Voice-assisted bank form routes — catalog + STT + IndicTrans2 field fill."""

from __future__ import annotations

import asyncio
import json
import os
import subprocess
import sys
from concurrent.futures import ThreadPoolExecutor

from fastapi import APIRouter, File, Form, HTTPException, UploadFile
from pydantic import BaseModel, Field

from api.audio import audio_bytes_to_wav, safe_unlink
from api import forms_catalog
from backend.db import store
from backend.forms.form_menu import build_form_menu_payload, match_form_from_speech, match_form_in_menu
from backend.pipeline_bridge import (
    fill_field as warm_fill_field,
    oneshot_fill,
    worker_enabled,
)

router = APIRouter()

PROJECT_ROOT = os.path.dirname(os.path.dirname(os.path.dirname(os.path.abspath(__file__))))
STT_SCRIPT = os.path.join(PROJECT_ROOT, "run_stt_subprocess.py")

_OFFLINE_ENV = {
    "TRANSFORMERS_OFFLINE": "1",
    "HF_HUB_OFFLINE": "1",
    "HF_DATASETS_OFFLINE": "1",
}


class FormSubmitBody(BaseModel):
    form_id: str
    title_kn: str = ""
    title_en: str = ""
    values: dict[str, str] = Field(default_factory=dict)
    kiosk_session_id: str = ""


class FormChoiceBody(BaseModel):
    kannada_text: str = ""
    english_text: str = ""
    menu_form_ids: list[str] = Field(default_factory=list)


class FormSummaryBody(BaseModel):
    values: dict[str, str] = Field(default_factory=dict)


@router.get("/forms/menu")
def form_menu() -> dict:
    """Numbered Kannada form menu for voice selection."""
    return build_form_menu_payload()


@router.get("/forms/submissions")
def list_submissions(limit: int = 50) -> dict:
    """Recent form submissions (MongoDB or local jsonl)."""
    items = store.list_form_submissions(limit=min(max(limit, 1), 200))
    return {"items": items, "count": len(items)}


@router.post("/forms/submit")
def submit_form(body: FormSubmitBody) -> dict:
    """Persist completed form (MongoDB when configured)."""
    form = forms_catalog.get_form(body.form_id)
    if form is None:
        raise HTTPException(status_code=404, detail=f"Unknown form: {body.form_id}")
    saved = store.save_form_submission(
        body.form_id,
        body.title_kn or form.get("title_kn") or "",
        body.title_en or form.get("title_en") or "",
        body.values,
        kiosk_session_id=body.kiosk_session_id,
    )
    return {"ok": True, "submission": saved}


@router.post("/forms/resolve-choice")
def resolve_form_choice(body: FormChoiceBody) -> dict:
    """Match spoken form choice to a form id."""
    kn = body.kannada_text.strip()
    en = (body.english_text or kn).strip()
    if body.menu_form_ids:
        form_id = match_form_in_menu(kn, en, body.menu_form_ids)
    else:
        form_id = match_form_from_speech(kn, en)
    if not form_id:
        return {"matched": False, "form_id": None}
    form = forms_catalog.get_form(form_id)
    return {"matched": True, "form_id": form_id, "form": form}


@router.get("/forms")
def list_forms() -> dict:
    return forms_catalog.list_forms()


@router.get("/forms/{form_id}")
def get_form(form_id: str) -> dict:
    form = forms_catalog.get_form(form_id)
    if form is None:
        raise HTTPException(status_code=404, detail=f"Unknown form: {form_id}")
    return form


@router.post("/forms/{form_id}/summary")
def form_summary(form_id: str, body: FormSummaryBody) -> dict:
    """Kannada read-back summary for a completed form (voice + UI)."""
    form = forms_catalog.get_form(form_id)
    if form is None:
        raise HTTPException(status_code=404, detail=f"Unknown form: {form_id}")
    from backend.forms.summary_kn import build_form_summary_kn

    return build_form_summary_kn(form, body.values or {})


@router.get("/forms/{form_id}/prompt-audio")
def form_prompt_audio(form_id: str) -> dict:
    """
    Pre-synthesise all Kannada field prompts for a form (Parler, cached).
    Frontend plays cached audio for instant field prompts without per-turn TTS latency.
    """
    form = forms_catalog.get_form(form_id)
    if form is None:
        raise HTTPException(status_code=404, detail=f"Unknown form: {form_id}")

    texts: dict[str, str] = {}
    for field in form.get("fields") or []:
        if field.get("auto"):
            continue
        if field.get("type") == "date" and field.get("id") == "date":
            continue
        prompt = (field.get("prompt_kn") or "").strip()
        if prompt:
            texts[str(field.get("id") or "")] = prompt

    from backend.lobby_phrases import FORM_READY_KN

    texts["_form_ready"] = FORM_READY_KN

    try:
        from backend.tts.speak_cache import kannada_to_b64

        audio: dict[str, str] = {}
        errors: dict[str, str] = {}

        def _synth_one(key: str, text: str) -> tuple[str, str, str | None]:
            try:
                b64 = kannada_to_b64(text)
                if b64:
                    return key, b64, None
                return key, "", "empty audio"
            except Exception as exc:
                return key, "", str(exc)

        with ThreadPoolExecutor(max_workers=4) as pool:
            futures = [
                pool.submit(_synth_one, key, text)
                for key, text in texts.items()
                if text.strip()
            ]
            for fut in futures:
                key, b64, err = fut.result()
                if b64:
                    audio[key] = b64
                elif err:
                    errors[key] = err
        if not audio and errors:
            raise HTTPException(
                status_code=500,
                detail=f"Prompt audio failed: {next(iter(errors.values()))}",
            )
    except HTTPException:
        raise
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Prompt audio failed: {exc}") from exc

    return {"form_id": form_id, "audio": audio, "errors": errors}


@router.post("/forms/transcribe")
async def transcribe_field(audio: UploadFile = File(...)) -> dict:
    """Legacy: Kannada STT only (kept for compatibility). Prefer /forms/fill-field."""
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    raw_bytes = await audio.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    tmp_wav: str | None = None
    try:
        tmp_wav = audio_bytes_to_wav(raw_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Audio conversion failed: {exc}") from exc

    try:
        proc = subprocess.run(
            [sys.executable, STT_SCRIPT, tmp_wav],
            capture_output=True,
            text=True,
            cwd=PROJECT_ROOT,
            env={**os.environ, **_OFFLINE_ENV},
        )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"STT execution failed: {exc}") from exc
    finally:
        safe_unlink(tmp_wav)

    if proc.returncode != 0:
        stderr = proc.stderr.strip() or "Unknown STT error"
        try:
            payload = json.loads(proc.stdout or "{}")
            if payload.get("error"):
                raise HTTPException(status_code=500, detail=f"STT failed: {payload['error']}")
        except (json.JSONDecodeError, HTTPException):
            pass
        raise HTTPException(status_code=500, detail=f"STT subprocess failed: {stderr}")

    try:
        result = json.loads(proc.stdout)
    except json.JSONDecodeError as exc:
        raise HTTPException(
            status_code=500,
            detail=f"Invalid STT output: {(proc.stdout or '')[:200]}",
        ) from exc

    if result.get("error"):
        raise HTTPException(status_code=500, detail=f"STT failed: {result['error']}")

    return {"text": (result.get("text") or "").strip()}


@router.post("/forms/fill-field")
async def fill_field(
    audio: UploadFile = File(...),
    field_type: str = Form("text"),
    field_id: str = Form(""),
) -> dict:
    """
    Speak one answer in Kannada → English form value via local models.

    Pipeline (offline, no API keys):
        STT (Whisper) → IndicTrans2 Kn→En → typed extract_field_value()
    """
    if not audio.filename:
        raise HTTPException(status_code=400, detail="No audio file provided")

    raw_bytes = await audio.read()
    if not raw_bytes:
        raise HTTPException(status_code=400, detail="Empty audio file")

    tmp_wav: str | None = None
    try:
        tmp_wav = audio_bytes_to_wav(raw_bytes)
    except Exception as exc:
        raise HTTPException(status_code=400, detail=f"Audio conversion failed: {exc}") from exc

    try:
        if worker_enabled():
            try:
                result = await asyncio.to_thread(
                    warm_fill_field, tmp_wav, field_type or "text", field_id or ""
                )
            except Exception as warm_exc:
                print(f"[forms] warm worker failed, oneshot fallback: {warm_exc}", file=sys.stderr)
                result = await asyncio.to_thread(
                    oneshot_fill, tmp_wav, field_type or "text", field_id or ""
                )
        else:
            result = await asyncio.to_thread(
                oneshot_fill, tmp_wav, field_type or "text", field_id or ""
            )
    except Exception as exc:
        raise HTTPException(status_code=500, detail=f"Form fill failed: {exc}") from exc
    finally:
        safe_unlink(tmp_wav)

    kannada = (result.get("kannada_text") or "").strip()
    english = (result.get("english_text") or "").strip()
    value = (result.get("value") or "").strip()
    err = result.get("error")

    # Confirm step: require affirmative speech or non-empty STT
    if (field_id or "").lower() == "confirm":
        combined = f"{kannada} {english} {value}".lower()
        affirm = any(
            w in combined
            for w in ("yes", "ok", "okay", "correct", "right", "confirm", "ಸರಿ", "ಹೌದು", "confirm")
        )
        if not affirm and not (kannada.strip() or value.strip()):
            return {
                "kannada_text": kannada,
                "english_text": english,
                "value": "",
                "error": "Please say yes to confirm or no to repeat",
            }
        return {
            "kannada_text": kannada,
            "english_text": english,
            "value": value or kannada or english,
            "error": None,
        }

    if err and not value and not kannada:
        raise HTTPException(
            status_code=422,
            detail=f"Form fill failed: {err}",
        )

    if not kannada and not value:
        raise HTTPException(
            status_code=422,
            detail=err or "STT returned empty (silent audio). Please speak again clearly.",
        )

    return {
        "kannada_text": kannada,
        "english_text": english,
        "value": value or english or kannada,
        "error": err,
    }
