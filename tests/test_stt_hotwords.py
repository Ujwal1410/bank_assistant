"""STT hotwords must be a string for faster-whisper."""
from __future__ import annotations

import os
import unittest
from unittest.mock import MagicMock, patch

os.environ.setdefault("TRANSFORMERS_OFFLINE", "1")


class TestSTTHotwords(unittest.TestCase):
    @patch("backend.stt.transcriber.WhisperModel")
    @patch("backend.stt.transcriber.sf.read", return_value=([0.0] * 1600, 16000))
    @patch("backend.stt.transcriber.is_silent", return_value=False)
    @patch("backend.stt.transcriber.validate_audio_file")
    def test_hotwords_passed_as_string(self, _val, _silent, _read, _model_cls):
        from backend.stt.transcriber import KannadaTranscriber, _BANKING_HOTWORDS

        self.assertIsInstance(_BANKING_HOTWORDS, str)

        mock_model = MagicMock()
        seg = MagicMock()
        seg.text = "ಪರೀಕ್ಷೆ"
        mock_model.transcribe.return_value = ([seg], None)
        _model_cls.return_value = mock_model

        t = KannadaTranscriber("models/whisper-medium-vaani-ct2", device="cpu")
        out = t.transcribe("fake.wav")
        self.assertEqual(out, "ಪರೀಕ್ಷೆ")

        _kwargs = mock_model.transcribe.call_args.kwargs
        self.assertIsInstance(_kwargs["hotwords"], str)
        self.assertIn("ಖಾತೆ", _kwargs["hotwords"])


if __name__ == "__main__":
    unittest.main()
