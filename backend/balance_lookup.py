"""Demo account balance lookup — simulates core banking for the kiosk."""

from __future__ import annotations

import json
import os
import re

_PROJECT_ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), ".."))
_ACCOUNTS_PATH = os.path.join(_PROJECT_ROOT, "data", "demo_accounts.json")

with open(_ACCOUNTS_PATH, encoding="utf-8") as _f:
    _ACCOUNTS: dict[str, dict] = json.load(_f)


def _normalize_account(raw: str) -> str:
    return re.sub(r"\D", "", raw or "")


def lookup_balance(account_number: str) -> dict:
    acct = _normalize_account(account_number)
    if not acct or len(acct) < 8:
        return {
            "found": False,
            "account_number": acct,
            "message_en": "Please provide a valid account number with at least 8 digits.",
            "message_kn": "ದಯವಿಟ್ಟು ಸರಿಯಾದ ಖಾತೆ ಸಂಖ್ಯೆಯನ್ನು ಹೇಳಿ — ಕನಿಷ್ಠ ೮ ಅಂಕೆಗಳು.",
        }

    row = _ACCOUNTS.get(acct)
    if not row:
        return {
            "found": False,
            "account_number": acct,
            "message_en": (
                f"Account number {acct} was not found. "
                "Please check the number and try again."
            ),
            "message_kn": (
                f"ಖಾತೆ ಸಂಖ್ಯೆ {acct} ನಮ್ಮ ದಾಖಲೆಗಳಲ್ಲಿ ಕಂಡುಬಂದಿಲ್ಲ. "
                "ದಯವಿಟ್ಟು ಮತ್ತೆ ಪ್ರಯತ್ನಿಸಿ."
            ),
        }

    bal = float(row["balance_inr"])
    bal_str = f"{bal:,.2f}"
    name_kn = row.get("holder_name_kn") or row.get("holder_name", "")
    name_en = row.get("holder_name", "")

    return {
        "found": True,
        "account_number": acct,
        "balance_inr": bal,
        "holder_name": name_en,
        "holder_name_kn": name_kn,
        "account_type": row.get("account_type", "Savings"),
        "message_en": (
            f"Account {acct} in the name of {name_en}. "
            f"Your available balance is {bal_str} rupees."
        ),
        "message_kn": (
            f"ಖಾತೆ ಸಂಖ್ಯೆ {acct}. {name_kn} ಅವರ ಖಾತೆಯಲ್ಲಿ "
            f"ಪ್ರಸ್ತುತ ಲಭ್ಯ ಬಾಕಿ {bal_str} ರೂಪಾಯಿ."
        ),
    }
