"""Admin-facing conversation flow map (intent → route → form → questions)."""

from __future__ import annotations

from typing import Any

from api import forms_catalog
from backend.decision_router.router import (
    INFORMATIONAL_INTENTS,
    REQUIRED_FIELDS,
    TRANSACTIONAL_INTENTS,
)
from backend.forms.form_menu import build_form_menu_payload


EXAMPLE_PHRASES: dict[str, list[str]] = {
    "check_balance": ["ನನ್ನ ಖಾತೆ ಬ್ಯಾಲೆನ್ಸ್ ಹೇಳಿ", "ಖಾತೆ ಶಿಲ್ಕು"],
    "withdraw_money": ["ನಗದು ಹಿಂಪಡೆಯಲು", "ಹಣ ತೆಗೆಯುವುದು"],
    "deposit_money": ["ಹಣ ಹಾಕಲು", "ಡಿಪಾಜಿಟ್"],
    "open_account": ["ಸೇವಿಂಗ್ಸ್ ಅಕೌಂಟ್ ತೆರೆಯುವುದು", "ಹೊಸ ಖಾತೆ"],
    "apply_loan": ["ಸಾಲಕ್ಕೆ ಅರ್ಜಿ", "ಲೋನ್"],
    "interest_rate_query": ["ಬಡ್ಡಿ ದರ ಎಷ್ಟು", "interest rates"],
    "account_info_query": ["ATM ಕಾರ್ಡ್ ಬ್ಲಾಕ್ ಹೇಗೆ", "ಖಾತೆ ವಿವರ"],
}


def build_conversation_flow() -> dict[str, Any]:
    forms_payload = forms_catalog.list_forms()
    forms_by_id = {f["id"]: f for f in forms_payload["forms"]}
    intent_map = dict(forms_payload.get("intent_map") or {})

    intents: list[dict[str, Any]] = []
    for intent in sorted(TRANSACTIONAL_INTENTS | INFORMATIONAL_INTENTS):
        route = "transactional" if intent in TRANSACTIONAL_INTENTS else "informational"
        form_id = intent_map.get(intent)
        form = forms_by_id.get(form_id) if form_id else None
        detail = forms_catalog.get_form(form_id) if form_id else None
        fields = []
        if detail:
            for field in detail.get("fields") or []:
                if field.get("auto"):
                    continue
                fields.append(
                    {
                        "id": field.get("id"),
                        "label_kn": field.get("label_kn"),
                        "label_en": field.get("label_en"),
                        "prompt_kn": field.get("prompt_kn"),
                        "type": field.get("type"),
                        "required": bool(field.get("required")),
                    }
                )
        intents.append(
            {
                "intent": intent,
                "route": route,
                "form_id": form_id,
                "form_title_en": (form or {}).get("title_en"),
                "form_title_kn": (form or {}).get("title_kn"),
                "required_entities": REQUIRED_FIELDS.get(intent, []),
                "example_phrases": EXAMPLE_PHRASES.get(intent, []),
                "fields": fields,
                "next_step": (
                    "Open voice form and ask fields one by one, then confirm summary"
                    if route == "transactional" and form_id
                    else "Speak bank info answer (no form) and stay in assist loop"
                ),
            }
        )

    phases = [
        {
            "id": "idle",
            "title": "Waiting",
            "detail": "Customer steps into camera / taps Start",
        },
        {
            "id": "greeting",
            "title": "Greeting TTS",
            "detail": "Time-of-day Kannada greeting plays; UI shows greeting text first",
        },
        {
            "id": "assist_listen",
            "title": "Assist listen",
            "detail": "Mic warms → green Listening → customer speaks request",
        },
        {
            "id": "pipeline",
            "title": "STT → NLU → Router",
            "detail": "Kannada text, English text, intent, confidence, route",
        },
        {
            "id": "branch",
            "title": "Branch",
            "detail": (
                "informational → speak answer; transactional → open form; "
                "form_menu → pick form; clarification → ask again"
            ),
        },
        {
            "id": "form_fields",
            "title": "Form field loop",
            "detail": "Ask prompt → listen → confirm ಹೌದು/ಇಲ್ಲ → next field → summary",
        },
        {
            "id": "end",
            "title": "End",
            "detail": "Customer says ಮುಗಿಸು / goodbye, or leaves camera / admin End",
        },
    ]

    commands = {
        "confirm": ["ಹೌದು", "ಸರಿ", "yes", "ok"],
        "reject": ["ಇಲ್ಲ", "ಮತ್ತೆ ಹೇಳಿ", "no", "wrong"],
        "skip": ["ಬಿಟ್ಟುಬಿಡಿ", "skip"],
        "end": ["ಮುಗಿಸು", "goodbye", "stop"],
    }

    menu = build_form_menu_payload()
    return {
        "phases": phases,
        "intents": intents,
        "voice_commands": commands,
        "form_menu": menu.get("forms") or [],
        "intent_map": intent_map,
        "notes": [
            "Default language: Kannada. Wait for green Listening before speaking.",
            "Balance needs all 10 account digits including trailing zero.",
            "Demo accounts are listed under Customers in this admin console.",
        ],
    }
