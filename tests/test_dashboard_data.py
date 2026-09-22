from __future__ import annotations

import json
import unittest
from io import BytesIO

import openpyxl

from scripts.dashboard_data.builder import build_output
from scripts.dashboard_data.constants import PUBLIC_PURCHASE_FIELDS
from scripts.dashboard_data.security import validate_public_output
from scripts.dashboard_data.values import safe_purchase_reference
from scripts.dashboard_data.workbooks import load_bill_activity, load_vendor_master


def workbook_bytes(headers: list[str], rows: list[list[object]]) -> BytesIO:
    workbook = openpyxl.Workbook()
    sheet = workbook.active
    sheet.append(headers)
    for row in rows:
        sheet.append(row)
    output = BytesIO()
    workbook.save(output)
    workbook.close()
    output.seek(0)
    return output


class DashboardDataTests(unittest.TestCase):
    def setUp(self) -> None:
        self.vendor_source = workbook_bytes(
            [
                "ID",
                "Name",
                "Country",
                "Email Address",
                "Status",
                "Last Paid Date",
                "Approval Status",
                "Address 1",
                "Internal ID",
            ],
            [[
                "VEN00001",
                "Example Supplier",
                "United States",
                "private@example.test",
                "Active",
                "2026-01-20",
                "Approved",
                "1 Private Street",
                "99123",
            ]],
        )
        self.bill_source = workbook_bytes(
            [
                "Date",
                "Document Number",
                "Transaction Number",
                "Name",
                "Account",
                "Status",
                "Memo",
                "Currency",
                "Amount (Foreign Currency)",
                "Amount",
                "Preferred Entity Bank",
                "Approver",
                "Payment Hold Reason",
            ],
            [
                [
                    "2026-01-10",
                    "PRIVATE-DOC-100",
                    "PRIVATE-TXN-200",
                    "VEN00001 Example Supplier",
                    "Confidential R&D",
                    "Paid In Full",
                    "Secret trial memo",
                    "US Dollar",
                    125.50,
                    125.50,
                    "Sensitive Bank",
                    "private.approver@example.test",
                    None,
                ],
                [
                    "2026-02-10",
                    "PRIVATE-DOC-101",
                    "PRIVATE-TXN-201",
                    "VEN00001 Example Supplier",
                    "Confidential R&D",
                    "Open",
                    "Another secret memo",
                    "Euro",
                    200,
                    215,
                    "Sensitive Bank",
                    "private.approver@example.test",
                    "Pending Vendor Approval",
                ],
            ],
        )

    def test_builds_allowlisted_purchase_details_without_private_values(self) -> None:
        vendors, duplicates = load_vendor_master(self.vendor_source)
        activity, diagnostics = load_bill_activity(
            self.bill_source,
            reference_salt=b"fixed-test-salt",
        )
        output = build_output(vendors, duplicates, activity, diagnostics)
        validate_public_output(output)

        vendor = output["vendors"][0]
        self.assertEqual(vendor["bill_count"], 2)
        self.assertEqual(vendor["total_spend"], 340.50)
        self.assertEqual(len(vendor["purchases"]), 2)
        self.assertEqual(set(vendor["purchases"][0]), set(PUBLIC_PURCHASE_FIELDS))
        self.assertEqual(vendor["purchases"][0]["status"], "Open")
        self.assertEqual(vendor["purchases"][0]["currency_code"], "EUR")

        serialized = json.dumps(output["vendors"])
        for private_value in (
            "PRIVATE-DOC-100",
            "PRIVATE-TXN-200",
            "private@example.test",
            "private.approver@example.test",
            "Secret trial memo",
            "Confidential R&D",
            "Sensitive Bank",
            "1 Private Street",
            "99123",
        ):
            self.assertNotIn(private_value, serialized)

    def test_purchase_references_are_salted_and_pseudonymous(self) -> None:
        first = safe_purchase_reference("DOC-1", "TXN-1", salt=b"salt-a")
        repeated = safe_purchase_reference("DOC-1", "TXN-1", salt=b"salt-a")
        different_build = safe_purchase_reference("DOC-1", "TXN-1", salt=b"salt-b")

        self.assertRegex(first, r"^PUR-[A-F0-9]{12}$")
        self.assertEqual(first, repeated)
        self.assertNotEqual(first, different_build)
        self.assertNotIn("DOC", first)
        self.assertNotIn("TXN", first)


if __name__ == "__main__":
    unittest.main()
