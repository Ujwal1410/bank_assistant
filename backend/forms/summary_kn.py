"""Build Kannada read-back summaries for completed voice forms."""

from __future__ import annotations

import re
from datetime import datetime
from typing import Any

_DIGIT_TO_KN: dict[str, str] = {
    "0": "ಸೊನ್ನೆ",
    "1": "ಒಂದು",
    "2": "ಎರಡು",
    "3": "ಮೂರು",
    "4": "ನಾಲ್ಕು",
    "5": "ಐದು",
    "6": "ಆರು",
    "7": "ಏಳು",
    "8": "ಎಂಟು",
    "9": "ಒಂಬತ್ತು",
}

_ACCOUNT_FIELD_IDS = frozenset(
    {
        "account_number",
        "beneficiary_account",
        "remitter_account",
        "mobile_number",
        "old_mobile",
        "new_mobile",
        "cheque_number",
        "pan",
    }
)
_AMOUNT_FIELD_IDS = frozenset(
    {
        "amount",
        "loan_amount",
        "fd_amount",
        "income",
    }
)


def mask_account(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if len(digits) <= 4:
        return digits or "—"
    return ("•" * (len(digits) - 4)) + digits[-4:]


def digits_to_kannada_words(raw: str) -> str:
    digits = re.sub(r"\D", "", raw or "")
    if not digits:
        return raw.strip() or "—"
    return " ".join(_DIGIT_TO_KN.get(ch, ch) for ch in digits)


def _parse_amount(value: str) -> float | None:
    cleaned = (value or "").strip().replace(",", "").replace("₹", "").replace("rs", "")
    cleaned = re.sub(r"[^\d.]", "", cleaned, flags=re.I)
    if not cleaned:
        return None
    try:
        return float(cleaned)
    except ValueError:
        return None


def amount_speak_kn(value: str) -> str:
    """Speakable Kannada amount phrase for TTS."""
    amt = _parse_amount(value)
    if amt is None:
        return (value or "").strip() or "—"
    whole = int(round(amt))
    if whole >= 100000:
        lakhs = whole // 100000
        rest = whole % 100000
        if rest == 0:
            return f"{_int_kn(lakhs)} ಲಕ್ಷ ರೂಪಾಯಿ"
        return f"{_int_kn(lakhs)} ಲಕ್ಷ {_int_kn(rest)} ರೂಪಾಯಿ"
    if whole >= 1000:
        thousands = whole // 1000
        rest = whole % 1000
        if rest == 0:
            return f"{_int_kn(thousands)} ಸಾವಿರ ರೂಪಾಯಿ"
        return f"{_int_kn(thousands)} ಸಾವಿರ {_int_kn(rest)} ರೂಪಾಯಿ"
    return f"{_int_kn(whole)} ರೂಪಾಯಿ"


def _int_kn(n: int) -> str:
    """Simple Kannada number words for amounts (1–99). Falls back to digits."""
    if n <= 0:
        return "ಸೊನ್ನೆ"
    if n <= 9:
        return _DIGIT_TO_KN[str(n)]
    teens = {
        10: "ಹತ್ತು",
        11: "ಹನ್ನೆರಡು",
        12: "ಹದಿನಮೂರು",
        13: "ಹದಿನಾಲ್ಕು",
        14: "ಹದಿನೈದು",
        15: "ಹದಿನಾರು",
        16: "ಹದಿನೇಳು",
        17: "ಹದಿನೆಂಟು",
        18: "ಹತ್ತೊಂಬತ್ತು",
        19: "ಹತ್ತೊಂಬತ್ತು",
    }
    if n in teens:
        return teens[n]
    tens_words = {
        2: "ಇಪ್ಪತ್ತು",
        3: "ಮೂವತ್ತು",
        4: "ನಲವತ್ತು",
        5: "ಐವತ್ತು",
        6: "ಅರವತ್ತು",
        7: "ಎಪ್ಪತ್ತು",
        8: "ಐಭತ್ತು",
        9: "ತೊಂಬತ್ತು",
    }
    tens, ones = divmod(n, 10)
    if ones == 0 and tens in tens_words:
        return tens_words[tens]
    if tens in tens_words and ones:
        return f"{tens_words[tens]} {_DIGIT_TO_KN[str(ones)]}"
    return str(n)


def amount_display(value: str) -> str:
    amt = _parse_amount(value)
    if amt is None:
        return (value or "").strip() or "—"
    return f"₹ {amt:,.2f}"


def _date_display(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return "—"
    if raw.lower() in {"today", "indu", "ಇಂದು"}:
        return datetime.now().strftime("%d/%m/%Y")
    return raw


def _date_speak_kn(value: str) -> str:
    raw = (value or "").strip()
    if not raw:
        return "—"
    today = datetime.now().strftime("%d/%m/%Y")
    if raw == today or raw.lower() in {"today", "indu", "ಇಂದು"}:
        return "ಇಂದು"
    return raw


def _field_speak(field: dict[str, Any], value: str) -> str:
    fid = str(field.get("id") or "")
    ftype = str(field.get("type") or "text").lower()
    if fid in _ACCOUNT_FIELD_IDS or ftype == "digits":
        if len(re.sub(r"\D", "", value)) >= 8:
            return digits_to_kannada_words(value)
    if fid in _AMOUNT_FIELD_IDS or ftype == "amount":
        return amount_speak_kn(value)
    if ftype == "date":
        return _date_speak_kn(value)
    return value.strip()


def _field_display(field: dict[str, Any], value: str) -> str:
    fid = str(field.get("id") or "")
    ftype = str(field.get("type") or "text").lower()
    if fid in _ACCOUNT_FIELD_IDS or (ftype == "digits" and "account" in fid):
        return mask_account(value)
    if fid in _AMOUNT_FIELD_IDS or ftype == "amount":
        return amount_display(value)
    if ftype == "date":
        return _date_display(value)
    return value.strip() or "—"


_FORM_SUMMARY_MAX_CHARS = 1200


def _truncate_summary_kn(text: str) -> str:
    """Keep TTS under ~30s for long forms."""
    if len(text) <= _FORM_SUMMARY_MAX_CHARS:
        return text
    cut = text[: _FORM_SUMMARY_MAX_CHARS].rsplit(" ", 1)[0]
    return f"{cut} … ಹೆಚ್ಚಿನ ವಿವರಗಳು ಪರದೆಯ ಮೇಲೆ ಕಾಣಿಸುತ್ತವೆ."


def build_form_summary_kn(form: dict[str, Any], values: dict[str, str]) -> dict[str, Any]:
    """
    Build Kannada summary for voice read-back and on-screen display.

    Returns:
        summary_kn, confirm_prompt_kn, lines[{field_id, label_kn, display_kn, speak_kn}]
    """
    from backend.lobby_phrases import (
        FORM_SUMMARY_CLOSER_KN,
        FORM_SUMMARY_OPENER_KN,
        FORM_WHOLE_CONFIRM_KN,
    )

    lines: list[dict[str, str]] = []
    parts: list[str] = [FORM_SUMMARY_OPENER_KN]

    for field in form.get("fields") or []:
        if field.get("auto"):
            continue
        fid = str(field.get("id") or "")
        if not fid:
            continue
        raw = (values.get(fid) or "").strip()
        if not raw:
            if field.get("required"):
                continue
            continue
        label = (field.get("label_kn") or field.get("label_en") or fid).strip()
        display = _field_display(field, raw)
        speak = _field_speak(field, raw)
        lines.append(
            {
                "field_id": fid,
                "label_kn": label,
                "display_kn": display,
                "speak_kn": speak,
            }
        )
        parts.append(f"{label} {speak}.")

    parts.append(FORM_SUMMARY_CLOSER_KN)
    summary_kn = _truncate_summary_kn(" ".join(p for p in parts if p))

    return {
        "form_id": form.get("id") or "",
        "title_kn": form.get("title_kn") or "",
        "summary_kn": summary_kn,
        "confirm_prompt_kn": FORM_WHOLE_CONFIRM_KN,
        "lines": lines,
    }
