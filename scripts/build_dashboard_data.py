"""Build the browser-safe dataset used by the static dashboard."""

from __future__ import annotations

import argparse
import json
import secrets
import sys
from pathlib import Path

from dashboard_data.builder import build_output
from dashboard_data.constants import DEFAULT_BILLS_FILE, DEFAULT_VENDORS_FILE
from dashboard_data.security import validate_public_output
from dashboard_data.storage import workbook_source
from dashboard_data.workbooks import load_bill_activity, load_vendor_master


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--bills-file", type=Path)
    parser.add_argument("--vendors-file", type=Path)
    parser.add_argument(
        "--output",
        type=Path,
        default=Path("dist/data/vendor_activity.json"),
    )
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    reference_salt = secrets.token_bytes(32)

    try:
        vendors, duplicates = load_vendor_master(
            workbook_source(args.vendors_file, DEFAULT_VENDORS_FILE)
        )
        activity, diagnostics = load_bill_activity(
            workbook_source(args.bills_file, DEFAULT_BILLS_FILE),
            reference_salt=reference_salt,
        )
        output = build_output(vendors, duplicates, activity, diagnostics)
        validate_public_output(output)
        args.output.parent.mkdir(parents=True, exist_ok=True)
        args.output.write_text(
            json.dumps(output, ensure_ascii=False, separators=(",", ":")),
            encoding="utf-8",
        )
    except (FileNotFoundError, RuntimeError, ValueError, OSError) as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        return 1

    metadata = output["metadata"]
    print(
        "Dashboard data ready: "
        f"{metadata['unique_vendors']} vendors, "
        f"{metadata['published_purchase_rows']} safe purchase records, "
        f"${metadata['total_spend']:,.2f} total spend."
    )
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
