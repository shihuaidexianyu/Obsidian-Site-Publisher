# Obsidian Site Publisher

Git-first static publishing orchestration for Obsidian vaults.

This repository is intentionally organized as a small monorepo so we can keep boundaries clear between:

- Obsidian-facing UI
- orchestration and pipeline logic
- diagnostics and staging
- builder and deploy adapters

## Current State

The repository now contains the scaffold described in [todo.md](/c:/Users/exqin/Desktop/Obsidian%20Site%20Publisher/todo.md):

- `apps/obsidian-plugin`: Obsidian integration shell
- `apps/publisher-cli`: local and CI entrypoint shell
- `packages/*`: core domain packages with typed interfaces
- `fixtures/*`: future regression fixtures
- `docs/adr`: architecture decision records
- `docs/prompts`: vibe-coding guardrails and task templates

## Engineering Guardrails

The main collaboration constraints live in:

- [docs/prompts/engineering-rules.md](/c:/Users/exqin/Desktop/Obsidian%20Site%20Publisher/docs/prompts/engineering-rules.md)
- [docs/prompts/task-template.md](/c:/Users/exqin/Desktop/Obsidian%20Site%20Publisher/docs/prompts/task-template.md)

## Testing Data

- `fixtures/` contains small deterministic regression vaults.
- `test_vault/hw` can be used as a real-world smoke-test vault while developing parser and diagnostics behavior.
