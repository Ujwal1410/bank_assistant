"""Shared Parler load helpers (used by run_parler_tts_worker.py and test scripts)."""

from __future__ import annotations

import os


def resolve_parler_dtype(device: str):
    """
    Choose torch dtype for Parler weights.

    BANK_PARLER_DTYPE:
      auto  — fp16 on CUDA, fp32 on CPU (default)
      fp16  — half precision (less VRAM, faster on GPU)
      fp32  — full precision
    """
    import torch

    raw = os.environ.get("BANK_PARLER_DTYPE", "auto").strip().lower()
    if raw in {"fp32", "float32", "32"}:
        return torch.float32
    if raw in {"fp16", "float16", "16", "half"}:
        return torch.float16
    return torch.float16 if str(device).startswith("cuda") else torch.float32


def dtype_label(dtype) -> str:
    import torch

    if dtype == torch.float16:
        return "fp16"
    if dtype == torch.bfloat16:
        return "bf16"
    return "fp32"


def max_new_tokens_for_text(text: str) -> int:
    """
    Scale Parler audio token budget to phrase length.

    Fixed max_new_tokens=1800 makes even short replies slow on GPU.
    """
    cap = int(os.environ.get("BANK_PARLER_MAX_NEW_TOKENS", "1800"))
    floor = int(os.environ.get("BANK_PARLER_MIN_NEW_TOKENS", "320"))
    per_char = int(os.environ.get("BANK_PARLER_TOKENS_PER_CHAR", "45"))
    n = len((text or "").strip())
    if n <= 0:
        return floor
    est = n * per_char + 180
    return max(floor, min(cap, est))


# Defaults tuned for short kiosk phrases — old floor/cap caused 20s silent WAV tails.


def load_parler_model(model_id: str, device: str):
    """Load Indic Parler with configured precision."""
    from parler_tts import ParlerTTSForConditionalGeneration

    dtype = resolve_parler_dtype(device)
    model = ParlerTTSForConditionalGeneration.from_pretrained(
        model_id,
        torch_dtype=dtype,
    ).to(device)
    model.eval()
    return model, dtype
