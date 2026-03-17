# Task Template

Use this template for bounded implementation tasks:

```text
Task goal:
Implement diagnostics for unpublished references.

Boundary:
- Only edit packages/diagnostics and its tests
- Do not modify UI or builder packages
- Input is VaultManifest
- Output is BuildIssue[]

Acceptance criteria:
- A published note linking to an unpublished note creates a warning
- Missing targets remain the responsibility of BROKEN_LINK
- Add or update a fixture for the scenario
- Tests pass
```
