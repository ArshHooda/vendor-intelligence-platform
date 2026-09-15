<div align="center">

# Vendor Intelligence Platform

**Accounts payable analytics for exploring vendor spend, purchasing activity, and operational risk.**

[![Open Live Demo](https://img.shields.io/badge/Open_Live_Demo-dfff7e?style=for-the-badge&logo=githubpages&logoColor=15282a&labelColor=15282a)](https://arshhooda.github.io/vendor-intelligence-platform/)

[![Deploy dashboard](https://github.com/ArshHooda/vendor-intelligence-platform/actions/workflows/deploy-dashboard-pages.yml/badge.svg?branch=main)](https://github.com/ArshHooda/vendor-intelligence-platform/actions/workflows/deploy-dashboard-pages.yml)
[![Supabase health check](https://github.com/ArshHooda/vendor-intelligence-platform/actions/workflows/keep-supabase-active.yml/badge.svg?branch=main)](https://github.com/ArshHooda/vendor-intelligence-platform/actions/workflows/keep-supabase-active.yml)
[![GitHub Pages](https://img.shields.io/badge/Hosted_on-GitHub_Pages-222222?style=flat-square&logo=githubpages)](https://pages.github.com/)
[![Python 3.12](https://img.shields.io/badge/Python-3.12-3776AB?style=flat-square&logo=python&logoColor=white)](https://www.python.org/)

### [→ Launch the interactive dashboard](https://arshhooda.github.io/vendor-intelligence-platform/)

</div>

## Overview

Vendor Intelligence turns private vendor-master and accounts-payable workbooks
into an interactive, browser-based analysis surface. Finance teams can identify
their largest suppliers, examine open exposure and payment holds, understand
purchasing cadence, and filter the entire portfolio without publishing raw
invoice records.

| Latest validated snapshot | Value |
|---|---:|
| Vendor master records | 1,823 |
| Unique vendors | 1,820 |
| Vendors with purchases | 874 |
| Matched bills | 13,360 |
| Total spend | $283.56M |
| Payment holds | 23 |

## Dashboard capabilities

| Area | What it provides |
|---|---|
| Executive KPIs | Total spend, bill count, average and largest bill, open spend, purchasing frequency, median purchase gap, payment holds, and vendors without purchases |
| Biggest spenders | Switch between the top 3, 5, 10, or 20 vendors with proportional spend bars |
| Portfolio signals | Largest-vendor share, top-three concentration, dormant vendors, and flagged records |
| Vendor filters | Vendor name, payment status, last purchase, purchase frequency, average gap, country, vendor status, approval status, and risk type |
| Vendor directory | Sortable columns, 25/50/100-row pagination, payment-state labels, purchase dates, frequency, average gap, average bill, and total spend |
| Responsive layout | Desktop, tablet, and mobile support with contained horizontal table scrolling |

## How it works

```mermaid
flowchart LR
    A[Private Excel files] -->|GitHub Actions| B[Aggregate builder]
    B --> C[Vendor-level JSON]
    C --> D[Static dashboard]
    D --> E[GitHub Pages]
    F[Supabase summary views] -. Browser-safe fallback .-> D

    style A fill:#15282a,color:#ffffff,stroke:#15282a
    style B fill:#dfff7e,color:#15282a,stroke:#15282a
    style C fill:#f3f6ef,color:#15282a,stroke:#769b78
    style D fill:#dfff7e,color:#15282a,stroke:#15282a
    style E fill:#15282a,color:#ffffff,stroke:#15282a
```

The deployment workflow downloads `Bills972.xlsx` and
`4DMTVendorListingResults775.xlsx` from the private Supabase Storage bucket. It
creates a vendor-level aggregate snapshot inside the GitHub Actions runner and
publishes only the static dashboard artifact.

## Data privacy

- Source workbooks remain in the private `ap-source-files` Supabase bucket.
- Raw invoice rows, document numbers, memos, bank fields, and vendor email
  addresses are excluded from the published dashboard dataset.
- `dist/data/` is ignored by Git and generated only for previews and deployments.
- Supabase secret and database credentials are stored as GitHub Actions secrets.
- The browser contains only the Supabase publishable key for the browser-safe
  summary fallback.

## Run locally

### 1. Install the Python dependencies

```powershell
python -m pip install -r requirements.txt
```

### 2. Build the vendor activity snapshot

```powershell
python scripts/build_dashboard_data.py `
  --bills-file "C:\path\to\Bills972.xlsx" `
  --vendors-file "C:\path\to\4DMTVendorListingResults775.xlsx"
```

### 3. Start a local web server

```powershell
python -m http.server 5173 --directory dist
```

Open **http://localhost:5173**.

## Deploy for free

The app is a static site and is hosted with GitHub Pages. Pushes affecting the
dashboard or aggregate builder automatically trigger
`.github/workflows/deploy-dashboard-pages.yml`.

Required repository secrets:

| Secret | Purpose |
|---|---|
| `SUPABASE_URL` | Supabase project URL |
| `SUPABASE_SECRET_KEY` | Reads the two private source workbooks during the build |

To deploy manually:

1. Open **Actions** in this repository.
2. Select **Deploy dashboard to GitHub Pages**.
3. Choose **Run workflow** on the `main` branch.
4. Wait for the `build` and `deploy` jobs to complete.
5. Open the [live dashboard](https://arshhooda.github.io/vendor-intelligence-platform/).

## Supabase activity check

The **Keep Supabase active** workflow runs automatically every day at 06:17
UTC. It makes three small, read-only database queries and can also be run
manually from the repository's **Actions** page. It uses the existing
`SUPABASE_DB_HOST`, `SUPABASE_DB_USER`, and `SUPABASE_DB_PASSWORD` repository
secrets.

GitHub may disable scheduled workflows in a public repository after 60 days
without repository activity. If that happens, open **Actions → Keep Supabase
active** and enable the workflow again.

## Import pipeline

The separate **Import source files** workflow validates the PostgreSQL schema
and loads the source workbooks into:

- `staging.source_files`
- `staging.source_rows`
- `quality.pipeline_runs`

Before writing, the importer verifies columns, defaults, primary and foreign
keys, unique and check constraints, RLS policies, grants, unique indexes, and
user triggers. The importer also supports `--schema-only` and
`--preflight-only` diagnostics.

Keep the underlying `staging`, `core`, `quality`, and `analytics` schemas out of
the Supabase Data API exposed schemas. The dashboard fallback queries only the
narrow, browser-safe views defined in `sql/analytics/001_public_dashboard_views.sql`.

## Project structure

```text
dist/                              Static dashboard
scripts/build_dashboard_data.py    Vendor aggregate builder
scripts/import_source_files.py     Validated workbook importer
sql/staging/                       Staging tables and importer access
sql/analytics/                     Browser-safe dashboard views
.github/workflows/                 Import, validation, and deployment automation
tests/                             Importer validation tests
```

<div align="center">

**[Open the demo](https://arshhooda.github.io/vendor-intelligence-platform/)** ·
**[View deployments](https://github.com/ArshHooda/vendor-intelligence-platform/actions/workflows/deploy-dashboard-pages.yml)**

</div>
