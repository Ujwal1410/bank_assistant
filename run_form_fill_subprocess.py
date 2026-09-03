"""
Run STT + IndicTrans2 Kn→En + typed field extract for one form answer.

Usage: python run_form_fill_subprocess.py <wav_path> [field_type] [field_id]

Prints JSON: kannada_text, english_text, value, error
"""
from __future__ import annotations

import json
import os
import sys

os.environ["TRANSFORMERS_OFFLINE"] = "1"
os.environ["HF_DATASETS_OFFLINE"] = "1"
os.environ["HF_HUB_OFFLINE"] = "1"

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from backend.forms.extract import extract_field_value
from backend.forms.stt_tuning import NAME_FIELD_IDS, form_fill_beam_size
from backend.stt import transcribe, unload_model as unload_stt
from backend.translation import translate_kn_to_en, unload_model as unload_trans

wav_path = sys.argv[1]
field_type = sys.argv[2] if len(sys.argv) > 2 else "text"
field_id = sys.argv[3] if len(sys.argv) > 3 else ""

kannada = ""
english = ""
value = ""
error = None

beam = form_fill_beam_size(field_type, field_id)

try:
    kannada = transcribe(wav_path, model="specialized", beam_size=beam) or ""
    if not kannada.strip():
        error = "STT returned empty (silent audio)"
    else:
        try:
            unload_stt("specialized")
        except Exception:
            pass
        english = translate_kn_to_en(kannada) or ""
        try:
            unload_trans("kn_to_en")
        except Exception:
            pass
        if not english.strip():
            value = kannada.strip()
            error = "Translation returned empty; using Kannada text"
        else:
            value = extract_field_value(english, field_type=field_type, field_id=field_id)

        if not (value or "").strip() and (field_id or "").lower() in NAME_FIELD_IDS:
            value = extract_field_value(english or kannada, field_type=field_type, field_id=field_id)
            if not value.strip():
                value = kannada.strip()

        if field_type == "digits" or field_id == "account_number":
            from backend.forms.kannada_digits import extract_digits_from_kannada

            kn_digits = extract_digits_from_kannada(kannada)
            if len(kn_digits) >= 8:
                value = kn_digits
            elif kn_digits and not value:
                value = kn_digits
except Exception as exc:
    error = str(exc)
    try:
        unload_stt("specialized")
    except Exception:
        pass
    try:
        unload_trans("kn_to_en")
    except Exception:
        pass

print(
    json.dumps(
        {
            "kannada_text": kannada,
            "english_text": english,
            "value": value,
            "error": error,
        }
    )
)
if error and not value:
    sys.exit(1)
