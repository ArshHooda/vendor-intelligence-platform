from __future__ import annotations

import hashlib
import json
import os
import sys
import uuid
from dataclasses import dataclass
from datetime import date, datetime, time, timezone
from io import BytesIO
from typing import Any
from urllib import error, parse, request

import psycopg
from openpyxl import load_workbook
from psycopg import sql
from psycopg.types.json import Jsonb


DEFAULT_FILES = "Bills972.xlsx,4DMTVendorListingResults775.xlsx"


@dataclass(frozen=True)
class Column:
    name: str
    data_type: str
    udt_name: str
    column_default: str | None
    is_identity: bool


def require_env(name: str) -> str:
    value = os.getenv(name)
    if not value:
        raise RuntimeError(f"Missing environment variable: {name}")
    return value


def source_file_list() -> list[str]:
    raw = os.getenv("SOURCE_FILES", DEFAULT_FILES)
    files = [item.strip() for item in raw.split(",") if item.strip()]
    if not files:
        raise RuntimeError("SOURCE_FILES did not contain any file names.")
    return files


def download_storage_object(base_url: str, key: str, bucket: str, object_path: str) -> bytes:
    quoted_bucket = parse.quote(bucket, safe="")
    quoted_path = parse.quote(object_path, safe="/")
    url = f"{base_url.rstrip('/')}/storage/v1/object/{quoted_bucket}/{quoted_path}"
    storage_request = request.Request(
        url,
        headers={
            "apikey": key,
            "Authorization": f"Bearer {key}",
        },
    )
    try:
        with request.urlopen(storage_request, timeout=60) as response:
            return response.read()
    except error.HTTPError as exc:
        raise RuntimeError(f"Storage HTTP {exc.code}: {object_path}") from exc
    except error.URLError as exc:
        raise RuntimeError(f"Storage connection failed: {object_path}") from exc


def file_sha256(data: bytes) -> str:
    return hashlib.sha256(data).hexdigest()


def excel_value(value: Any) -> Any:
    if isinstance(value, (datetime, date, time)):
        return value.isoformat()
    return value


def header_name(value: Any, position: int, seen: dict[str, int]) -> str:
    if value is None or str(value).strip() == "":
        base = f"column_{position}"
    else:
        base = " ".join(str(value).strip().split())

    count = seen.get(base, 0) + 1
    seen[base] = count
    if count == 1:
        return base
    return f"{base}_{count}"


def parse_workbook(data: bytes, object_path: str) -> list[dict[str, Any]]:
    workbook = load_workbook(BytesIO(data), read_only=True, data_only=True)
    parsed_rows: list[dict[str, Any]] = []

    for worksheet in workbook.worksheets:
        rows = worksheet.iter_rows(values_only=True)
        header_values = None
        header_row_number = 0

        for row_number, row in enumerate(rows, start=1):
            if any(cell is not None and str(cell).strip() != "" for cell in row):
                header_values = row
                header_row_number = row_number
                break

        if header_values is None:
            continue

        seen: dict[str, int] = {}
        headers = [
            header_name(value, position, seen)
            for position, value in enumerate(header_values, start=1)
        ]

        for row_number, row in enumerate(rows, start=header_row_number + 1):
            values = [excel_value(cell) for cell in row]
            if not any(value not in (None, "") for value in values):
                continue

            row_data = {
                headers[index]: values[index] if index < len(values) else None
                for index in range(len(headers))
            }
            hash_payload = {
                "object_path": object_path,
                "sheet_name": worksheet.title,
                "row_number": row_number,
                "row_data": row_data,
            }
            row_hash = hashlib.sha256(
                json.dumps(hash_payload, sort_keys=True, separators=(",", ":")).encode(
                    "utf-8"
                )
            ).hexdigest()
            parsed_rows.append(
                {
                    "sheet_name": worksheet.title,
                    "row_number": row_number,
                    "row_data": row_data,
                    "row_hash": row_hash,
                }
            )

    return parsed_rows


def table_columns(conn: psycopg.Connection[Any], schema: str, table: str) -> dict[str, Column]:
    rows = conn.execute(
        """
        select column_name, data_type, udt_name, column_default, is_identity
        from information_schema.columns
        where table_schema = %s and table_name = %s
        order by ordinal_position
        """,
        (schema, table),
    ).fetchall()
    if not rows:
        raise RuntimeError(f"Table not found or not visible: {schema}.{table}")

    return {
        row[0]: Column(
            name=row[0],
            data_type=row[1],
            udt_name=row[2],
            column_default=row[3],
            is_identity=(row[4] == "YES"),
        )
        for row in rows
    }


