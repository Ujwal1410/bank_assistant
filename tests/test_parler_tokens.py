"""Parler TTS token budget helpers."""

from __future__ import annotations

from parler_model_utils import max_new_tokens_for_text


def test_short_phrase_uses_fewer_tokens_than_cap():
    short = max_new_tokens_for_text("ಸರಿ")
    long = max_new_tokens_for_text("ಒ" * 120)
    assert short < long
    assert short >= 320
    assert long <= 1800


def test_empty_text_uses_floor():
    assert max_new_tokens_for_text("") >= 320
