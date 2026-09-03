"""Tests for Kannada digit extraction and speak cache."""
from __future__ import annotations

import os
import unittest

os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")


class TestKannadaDigits(unittest.TestCase):
    def test_ascii_digits(self) -> None:
        from backend.forms.kannada_digits import extract_digits_from_kannada

        self.assertEqual(extract_digits_from_kannada("1234567890"), "1234567890")

    def test_embedded_digits(self) -> None:
        from backend.forms.kannada_digits import extract_digits_from_kannada

        self.assertEqual(
            extract_digits_from_kannada("ನನ್ನ ಖಾತೆ 1234567890"),
            "1234567890",
        )


class TestSpeakCache(unittest.TestCase):
    def test_cache_hit_no_synth(self) -> None:
        from backend.tts.speak_cache import get_cached_b64, put_cached_b64

        put_cached_b64("unit_test_only", "YWJj")
        self.assertEqual(get_cached_b64("unit_test_only"), "YWJj")


if __name__ == "__main__":
    unittest.main()
