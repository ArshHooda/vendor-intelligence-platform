"""Shared constants for workbook parsing and public output."""

from __future__ import annotations

import re


VENDOR_ID_PATTERN = re.compile(r"\bVEN\d{5}\b", re.IGNORECASE)
DEFAULT_BILLS_FILE = "Bills972.xlsx"
DEFAULT_VENDORS_FILE = "4DMTVendorListingResults775.xlsx"
DEFAULT_BUCKET = "ap-source-files"

CURRENCY_CODES = {
    "australian dollar": "AUD",
    "british pound": "GBP",
    "canadian dollar": "CAD",
    "euro": "EUR",
    "japanese yen": "JPY",
    "swedish krona": "SEK",
    "swiss franc": "CHF",
    "us dollar": "USD",
}

PUBLIC_PURCHASE_FIELDS = (
    "purchase_id",
    "purchase_date",
    "status",
    "currency",
    "currency_code",
    "original_amount",
    "base_amount_usd",
    "payment_hold",
    "payment_hold_reason",
)

PUBLIC_VENDOR_FIELDS = (
    "vendor_source_id",
    "vendor_name",
    "vendor_status",
    "vendor_approval_status",
    "vendor_country",
    "master_last_paid_date",
    "bill_count",
    "total_spend",
    "average_bill_amount",
    "largest_bill_amount",
    "first_purchase_date",
    "last_purchase_date",
    "days_since_last_purchase",
    "purchase_frequency_per_month",
    "average_gap_days",
    "payment_status",
    "payment_statuses",
    "open_spend",
    "payment_hold_count",
    "payment_hold_amount",
    "vendor_record_count",
    "spend_share_percent",
    "risk_label",
    "purchases",
)

# These source fields are deliberately never copied into the public artifact.
EXCLUDED_SENSITIVE_FIELDS = (
    "Document Number",
    "Transaction Number",
    "Memo",
    "Account",
    "Preferred Entity Bank",
    "Vendor Bank Fees",
    "Bank Fee",
    "Entity Bank (Vendor)",
    "Entity Bank (Employee)",
    "Entity Bank (Customer)",
    "Entity Bank (Customer Credit)",
    "Approver",
    "Next Approver (EQ PR)",
    "Therapeutic Area",
    "Program",
    "Indication",
    "Email Address",
    "Address 1",
    "Address 2",
    "City",
    "State/Province",
    "Zip Code",
    "Internal ID",
    "Comments",
)
