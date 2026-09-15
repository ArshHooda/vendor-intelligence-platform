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

The dependency-free dashboard in `dist/` presents vendor-level aggregates built
from the two private source workbooks. It includes spend and bill KPIs, open
spend, payment holds, purchase frequency, average purchase gaps, recency,
concentration, dormant vendors, a configurable top-spenders ranking, and a
sortable vendor directory.

Vendor, payment status, last purchase, frequency, average gap, country, vendor
status, approval status, and risk dropdowns recalculate the complete dashboard.
Raw invoice rows and source workbooks are never added to the public site.

Build the aggregate snapshot locally:

```powershell
python scripts/build_dashboard_data.py `
  --bills-file "C:\path\to\Bills972.xlsx" `
  --vendors-file "C:\path\to\4DMTVendorListingResults775.xlsx"
```

Then serve the `dist` directory with any static HTTP server:

```powershell
python -m http.server 5173 --directory dist
```

Then open `http://localhost:5173`. The public Supabase publishable key is used in
the browser only as a summary fallback; secret and service-role keys must never
be added to dashboard code.

### Free GitHub Pages deployment

The **Deploy dashboard to GitHub Pages** workflow downloads both workbooks from
the private `ap-source-files` Supabase Storage bucket, builds the aggregate JSON
inside the GitHub Actions runner, and publishes `dist/`. It uses the existing
`SUPABASE_URL` and `SUPABASE_SECRET_KEY` repository secrets. The generated JSON
is an artifact and remains ignored by Git.

In GitHub, open **Settings → Pages**, set **Source** to **GitHub Actions**, then
run **Deploy dashboard to GitHub Pages** from the Actions tab. The site URL is:

`https://arshhooda.github.io/vendor-intelligence-platform/`

The SQL needed to reproduce the browser-safe views and grants is in
`sql/analytics/001_public_dashboard_views.sql`. Keep the underlying `staging`,
`core`, `quality`, and `analytics` schemas out of Supabase Data API exposed
schemas; only the four narrow `public` views are queried by the dashboard.
