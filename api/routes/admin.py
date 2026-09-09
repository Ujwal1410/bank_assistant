"""Admin login routes (separate from the lobby agent)."""

from __future__ import annotations

from fastapi import APIRouter, Depends, Header, HTTPException
from pydantic import BaseModel, Field

from api import admin_auth

router = APIRouter(tags=["admin"])


class LoginBody(BaseModel):
    username: str = Field(..., min_length=1)
    password: str = Field(..., min_length=1)


class VoiceSettingsBody(BaseModel):
    speaker: str = Field(..., min_length=1, max_length=32)


@router.get("/admin/settings/voice")
def get_voice_settings(_admin: dict = Depends(admin_auth.require_admin)) -> dict:
    from api.app_settings import VALID_SPEAKERS, get_tts_speaker

    current = get_tts_speaker()
    return {
        "speaker": current,
        "options": [
            {
                "id": "Suresh",
                "label_en": "Suresh",
                "label_kn": "ಸುರೇಶ್",
                "description_en": "Warm, professional male voice — default for bank counter",
                "description_kn": "ಬ್ಯಾಂಕ್ ಕೌಂಟರ್‌ಗೆ ಸೂಕ್ತ — ವೃತ್ತಿಪರ ಪುರುಷ ಧ್ವನಿ",
            },
            {
                "id": "Anu",
                "label_en": "Anu",
                "label_kn": "ಅನು",
                "description_en": "Clear, expressive female voice",
                "description_kn": "ಸ್ಪಷ್ಟ, ಸಹಜ ಸ್ತ್ರೀ ಧ್ವನಿ",
            },
        ],
        "valid": sorted(VALID_SPEAKERS),
    }


@router.put("/admin/settings/voice")
def set_voice_settings(
    body: VoiceSettingsBody,
    _admin: dict = Depends(admin_auth.require_admin),
) -> dict:
    from api.app_settings import get_tts_speaker, set_tts_speaker
    from backend.pipeline_bridge import set_worker_speaker

    previous = get_tts_speaker()
    try:
        speaker = set_tts_speaker(body.speaker)
        set_worker_speaker(speaker)
    except ValueError as exc:
        raise HTTPException(status_code=400, detail=str(exc)) from exc
    except Exception as exc:
        try:
            set_tts_speaker(previous)
            set_worker_speaker(previous)
        except Exception:
            pass
        raise HTTPException(
            status_code=503,
            detail=f"Could not apply voice to the speech worker: {exc}",
        ) from exc
    return {"ok": True, "speaker": speaker}


@router.post("/admin/login")
def admin_login(body: LoginBody) -> dict:
    try:
        return admin_auth.login(body.username.strip(), body.password)
    except PermissionError as exc:
        raise HTTPException(status_code=401, detail=str(exc)) from exc


@router.get("/admin/me")
def admin_me(admin: dict = Depends(admin_auth.require_admin)) -> dict:
    return {**admin, "demo_mode": True}


@router.post("/admin/logout")
def admin_logout(authorization: str | None = Header(default=None)) -> dict:
    admin_auth.logout(authorization)
    return {"ok": True}
