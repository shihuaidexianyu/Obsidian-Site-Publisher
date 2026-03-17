# Engineering Rules

These rules are designed to keep vibe coding productive without letting the repository drift.

## Core Constraints

1. Read the package README before editing code in that package.
2. Respect interface boundaries before adding implementation.
3. Keep changes inside one module or one pipeline slice whenever possible.
4. Every new external input must have a schema.
5. Every new error path must use a structured error code or issue code.
6. Do not move business logic into UI code.
7. Do not introduce bare `any`.
8. Keep files under 300 logical lines whenever possible.
9. If a real bug is found, add or update a fixture in `fixtures/`.
10. Unsupported official features must be reported explicitly, never swallowed.

## Allowed Edit Shapes

- A focused implementation inside one package
- Tests plus implementation for one diagnosis rule
- Adapter wiring inside a single adapter package
- UI wiring that only consumes `@osp/core`

## Disallowed Edit Shapes

- A single task that rewrites parser, diagnostics, and UI together
- Changing public interfaces without updating docs and dependents
- Adding hidden side effects to shared utilities
- Mixing refactors with new features across multiple layers

## Required Checks

- TypeScript stays in strict mode.
- New config values include defaults and schema coverage.
- New persisted outputs include schema coverage.
- Changes that touch behavior should include fixture or unit coverage.

## Notes For AI Contributors

- Prefer pure functions in domain packages.
- Keep adapters boring and explicit.
- If a feature is intentionally unsupported, document that choice where the behavior lives.
