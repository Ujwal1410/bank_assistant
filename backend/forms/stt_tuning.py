"""STT beam / field hints for voice form fill."""

from __future__ import annotations

NAME_FIELD_IDS = frozenset(
    {
        "full_name",
        "name",
        "applicant_name",
        "beneficiary_name",
        "remitter_name",
        "nominee_name",
    }
)


def form_fill_beam_size(field_type: str, field_id: str) -> int:
    """Higher beam = clearer STT for names and text; confirm kept moderate."""
    fid = (field_id or "").lower()
    ftype = (field_type or "text").lower()
    if fid == "confirm":
        return 3
    if fid in NAME_FIELD_IDS or ftype == "text":
        return 5
    return 3
