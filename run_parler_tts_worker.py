"""
Persistent Indic Parler-TTS worker (runs inside .venv-parler only).

Protocol (stdin/stdout, one JSON object per line):
  Request:  {"cmd":"synth","text":"<kannada>","speaker":"Suresh"|"Anu"}
  Response: {"ok":true,"audio_b64":"...","sr":22050,"speaker":"Suresh"}
            {"ok":false,"error":"..."}
  Request:  {"cmd":"ping"}
  Response: {"ok":true,"pong":true,"ready":true}

All logs go to stderr so stdout stays clean JSON.
"""
from __future__ import annotations

import base64
import io
import json
import os
import sys
import traceback

import numpy as np

os.environ.setdefault("TRANSFORMERS_OFFLINE", os.environ.get("TRANSFORMERS_OFFLINE", "0"))

from parler_model_utils import max_new_tokens_for_text  # noqa: E402

SPEAKER_DESCRIPTIONS = {
    "Suresh": (
        "Suresh's voice is clear, warm, and professional, speaking at a moderate "
        "pace with a friendly bank-counter tone. The recording is of very high "
        "quality, with the speaker's voice sounding clear and very close up."
    ),
    "Anu": (
        "Anu's voice is clear, warm, and expressive, speaking at a moderate pace "
        "with a friendly helpful tone. The recording is of very high quality, "
        "with the speaker's voice sounding clear and very close up."
    ),
}

MODEL_ID = os.environ.get("BANK_PARLER_MODEL", "ai4bharat/indic-parler-tts")


def _load_model(device: str):
    from parler_model_utils import dtype_label, load_parler_model

    model, dtype = load_parler_model(MODEL_ID, device)
    return model, dtype_label(dtype)


def _log(msg: str) -> None:
    print(msg, file=sys.stderr, flush=True)


def main() -> int:
    import torch
    import soundfile as sf
    from transformers import AutoTokenizer

    device = "cuda:0" if torch.cuda.is_available() else "cpu"
    if device.startswith("cuda"):
        torch.backends.cudnn.benchmark = True
    _log(f"[parler-worker] loading {MODEL_ID} on {device}")

    model, precision = _load_model(device)
    tokenizer = AutoTokenizer.from_pretrained(MODEL_ID)
    desc_tokenizer = AutoTokenizer.from_pretrained(model.config.text_encoder._name_or_path)
    _log(f"[parler-worker] ready ({precision})")

    # Signal ready on stdout for parent
    print(
        json.dumps({"ok": True, "ready": True, "device": device, "dtype": precision}),
        flush=True,
    )

    for raw in sys.stdin:
        line = raw.strip()
        if not line:
            continue
        try:
            req = json.loads(line)
        except json.JSONDecodeError as exc:
            print(json.dumps({"ok": False, "error": f"bad json: {exc}"}), flush=True)
            continue

        cmd = (req.get("cmd") or "synth").lower()
        if cmd == "ping":
            print(json.dumps({"ok": True, "pong": True, "ready": True}), flush=True)
            continue
        if cmd == "quit":
            print(json.dumps({"ok": True, "bye": True}), flush=True)
            return 0

        text = (req.get("text") or "").strip()
        speaker = (req.get("speaker") or "Suresh").strip()
        if speaker not in SPEAKER_DESCRIPTIONS:
            speaker = "Suresh"
        if not text:
            print(json.dumps({"ok": False, "error": "empty text"}), flush=True)
            continue

        description = SPEAKER_DESCRIPTIONS[speaker]
        try:
            desc_ids = desc_tokenizer(description, return_tensors="pt").to(device)
            prompt_ids = tokenizer(text, return_tensors="pt").to(device)
            max_tokens = max_new_tokens_for_text(text)
            # Greedy decode (do_sample=0) often collapses to ~1 word / silence.
            # Sampling matches prior working behavior for full Kannada sentences.
            do_sample = os.environ.get("BANK_PARLER_DO_SAMPLE", "1").strip().lower() in {
                "1",
                "true",
                "yes",
            }
            gen_kwargs: dict = {
                "input_ids": desc_ids.input_ids,
                "attention_mask": desc_ids.attention_mask,
                "prompt_input_ids": prompt_ids.input_ids,
                "prompt_attention_mask": prompt_ids.attention_mask,
                "max_new_tokens": max_tokens,
                "do_sample": do_sample,
            }
            if do_sample:
                gen_kwargs["temperature"] = float(os.environ.get("BANK_PARLER_TEMPERATURE", "0.9"))
            with torch.inference_mode():
                generation = model.generate(**gen_kwargs)
            audio_arr = generation.cpu().numpy().squeeze()
            if getattr(audio_arr, "dtype", None) is not None and audio_arr.dtype != np.float32:
                audio_arr = audio_arr.astype(np.float32)
            # Trim only long trailing silence — keep quiet speech (threshold 0.01)
            from backend.tts.audio_util import trim_trailing_silence

            audio_arr = trim_trailing_silence(
                audio_arr,
                int(model.config.sampling_rate),
                threshold=0.01,
                pad_ms=250,
            )
            sr = int(model.config.sampling_rate)
            buf = io.BytesIO()
            sf.write(buf, audio_arr, sr, format="WAV")
            b64 = base64.b64encode(buf.getvalue()).decode("ascii")
            print(
                json.dumps(
                    {
                        "ok": True,
                        "audio_b64": b64,
                        "sr": sr,
                        "speaker": speaker,
                        "engine": "indic-parler-tts",
                        "dtype": precision,
                        "max_new_tokens": max_tokens,
                    }
                ),
                flush=True,
            )
        except Exception as exc:
            _log(traceback.format_exc())
            print(json.dumps({"ok": False, "error": str(exc)}), flush=True)

    return 0


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception:
        traceback.print_exc(file=sys.stderr)
        print(json.dumps({"ok": False, "error": "worker crashed on startup"}), flush=True)
        raise SystemExit(1)
