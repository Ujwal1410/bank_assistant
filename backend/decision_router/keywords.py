"""Keyword routing for account_info_query → specific bank_info procedures."""

from __future__ import annotations

import re

# Maps spoken keywords → bank_info.json account_procedures key
ACCOUNT_INFO_KEYWORDS: dict[str, tuple[str, ...]] = {
    "atm_block": (
        "block atm", "block card", "atm block", "card block", "lost card",
        "stolen card", "atm card block", "debit block",
    ),
    "pin_change": (
        "pin change", "change pin", "atm pin", "new pin", "reset pin",
    ),
    "cheque_book": (
        "cheque book", "check book", "chequebook", "new cheque book",
    ),
    "mobile_update": (
        "mobile update", "change mobile", "update mobile", "phone number",
        "registered mobile", "mobile number",
    ),
    "name_change": (
        "name change", "change name", "update name", "name correction",
    ),
    "internet_banking": (
        "internet banking", "net banking", "online banking", "activate banking",
    ),
    "mini_statement": (
        "mini statement", "last transactions", "statement", "transaction history",
    ),
    "branch_locator": (
        "nearest branch", "branch location", "find branch", "branch address",
    ),
    "nominee_update": (
        "nominee", "nominee update", "change nominee",
    ),
}


def match_account_procedure(query_text: str) -> str | None:
    """Return bank_info account_procedures key or None."""
    text = re.sub(r"\s+", " ", (query_text or "").lower()).strip()
    if not text:
        return None
    best_key: str | None = None
    best_len = 0
    for key, keywords in ACCOUNT_INFO_KEYWORDS.items():
        for kw in keywords:
            if kw in text and len(kw) > best_len:
                best_key = key
                best_len = len(kw)
    return best_key
