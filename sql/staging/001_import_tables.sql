BEGIN;

CREATE SCHEMA IF NOT EXISTS staging;
CREATE SCHEMA IF NOT EXISTS quality;

CREATE TABLE IF NOT EXISTS quality.pipeline_runs (
    run_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    started_at timestamptz NOT NULL DEFAULT now(),
    finished_at timestamptz,
    status text NOT NULL DEFAULT 'running'
        CHECK (status IN ('running', 'succeeded', 'failed')),
    error_message text
);

CREATE TABLE IF NOT EXISTS staging.source_files (
    file_id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
    run_id uuid NOT NULL REFERENCES quality.pipeline_runs(run_id),
    source_type text NOT NULL CHECK (source_type IN ('bills', 'vendors')),
    bucket_name text NOT NULL DEFAULT 'ap-source-files',
    object_path text NOT NULL,
    file_sha256 text NOT NULL CHECK (file_sha256 ~ '^[0-9a-f]{64}$'),
    sheet_name text NOT NULL,
    headers jsonb NOT NULL CHECK (jsonb_typeof(headers) = 'array'),
    row_count integer NOT NULL CHECK (row_count >= 0),
    imported_at timestamptz NOT NULL DEFAULT now(),
    UNIQUE (run_id, source_type, sheet_name)
);

CREATE TABLE IF NOT EXISTS staging.source_rows (
    file_id uuid NOT NULL REFERENCES staging.source_files(file_id),
    excel_row_number integer NOT NULL CHECK (excel_row_number >= 2),
    cell_values jsonb NOT NULL CHECK (jsonb_typeof(cell_values) = 'array'),
    PRIMARY KEY (file_id, excel_row_number)
);

ALTER TABLE quality.pipeline_runs ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.source_files ENABLE ROW LEVEL SECURITY;
ALTER TABLE staging.source_rows ENABLE ROW LEVEL SECURITY;

REVOKE ALL ON TABLE
    quality.pipeline_runs,
    staging.source_files,
    staging.source_rows
FROM PUBLIC, anon, authenticated;

COMMIT;
