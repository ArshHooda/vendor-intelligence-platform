# Security review

## Scope

This review covers the static dashboard, the workbook-to-JSON build, GitHub
Actions, Supabase access boundaries, and the generated public artifact.

## Threat model

The public dashboard and everything downloaded by its browser are assumed to be
readable and modifiable by an anonymous visitor. Workbook cells are treated as
untrusted input. GitHub Actions secrets and the private Storage bucket are
trusted server-side resources. A publishable identifier is not treated as a
secret.

## Controls

| Risk | Control |
|---|---|
| Raw document or transaction identifiers | Replaced with per-build HMAC pseudonyms |
| Private workbook columns | Excluded during parsing and blocked by an exact output allow-list |
| Script injection from workbook text | Rendering uses `textContent`; dangerous DOM sinks are rejected by audit |
| Secret leakage | Secret-pattern scan, ignored generated data, and GitHub Actions secrets |
| Unexpected network access | CSP permits connections only to the same origin |
| Direct browser database access | Removed; browser roles are revoked from legacy dashboard views |
| Vulnerable code patterns | Unit tests, CodeQL `security-extended`, and manual review |
| Dependency drift | Dependabot for Python and GitHub Actions |
| Unsafe release | Build, public-data audit, and deploy are one workflow |

## Verification performed

- Generated the artifact from both full source workbooks.
- Confirmed 1,820 vendor records and 13,360 allow-listed purchase records.
- Confirmed purchase objects contain only the approved nine fields.
- Confirmed original document IDs, transaction IDs, emails, addresses, bank
  fields, accounts, memos, approvers, internal IDs, programs, and comments are
  never selected by the generator.
- Tested salted pseudonym behavior and representative sensitive-value exclusion.
- Scanned browser code for HTML-injection and dynamic-code sinks.
- Added JavaScript syntax checks, Python compilation, CodeQL, and dependency monitoring.

## Residual risks

- GitHub Pages is public. The approved purchase date, amount, currency, status,
  and hold state can be downloaded directly from the generated JSON. If these
  fields are confidential, use Supabase Auth with server-side authorization and
  RLS instead of a public static artifact.
- CSP delivered through an HTML meta element cannot enforce every directive that
  an HTTP response header can enforce. GitHub Pages does not provide custom
  response-header configuration for this repository.
- Automated scanning cannot prove the absence of every vulnerability. Review
  authorization, financial meaning, and newly published fields manually.
- The one-time SQL migration
  `sql/analytics/002_restrict_existing_public_views.sql` must be applied to the
  existing Supabase project to remove the prior anonymous view grants.
