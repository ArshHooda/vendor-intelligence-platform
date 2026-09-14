# vendor-intelligence-platform
Cloud-hosted vendor and accounts payable analytics with data quality checks, spend analysis, and explainable risk detection.

## Current cloud pipeline

The first cloud pipeline step loads the two private Excel source files from Supabase Storage into the raw staging tables:

- `staging.source_files`
- `staging.source_rows`
- `quality.pipeline_runs`

Run it from GitHub Actions with **Import source files**. The default files are:

- `Bills972.xlsx`
- `4DMTVendorListingResults775.xlsx`

The workflow uses repository secrets for the Supabase project URL, Supabase secret key, session pooler host, importer username, and importer password.

Before loading data, the importer validates the live PostgreSQL columns, defaults,
primary and foreign keys, unique and check constraints, RLS policies, grants,
standalone unique indexes, and user triggers. It then validates both workbooks and
loads all sheets in one transaction. Ordered JSON arrays preserve duplicate Excel
headers and their matching cell positions.

The authoritative ingestion table definitions and importer access policy are in
`sql/staging/001_import_tables.sql` and `sql/staging/002_importer_access.sql`.
The importer also supports `--schema-only` and `--preflight-only` diagnostics.
Changes to the importer run the preflight automatically through the
**Validate source importer** GitHub Actions workflow.
