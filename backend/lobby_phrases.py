"""Fixed Kannada lobby phrases — used for greet handoff and form UX."""

from __future__ import annotations

# Spoken once after time-of-day greeting, before the first listen.
ASK_NEED_KN = "ದಯವಿಟ್ಟು ಹೇಳಿ — ನಿಮಗೆ ಏನು ಸಹಾಯ ಬೇಕು?"

FORM_READY_KN = "ಅರ್ಜಿ ಸಿದ್ಧ. ಪ್ರಿಂಟ್ ಮಾಡಬಹುದು. ಮುಗಿಸು ಅಥವಾ ಮುಂದುವರಿಸಿ."

FORM_CONFIRM_SUFFIX_KN = "ಸರಿಯೇ? ಹೌದು ಅಥವಾ ಮತ್ತೆ ಹೇಳಿ."

FORM_SUMMARY_OPENER_KN = "ನಿಮ್ಮ ಅರ್ಜಿ ಸಿದ್ಧ."

FORM_SUMMARY_CLOSER_KN = "ಪ್ರಿಂಟ್ ಮಾಡಬಹುದು."

FORM_WHOLE_CONFIRM_KN = "ಎಲ್ಲಾ ಸರಿಯೇ? ಹೌದು ಎಂದರೆ ಮುಗಿಸಿ, ಇಲ್ಲ ಎಂದರೆ ಮತ್ತೆ ಹೇಳಿ."

# Pre-warm these on API startup so the first customer hears them instantly.
def _greet_prewarm_lines() -> tuple[str, ...]:
    from backend.greetings import GREET_LINES

    return tuple(lines[0]["line_kn"] for lines in GREET_LINES.values() if lines)


PREWARM_PHRASES: tuple[str, ...] = (
    ASK_NEED_KN,
    FORM_READY_KN,
    FORM_WHOLE_CONFIRM_KN,
    "ನಿಮ್ಮ ಪೂರ್ಣ ಹೆಸರು ಏನು?",
    "ಖಾತೆ ಸಂಖ್ಯೆ ಹೇಳಿ.",
    "ಎಷ್ಟು ಮೊತ್ತ?",
) + _greet_prewarm_lines()
