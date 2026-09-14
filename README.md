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

## Vendor intelligence dashboard

The dependency-free dashboard in `dist/` reads four browser-safe views from the
Supabase REST API:

- `public.dashboard_summary`
- `public.top_vendor_concentration`
- `public.vendor_risk_summary`
- `public.payment_hold_summary`

It shows the latest spend KPIs, vendor concentration, payment holds, and the
vendor risk queue. Vendor, country, vendor status, approval status, and risk-type
dropdowns recalculate the KPIs and tables immediately. If the live API is
unavailable, it clearly labels and displays the last verified snapshot instead
of leaving the page empty.

To preview it locally, serve the `dist` directory with any static HTTP server.
For example:

```powershell
python -m http.server 5173 --directory dist
```

Then open `http://localhost:5173`. The public Supabase publishable key is used in
the browser; secret and service-role keys must never be added to dashboard code.

The SQL needed to reproduce the browser-safe views and grants is in
`sql/analytics/001_public_dashboard_views.sql`. Keep the underlying `staging`,
`core`, `quality`, and `analytics` schemas out of Supabase Data API exposed
schemas; only the four narrow `public` views are queried by the dashboard.
