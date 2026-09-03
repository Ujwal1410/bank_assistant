"""Extract digits from Kannada STT text (script + spoken words)."""

from __future__ import annotations

import re

_KN_DIGIT = str.maketrans("೦೧೨೩೪೫೬೭೮೯", "0123456789")

# Spoken Kannada number words → digit (for account numbers read digit-by-digit)
_KN_WORDS: dict[str, str] = {
    "ಸೊನ್ನೆ": "0", "ಶೂನ್ಯ": "0", "ಜೀರೋ": "0",
    "ಒಂದು": "1", "ಒನ್ನೆ": "1",
    "ಎರಡು": "2", "ಮೂರು": "3", "ನಾಲ್ಕು": "4", "ನಾಲಕು": "4",
    "ಐದು": "5", "ಆರು": "6", "ಏಳು": "7", "ಎಳು": "7",
    "ಎಂಟು": "8", "ಒಂಬತ್ತು": "9", "ಒಂಭತ್ತು": "9",
    "zero": "0", "one": "1", "two": "2", "three": "3", "four": "4",
    "five": "5", "six": "6", "seven": "7", "eight": "8", "nine": "9",
    "oh": "0", "o": "0",
}


def extract_digits_from_kannada(text: str) -> str:
    """Return digit string from Kannada/Latin STT for account numbers."""
    if not text or not text.strip():
        return ""

    # Native Kannada numerals + ASCII digits
    t = text.translate(_KN_DIGIT)
    direct = re.sub(r"\D", "", t)
    if len(direct) >= 8:
        return direct

    # Digit-by-digit spoken words
    tokens = re.findall(r"[\u0c80-\u0cff]+|[a-zA-Z]+|\d", t.lower())
    parts: list[str] = []
    for tok in tokens:
        if tok.isdigit() and len(tok) == 1:
            parts.append(tok)
        elif tok in _KN_WORDS:
            parts.append(_KN_WORDS[tok])
        elif tok.isdigit():
            parts.append(tok)
    joined = "".join(parts)
    if len(joined) >= 8:
        return joined

    return direct if len(direct) >= 4 else joined
