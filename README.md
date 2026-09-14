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
