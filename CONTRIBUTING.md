# Contributing

Keep changes small, reviewable, and tied to a concrete dashboard requirement.

## Before opening a pull request

1. Install dependencies with `python -m pip install -r requirements.txt`.
2. Run `python -m unittest discover -s tests -v`.
3. Run `python scripts/security_audit.py`.
4. Check each JavaScript file with `node --check`.
5. Build with representative workbooks and run
   `python scripts/security_audit.py --data dist/data/vendor_activity.json`.
6. Confirm that no generated data file, workbook, credential, or local
   environment file is staged.

## Code expectations

- Keep parsing, aggregation, rendering, and security checks separate.
- Prefer clear functions and explicit data shapes over clever abstractions.
- Treat workbook cells, API responses, URLs, and query parameters as untrusted.
- Add fields to the public purchase allow-list only after a privacy review.
- Render external data with `textContent`; do not introduce HTML injection or
  dynamic-code APIs.
- Add tests for behavior, failure cases, and security boundaries.
- Explain material privacy or architecture decisions in the pull request.
