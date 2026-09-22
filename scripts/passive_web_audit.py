"""Run non-destructive exposure and reflection probes against a deployment."""

from __future__ import annotations

import argparse
import json
import sys
import urllib.error
import urllib.parse
import urllib.request


PRIVATE_PATHS = (
    ".env",
    ".git/config",
    "Bills972.xlsx",
    "4DMTVendorListingResults775.xlsx",
    "data/Bills972.xlsx",
    "data/4DMTVendorListingResults775.xlsx",
    "scripts/security_audit.py",
    "data/vendor_activity.json.map",
)


def request(url: str) -> tuple[int, bytes, dict[str, str]]:
    try:
        with urllib.request.urlopen(url, timeout=30) as response:
            return response.status, response.read(), dict(response.headers.items())
    except urllib.error.HTTPError as exc:
        return exc.code, exc.read(), dict(exc.headers.items())


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("base_url")
    return parser.parse_args()


def main() -> int:
    args = parse_args()
    base_url = args.base_url.rstrip("/") + "/"
    failures: list[str] = []

    status, index_body, _ = request(base_url)
    if status != 200:
        failures.append(f"Dashboard returned HTTP {status}.")
    index_text = index_body.decode("utf-8", errors="replace")
    if "Content-Security-Policy" not in index_text:
        failures.append("Dashboard HTML has no Content Security Policy.")

    marker = "<script>alert('probe')</script>"
    reflected_url = base_url + "?vendor=" + urllib.parse.quote(marker)
    reflected_status, reflected_body, _ = request(reflected_url)
    if reflected_status != 200:
        failures.append(f"Query reflection probe returned HTTP {reflected_status}.")
    if marker.encode("utf-8") in reflected_body:
        failures.append("Dashboard reflects an untrusted script marker into HTML.")

    for path in PRIVATE_PATHS:
        probe_status, _, _ = request(urllib.parse.urljoin(base_url, path))
        if 200 <= probe_status < 300:
            failures.append(f"Private or development path is publicly readable: {path}")

    data_status, data_body, headers = request(
        urllib.parse.urljoin(base_url, "data/vendor_activity.json")
    )
    if data_status != 200:
        failures.append(f"Public dashboard data returned HTTP {data_status}.")
    else:
        try:
            payload = json.loads(data_body)
            if not isinstance(payload.get("vendors"), list):
                failures.append("Public dashboard data has an invalid schema.")
        except (UnicodeDecodeError, json.JSONDecodeError):
            failures.append("Public dashboard data is not valid JSON.")
        normalized_headers = {key.casefold(): value for key, value in headers.items()}
        content_type = normalized_headers.get("content-type", "")
        if "json" not in content_type:
            failures.append(f"Public data has unexpected content type: {content_type}")

    if failures:
        print("Passive web audit failed:", file=sys.stderr)
        for failure in failures:
            print(f"- {failure}", file=sys.stderr)
        return 1

    print("Passive web audit passed: no private paths or reflected script input found.")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
