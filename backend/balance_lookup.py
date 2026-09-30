"""Demo / production-shaped account balance lookup for the kiosk."""

from __future__ import annotations

import os
import re

from backend.db.customers import get_account_balance, write_balance_audit
from backend.forms.summary_kn import amount_speak_kn, digits_to_kannada_words


def _normalize_account(raw: str) -> str:
    return re.sub(r"\D", "", raw or "")


def lookup_balance(account_number: str, *, kiosk_session_id: str = "") -> dict:
    acct = _normalize_account(account_number)
    try:
        expected_length = max(4, int(os.environ.get("BANK_DEMO_ACCOUNT_LENGTH", "10")))
    except ValueError:
        expected_length = 10
    if len(acct) != expected_length:
        expected_length_kn = (
            "ಹತ್ತು"
            if expected_length == 10
            else digits_to_kannada_words(str(expected_length))
        )
        write_balance_audit(
            account_number=acct,
            found=False,
            kiosk_session_id=kiosk_session_id,
            source="length_reject",
        )
        return {
            "found": False,
            "account_number": acct,
            "message_en": f"Please provide a valid {expected_length}-digit account number.",
            "message_kn": (
                f"ದಯವಿಟ್ಟು {expected_length_kn} "
                "ಅಂಕೆಗಳಿರುವ ಸರಿಯಾದ ಖಾತೆ ಸಂಖ್ಯೆಯನ್ನು ಒಂದೊಂದೇ ಅಂಕಿಯಾಗಿ ಹೇಳಿ."
            ),
        }

    row = get_account_balance(acct)
    if not row:
        spoken_acct = digits_to_kannada_words(acct)
        write_balance_audit(
            account_number=acct,
            found=False,
            kiosk_session_id=kiosk_session_id,
            source="not_found",
        )
        return {
            "found": False,
            "account_number": acct,
            "message_en": (
                f"Account number {acct} was not found. "
                "Please check the number and try again."
            ),
            "message_kn": (
                f"ಖಾತೆ ಸಂಖ್ಯೆ {spoken_acct} ನಮ್ಮ ದಾಖಲೆಗಳಲ್ಲಿ ಕಂಡುಬಂದಿಲ್ಲ. "
                "ದಯವಿಟ್ಟು ಸಂಖ್ಯೆಯನ್ನು ಪರಿಶೀಲಿಸಿ ಮತ್ತೆ ಹೇಳಿ."
            ),
        }

    bal = float(row["balance_inr"])
    bal_str = f"{bal:,.2f}"
    name_kn = row.get("holder_name_kn") or row.get("holder_name", "")
    name_en = row.get("holder_name", "")
    spoken_acct = digits_to_kannada_words(acct)
    spoken_balance = amount_speak_kn(str(bal))
    write_balance_audit(
        account_number=acct,
        found=True,
        customer_id=row.get("customer_id"),
        kiosk_session_id=kiosk_session_id,
        source=str(row.get("source") or "lookup"),
    )

    return {
        "found": True,
        "account_number": acct,
        "balance_inr": bal,
        "holder_name": name_en,
        "holder_name_kn": name_kn,
        "account_type": row.get("account_type", "Savings"),
        "customer_id": row.get("customer_id"),
        "source": row.get("source"),
        "message_en": (
            f"Account {acct} in the name of {name_en}. "
            f"Your available balance is {bal_str} rupees."
        ),
        "message_kn": (
            f"ಖಾತೆ ಸಂಖ್ಯೆ {spoken_acct}. {name_kn} ಅವರ ಖಾತೆಯಲ್ಲಿ "
            f"ಪ್ರಸ್ತುತ ಲಭ್ಯವಿರುವ ಶಿಲ್ಕು {spoken_balance}."
        ),
    }