def choose(columns: dict[str, Column], names: list[str]) -> str | None:
    for name in names:
        if name in columns:
            return name
    return None


def prepare_value(column: Column, value: Any) -> Any:
    if isinstance(value, (dict, list)):
        if column.data_type in {"json", "jsonb"} or column.udt_name in {"json", "jsonb"}:
            return Jsonb(value)
        return json.dumps(value, sort_keys=True, separators=(",", ":"))
    return value


def insert_one(
    conn: psycopg.Connection[Any],
    schema: str,
    table: str,
    columns: dict[str, Column],
    values: dict[str, Any],
    returning: str | None = None,
) -> Any:
    filtered = {
        name: prepare_value(columns[name], value)
        for name, value in values.items()
        if name in columns and value is not None
    }
    if not filtered:
        raise RuntimeError(f"No matching columns were found for {schema}.{table}.")

    query = sql.SQL("insert into {}.{} ({}) values ({})").format(
        sql.Identifier(schema),
        sql.Identifier(table),
        sql.SQL(", ").join(sql.Identifier(name) for name in filtered),
        sql.SQL(", ").join(sql.Placeholder() for _ in filtered),
    )
    if returning:
        query += sql.SQL(" returning {}").format(sql.Identifier(returning))
    result = conn.execute(query, list(filtered.values()))
    if returning:
        return result.fetchone()[0]
    return None


def insert_many(
    conn: psycopg.Connection[Any],
    schema: str,
    table: str,
    columns: dict[str, Column],
    rows: list[dict[str, Any]],
    batch_size: int,
) -> None:
    if not rows:
        return

    insert_columns = list(rows[0].keys())
    query = sql.SQL("insert into {}.{} ({}) values ({})").format(
        sql.Identifier(schema),
        sql.Identifier(table),
        sql.SQL(", ").join(sql.Identifier(name) for name in insert_columns),
        sql.SQL(", ").join(sql.Placeholder() for _ in insert_columns),
    )

    for start in range(0, len(rows), batch_size):
        batch = rows[start : start + batch_size]
        params = [
            [
                prepare_value(columns[name], row[name])
                for name in insert_columns
            ]
            for row in batch
        ]
        conn.executemany(query, params)


def existing_source_file_id(
    conn: psycopg.Connection[Any],
    columns: dict[str, Column],
    bucket: str,
    object_path: str,
    sha256: str,
    id_column: str | None,
) -> Any:
    predicates: list[sql.Composable] = []
    params: list[Any] = []

    bucket_column = choose(columns, ["bucket", "bucket_name", "storage_bucket"])
    path_column = choose(columns, ["object_path", "storage_path", "path"])
    sha_column = choose(columns, ["file_sha256", "sha256", "content_sha256"])

    if bucket_column:
        predicates.append(sql.SQL("{} = %s").format(sql.Identifier(bucket_column)))
        params.append(bucket)
    if path_column:
        predicates.append(sql.SQL("{} = %s").format(sql.Identifier(path_column)))
        params.append(object_path)
    if sha_column:
        predicates.append(sql.SQL("{} = %s").format(sql.Identifier(sha_column)))
        params.append(sha256)
    if not predicates:
        return None

    select_column = sql.Identifier(id_column) if id_column else sql.SQL("1")
    query = sql.SQL("select {} from staging.source_files where {} limit 1").format(
        select_column,
        sql.SQL(" and ").join(predicates),
    )
    row = conn.execute(query, params).fetchone()
    return row[0] if row else None


