"""Create vendor summaries and attach public-safe purchase records."""

from __future__ import annotations

from collections import Counter
from datetime import datetime, timezone
from decimal import Decimal
from statistics import mean
from typing import Any

from .constants import EXCLUDED_SENSITIVE_FIELDS, PUBLIC_PURCHASE_FIELDS
from .values import calendar_months


def _primary_payment_status(status_counts: Counter) -> str:
    attention_status = next(
        (
            status
            for keyword in ("open", "reject")
            for status in status_counts
            if keyword in status.casefold()
        ),
        None,
    )
    if attention_status:
        return attention_status
    if not status_counts:
        return "No purchases"
    return sorted(status_counts.items(), key=lambda item: (-item[1], item[0]))[0][0]


def _risk_label(
    *,
    duplicate_count: int,
    hold_count: int,
    spend_share: float,
    bill_count: int,
) -> str:
    if duplicate_count > 1:
        return "Duplicate vendor record"
    if hold_count:
        return "Payment hold"
    if spend_share >= 25:
        return "High concentration"
    if not bill_count:
        return "No purchase history"
    return "Normal"


def build_output(
    vendors: dict[str, dict[str, Any]],
    duplicates: Counter,
    activity: dict[str, dict[str, Any]],
    diagnostics: dict[str, int],
) -> dict[str, Any]:
    all_dates = [day for vendor in activity.values() for day in vendor["dates"]]
    as_of_date = max(all_dates) if all_dates else None
    total_spend = sum(
        (vendor["total_spend"] for vendor in activity.values()),
        start=Decimal("0"),
    )
    records: list[dict[str, Any]] = []

    for vendor_id, master in vendors.items():
        source = activity.get(vendor_id)
        bill_count = int(source["bill_count"]) if source else 0
        vendor_spend = source["total_spend"] if source else Decimal("0")
        dates = sorted(source["dates"]) if source else []
        first_purchase = dates[0] if dates else None
        last_purchase = dates[-1] if dates else None
        gaps = [(current - previous).days for previous, current in zip(dates, dates[1:])]
        status_counts = source["payment_status_counts"] if source else Counter()
        hold_count = int(source["payment_hold_count"]) if source else 0
        spend_share = float(vendor_spend / total_spend * 100) if total_spend else 0.0
        purchases = list(source["purchases"]) if source else []
        purchases.sort(
            key=lambda item: (item["purchase_date"] or "", item["purchase_id"]),
            reverse=True,
        )

        records.append(
            {
                **master,
                "bill_count": bill_count,
                "total_spend": round(float(vendor_spend), 2),
                "average_bill_amount": round(float(vendor_spend / bill_count), 2)
                if bill_count
                else None,
                "largest_bill_amount": round(float(source["largest_bill_amount"]), 2)
                if source and source["largest_bill_amount"] is not None
                else None,
                "first_purchase_date": first_purchase.isoformat() if first_purchase else None,
                "last_purchase_date": last_purchase.isoformat() if last_purchase else None,
                "days_since_last_purchase": (as_of_date - last_purchase).days
                if as_of_date and last_purchase
                else None,
                "purchase_frequency_per_month": round(
                    bill_count / calendar_months(first_purchase, last_purchase), 2
                )
                if first_purchase and last_purchase
                else 0,
                "average_gap_days": round(mean(gaps), 1) if gaps else None,
                "payment_status": _primary_payment_status(status_counts),
                "payment_statuses": sorted(status_counts),
                "open_spend": round(float(source["open_spend"]), 2) if source else 0,
                "payment_hold_count": hold_count,
                "payment_hold_amount": round(float(source["payment_hold_amount"]), 2)
                if source
                else 0,
                "vendor_record_count": duplicates[vendor_id],
                "spend_share_percent": round(spend_share, 4),
                "risk_label": _risk_label(
                    duplicate_count=duplicates[vendor_id],
                    hold_count=hold_count,
                    spend_share=spend_share,
                    bill_count=bill_count,
                ),
                "purchases": purchases,
            }
        )

    records.sort(key=lambda item: (item["vendor_name"].casefold(), item["vendor_source_id"]))
    published_purchase_rows = sum(len(record["purchases"]) for record in records)
    return {
        "metadata": {
            "generated_at": datetime.now(timezone.utc).isoformat(),
            "as_of_date": as_of_date.isoformat() if as_of_date else None,
            "vendor_master_rows": sum(duplicates.values()),
            "unique_vendors": len(vendors),
            "vendors_with_purchases": sum(record["bill_count"] > 0 for record in records),
            "total_spend": round(float(total_spend), 2),
            "published_purchase_rows": published_purchase_rows,
            "purchase_identifier_policy": "Per-build HMAC pseudonym; source IDs are excluded.",
            "published_purchase_fields": list(PUBLIC_PURCHASE_FIELDS),
            "excluded_sensitive_fields": list(EXCLUDED_SENSITIVE_FIELDS),
            **diagnostics,
        },
        "vendors": records,
    }
