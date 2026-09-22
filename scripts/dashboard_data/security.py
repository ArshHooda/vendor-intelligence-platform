"""Fail closed when a public dashboard artifact contains unexpected data."""

from __future__ import annotations

import re
from typing import Any

from .constants import PUBLIC_PURCHASE_FIELDS, PUBLIC_VENDOR_FIELDS


PURCHASE_ID_PATTERN = re.compile(r"^PUR-[A-F0-9]{12}$")
EMAIL_PATTERN = re.compile(r"\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b", re.IGNORECASE)
SECRET_PATTERN = re.compile(r"\bsb_(?:secret|service_role)_[A-Za-z0-9_-]{16,}\b")


def validate_public_output(output: dict[str, Any]) -> None:
    vendors = output.get("vendors")
    if not isinstance(vendors, list) or not vendors:
        raise ValueError("Public output must contain a non-empty vendor list.")

    allowed_vendor_fields = set(PUBLIC_VENDOR_FIELDS)
    allowed_purchase_fields = set(PUBLIC_PURCHASE_FIELDS)
    purchase_count = 0
    purchase_ids: set[str] = set()

    for vendor in vendors:
        if set(vendor) != allowed_vendor_fields:
            raise ValueError("Public vendor record does not match the approved field list.")
        purchases = vendor.get("purchases")
        if not isinstance(purchases, list):
            raise ValueError("Every public vendor record must contain a purchase list.")

        for purchase in purchases:
            purchase_count += 1
            if set(purchase) != allowed_purchase_fields:
                raise ValueError("Public purchase record does not match the approved field list.")
            purchase_id = str(purchase.get("purchase_id", ""))
            if not PURCHASE_ID_PATTERN.fullmatch(purchase_id):
                raise ValueError("Public purchase record contains a source or malformed identifier.")
            if purchase_id in purchase_ids:
                raise ValueError("Public purchase references must be unique.")
            purchase_ids.add(purchase_id)

    metadata = output.get("metadata", {})
    if metadata.get("published_purchase_rows") != purchase_count:
        raise ValueError("Published purchase count does not match the generated records.")
    if metadata.get("matched_bill_rows") != purchase_count:
        raise ValueError("A matched source bill is missing from the public purchase records.")

    public_text = repr(vendors)
    if EMAIL_PATTERN.search(public_text):
        raise ValueError("Public output appears to contain an email address.")
    if SECRET_PATTERN.search(public_text):
        raise ValueError("Public output appears to contain a Supabase secret key.")
