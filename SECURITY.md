# Security policy

## Supported version

Security fixes are applied to the latest commit on `main` and the currently
deployed dashboard.

## Reporting a vulnerability

Do not open a public issue containing credentials, private workbook content, or
proof-of-concept data. Contact the repository owner privately through the
GitHub profile associated with this repository and include:

- the affected page, file, or workflow;
- the minimum steps needed to reproduce the issue;
- the impact and data that may be exposed; and
- a suggested fix, when available.

Revoke and rotate a credential immediately if it may have been disclosed.

## Security boundaries

- Source workbooks remain in a private Supabase Storage bucket.
- Database and Storage secrets are available only to GitHub Actions.
- The deployed browser application contains no Supabase key.
- Published purchase records use a fixed allow-list and per-build pseudonymous
  references. Original document and transaction numbers never enter the public
  artifact.
- Sensitive vendor, banking, approval-chain, memo, account, internal, and
  program fields are excluded during parsing.
- Public dashboard data is still public. Exact purchase dates, status, currency,
  and amounts should be removed or moved behind authenticated access if the
  organization classifies them as confidential.

See [`docs/SECURITY_REVIEW.md`](docs/SECURITY_REVIEW.md) for the complete review.
