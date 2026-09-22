"""Value normalization helpers with conservative failure behavior."""

from __future__ import annotations

import hashlib
import hmac
from datetime import date, datetime
from decimal import Decimal, InvalidOperation
from typing import Any

from openpyxl.utils.datetime import from_excel


def header_positions(headers: tuple[Any, ...]) -> dict[str, int]:
    positions: dict[str, int] = {}
    for index, value in enumerate(headers):
        key = str(value or "").strip().casefold()
        if key and key not in positions:
            positions[key] = index
    return positions


def value_at(row: tuple[Any, ...], positions: dict[str, int], name: str) -> Any:
    index = positions.get(name.casefold())
    return row[index] if index is not None and index < len(row) else None


def clean_text(value: Any) -> str | None:
    if value is None:
        return None
    text = str(value).strip()
    if not text or text.casefold() in {"- none -", "none", "null", "nan"}:
        return None
    return text


def as_decimal(value: Any) -> Decimal:
    if value is None or value == "":
        return Decimal("0")
    try:
        return Decimal(str(value).replace(",", "").strip())
    except (InvalidOperation, AttributeError):
        return Decimal("0")


def as_date(value: Any) -> date | None:
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    if isinstance(value, (int, float)):
        try:
            converted = from_excel(value)
            return converted.date() if isinstance(converted, datetime) else converted
        except (TypeError, ValueError, OverflowError):
            return None
    text = clean_text(value)
    if not text:
        return None
    for parser in (
        lambda item: datetime.fromisoformat(item.replace("Z", "+00:00")).date(),
        lambda item: datetime.strptime(item, "%m/%d/%Y").date(),
        lambda item: datetime.strptime(item, "%Y-%m-%d").date(),
    ):
        try:
            return parser(text)
        except ValueError:
            continue
    return None


def calendar_months(first_date: date, last_date: date) -> int:
    return max(
        1,
        (last_date.year - first_date.year) * 12
        + last_date.month
        - first_date.month
        + 1,
    )


def safe_purchase_reference(
    document_number: Any,
    transaction_number: Any,
    *,
    salt: bytes,
) -> str:
    """Return a per-build pseudonym without publishing either source identifier."""
    source = "\x1f".join(
        (clean_text(document_number) or "", clean_text(transaction_number) or "")
    )
    digest = hmac.new(salt, source.encode("utf-8"), hashlib.sha256).hexdigest()
    return f"PUR-{digest[:12].upper()}"