def source_file_values(
    columns: dict[str, Column],
    source_file_id: str | None,
    bucket: str,
    object_path: str,
    data: bytes,
    sha256: str,
    rows_loaded: int,
    sheets_loaded: int,
) -> dict[str, Any]:
    file_name = object_path.rsplit("/", 1)[-1]
    metadata = {
        "bucket": bucket,
        "object_path": object_path,
        "file_name": file_name,
        "file_size_bytes": len(data),
        "rows_loaded": rows_loaded,
        "sheets_loaded": sheets_loaded,
    }
    values: dict[str, Any] = {
        "source_file_id": source_file_id,
        "id": source_file_id,
        "file_id": source_file_id,
        "bucket": bucket,
        "bucket_name": bucket,
        "storage_bucket": bucket,
        "object_path": object_path,
        "storage_path": object_path,
        "path": object_path,
        "file_name": file_name,
        "filename": file_name,
        "original_filename": file_name,
        "source_filename": file_name,
        "file_type": "xlsx",
        "source_type": "xlsx",
        "mime_type": "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
        "file_sha256": sha256,
        "sha256": sha256,
        "content_sha256": sha256,
        "file_size_bytes": len(data),
        "size_bytes": len(data),
        "content_length": len(data),
        "row_count": rows_loaded,
        "rows_loaded": rows_loaded,
        "source_row_count": rows_loaded,
        "sheet_count": sheets_loaded,
        "status": "loaded",
        "metadata": metadata,
        "details": metadata,
        "import_metadata": metadata,
    }

    for id_name in ["source_file_id", "id", "file_id"]:
        if id_name in columns:
            column = columns[id_name]
            if column.is_identity or column.column_default:
                values.pop(id_name, None)
    return values


def source_row_insert_rows(
    columns: dict[str, Column],
    source_file_id: Any,
    object_path: str,
    parsed_rows: list[dict[str, Any]],
) -> list[dict[str, Any]]:
    data_column = choose(columns, ["row_data", "raw_data", "data", "payload"])
    if not data_column:
        raise RuntimeError(
            "staging.source_rows needs one JSON/text payload column named one of: "
            "row_data, raw_data, data, payload"
        )

    file_id_column = choose(columns, ["source_file_id", "file_id", "source_file_uuid"])
    sheet_column = choose(columns, ["sheet_name", "worksheet_name", "sheet"])
    row_number_column = choose(
        columns, ["row_number", "excel_row_number", "source_row_number", "row_index"]
    )
    hash_column = choose(columns, ["row_hash", "source_row_hash", "record_hash", "hash"])
    path_column = choose(columns, ["object_path", "storage_path", "path"])
    filename_column = choose(columns, ["file_name", "filename", "source_filename"])

    if file_id_column and source_file_id is None:
        raise RuntimeError(f"{file_id_column} is required but no source file id is available.")

    file_name = object_path.rsplit("/", 1)[-1]
    rows: list[dict[str, Any]] = []
    for parsed_row in parsed_rows:
        row: dict[str, Any] = {data_column: parsed_row["row_data"]}
        if file_id_column:
            row[file_id_column] = source_file_id
        if sheet_column:
            row[sheet_column] = parsed_row["sheet_name"]
        if row_number_column:
            row[row_number_column] = parsed_row["row_number"]
        if hash_column:
            row[hash_column] = parsed_row["row_hash"]
        if path_column:
            row[path_column] = object_path
        if filename_column:
            row[filename_column] = file_name
        rows.append(row)
    return rows


def start_pipeline_run(conn: psycopg.Connection[Any], columns: dict[str, Column]) -> Any:
    run_id_column = choose(columns, ["pipeline_run_id", "run_id", "id"])
    run_id = str(uuid.uuid4()) if run_id_column else None
    values = {
        "pipeline_run_id": run_id,
        "run_id": run_id,
        "id": run_id,
        "pipeline_name": "source_file_import",
        "name": "source_file_import",
        "job_name": "source_file_import",
        "status": "running",
        "run_status": "running",
        "started_at": datetime.now(timezone.utc),
        "message": "Source file import started",
    }
    for id_name in ["pipeline_run_id", "run_id", "id"]:
        if id_name in columns:
            column = columns[id_name]
            if column.is_identity or column.column_default:
                values.pop(id_name, None)
    returning = run_id_column if run_id_column in columns else None
    try:
        return insert_one(conn, "quality", "pipeline_runs", columns, values, returning)
    except psycopg.Error as exc:
        print(f"WARN: Could not create pipeline run row: {exc}", file=sys.stderr)
        return None


