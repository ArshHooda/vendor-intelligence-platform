"""Read source workbooks locally or from private Supabase Storage."""

from __future__ import annotations

import os
import urllib.error
import urllib.parse
import urllib.request
from io import BytesIO
from pathlib import Path
from typing import BinaryIO

from .constants import DEFAULT_BUCKET


def storage_file(filename: str) -> BytesIO:
    base_url = os.getenv("SUPABASE_URL", "").rstrip("/")
    secret_key = os.getenv("SUPABASE_SECRET_KEY", "")
    bucket = os.getenv("SOURCE_BUCKET", DEFAULT_BUCKET)
    if not base_url or not secret_key:
        raise RuntimeError(
            "Set SUPABASE_URL and SUPABASE_SECRET_KEY, or pass both local workbook paths."
        )

    quoted_bucket = urllib.parse.quote(bucket, safe="")
    quoted_name = urllib.parse.quote(filename, safe="")
    request = urllib.request.Request(
        f"{base_url}/storage/v1/object/{quoted_bucket}/{quoted_name}",
        headers={"apikey": secret_key},
    )
    try:
        with urllib.request.urlopen(request, timeout=60) as response:
            content = response.read()
    except urllib.error.HTTPError as exc:
        raise RuntimeError(f"Storage returned HTTP {exc.code} for {filename}.") from exc
    except urllib.error.URLError as exc:
        raise RuntimeError(f"Could not download {filename} from Supabase Storage.") from exc

    if content[:4] != b"PK\x03\x04":
        raise RuntimeError(f"Downloaded file is not an XLSX workbook: {filename}")
    return BytesIO(content)


def workbook_source(path: Path | None, filename: str) -> Path | BinaryIO:
    if path:
        if not path.is_file():
            raise FileNotFoundError(path)
        return path
    return storage_file(filename)
