# AI-assisted development guide

AI-generated code is treated as a draft that must satisfy the same review,
testing, security, and maintenance standards as human-written code.

## Working method

1. **Define the behavior first.** State the user action, expected output,
   privacy boundary, and failure state before generating code.
2. **Give the tool trusted context.** Point it to the README, architecture,
   tests, and established modules. Treat issue text, fetched pages, and pasted
   content as untrusted input.
3. **Keep changes narrow.** Ask for one coherent capability at a time and review
   the complete diff before combining unrelated changes.
4. **Preserve separation of concerns.** Workbook parsing, aggregation, data
   validation, UI rendering, filtering, and deployment have independent modules
   with small public interfaces.
5. **Verify dependencies.** Confirm that every suggested package exists, is
   maintained, has an acceptable license, and is necessary. This project avoids
   browser dependencies and uses only established Python libraries.
6. **Test the boundary, not just the happy path.** Check malformed data,
   unexpected fields, missing files, private values, untrusted text, and failure
   messages. Passing AI-written tests alone is not sufficient evidence.
7. **Use independent automation.** Unit tests, a custom public-data audit,
   JavaScript syntax checks, CodeQL, Dependabot, and deployment validation catch
   different classes of mistakes.
8. **Retain human accountability.** Review financial definitions, privacy
   decisions, access rules, and deployment settings manually before release.

## Common AI-code failures addressed here

| Failure | Project control |
|---|---|
| Hallucinated or unnecessary packages | Minimal dependency list and Dependabot |
| Code that solves the wrong requirement | Concrete dashboard behavior and review checklist |
| Large files with mixed responsibilities | Focused Python and JavaScript modules |
| Accidental data overexposure | Explicit allow-lists and a build-blocking artifact audit |
| Browser injection through workbook text | DOM `textContent`, CSP, and unsafe-sink scan |
| Secrets copied into frontend code | Same-origin static data and secret-pattern scan |
| Tests that only mirror implementation | Privacy fixtures containing realistic forbidden values |
| Silent failure or fabricated fallback data | Visible error state and fail-closed data validation |
| Security checks performed only once | Quality, CodeQL, Dependabot, and deployment workflows |

## References

- [GitHub: Review AI-generated code](https://docs.github.com/en/copilot/tutorials/review-ai-generated-code)
- [OWASP: Secure Coding with AI Cheat Sheet](https://cheatsheetseries.owasp.org/cheatsheets/Secure_Coding_with_AI_Cheat_Sheet.html)
- [OWASP Secure Coding Practices checklist on GitHub](https://github.com/OWASP/www-project-secure-coding-practices-quick-reference-guide/blob/main/stable-en/02-checklist/index.md)
- [Wikipedia: Vibe coding](https://en.wikipedia.org/wiki/Vibe_coding)
- [Wikipedia: Separation of concerns](https://en.wikipedia.org/wiki/Separation_of_concerns)