def finish_pipeline_run(
    conn: psycopg.Connection[Any],
    columns: dict[str, Column],
    run_id: Any,
    status: str,
    message: str,
    metrics: dict[str, Any],
) -> None:
    run_id_column = choose(columns, ["pipeline_run_id", "run_id", "id"])
    if not run_id_column or run_id is None:
        return

    updates: dict[str, Any] = {
        "status": status,
        "run_status": status,
        "finished_at": datetime.now(timezone.utc),
        "ended_at": datetime.now(timezone.utc),
        "message": message,
        "error_message": message if status != "succeeded" else None,
        "details": metrics,
        "metadata": metrics,
        "run_metadata": metrics,
        "rows_loaded": metrics.get("rows_loaded"),
    }
    filtered = {
        name: prepare_value(columns[name], value)
        for name, value in updates.items()
        if name in columns and value is not None
    }
    if not filtered:
        return

    query = sql.SQL("update quality.pipeline_runs set {} where {} = %s").format(
        sql.SQL(", ").join(
            sql.SQL("{} = %s").format(sql.Identifier(name)) for name in filtered
        ),
        sql.Identifier(run_id_column),
    )
    conn.execute(query, list(filtered.values()) + [run_id])


def main() -> int:
    base_url = require_env("SUPABASE_URL")
    key = require_env("SUPABASE_SECRET_KEY")
    bucket = os.getenv("SOURCE_BUCKET", "ap-source-files")
    batch_size = int(os.getenv("IMPORT_BATCH_SIZE", "1000"))

    with psycopg.connect() as conn:
        conn.autocommit = True
        source_files_columns = table_columns(conn, "staging", "source_files")
        source_rows_columns = table_columns(conn, "staging", "source_rows")
        pipeline_columns = table_columns(conn, "quality", "pipeline_runs")

        file_id_column = choose(source_files_columns, ["source_file_id", "id", "file_id"])
        run_id = start_pipeline_run(conn, pipeline_columns)
        metrics = {
            "files_seen": 0,
            "files_loaded": 0,
            "files_skipped": 0,
            "rows_loaded": 0,
        }

        try:
            for object_path in source_file_list():
                metrics["files_seen"] += 1
                data = download_storage_object(base_url, key, bucket, object_path)
                if data[:4] != b"PK\x03\x04":
                    raise RuntimeError(f"Unexpected file format: {object_path}")

                sha256 = file_sha256(data)
                existing_id = existing_source_file_id(
                    conn, source_files_columns, bucket, object_path, sha256, file_id_column
                )
                if existing_id is not None:
                    metrics["files_skipped"] += 1
                    print(f"SKIP: {object_path} already loaded")
                    continue

                parsed_rows = parse_workbook(data, object_path)
                source_file_id = str(uuid.uuid4()) if file_id_column else None
                sheets_loaded = len({row["sheet_name"] for row in parsed_rows})

                with conn.transaction():
                    returned_id = insert_one(
                        conn,
                        "staging",
                        "source_files",
                        source_files_columns,
                        source_file_values(
                            source_files_columns,
                            source_file_id,
                            bucket,
                            object_path,
                            data,
                            sha256,
                            len(parsed_rows),
                            sheets_loaded,
                        ),
                        file_id_column,
                    )
                    if returned_id is not None:
                        source_file_id = returned_id

                    rows_to_insert = source_row_insert_rows(
                        source_rows_columns, source_file_id, object_path, parsed_rows
                    )
                    insert_many(
                        conn,
                        "staging",
                        "source_rows",
                        source_rows_columns,
                        rows_to_insert,
                        batch_size,
                    )

                metrics["files_loaded"] += 1
                metrics["rows_loaded"] += len(parsed_rows)
                print(f"LOAD: {object_path} rows={len(parsed_rows)}")

            try:
                finish_pipeline_run(
                    conn,
                    pipeline_columns,
                    run_id,
                    "succeeded",
                    "Source file import completed",
                    metrics,
                )
            except Exception as update_exc:
                print(f"WARN: Could not update pipeline run: {update_exc}", file=sys.stderr)
            print(json.dumps(metrics, sort_keys=True))
            return 0
        except Exception as exc:
            metrics["error"] = str(exc)
            try:
                finish_pipeline_run(
                    conn,
                    pipeline_columns,
                    run_id,
                    "failed",
                    str(exc),
                    metrics,
                )
            except Exception as update_exc:
                print(f"WARN: Could not update failed pipeline run: {update_exc}", file=sys.stderr)
            raise


if __name__ == "__main__":
    try:
        raise SystemExit(main())
    except Exception as exc:
        print(f"FAIL: {exc}", file=sys.stderr)
        raise SystemExit(1)
