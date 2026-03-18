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

Real pipeline status today:

- scan / diagnose / stage / build / preview are wired through the default runtime
- CLI calls the shared `@osp/core` orchestration path
- the Obsidian plugin now shells out to a bundled CLI subprocess, which keeps Quartz/build work out of the renderer process
- deploy now has a real `local-export` target that copies a successful build into a dedicated output directory
- deploy also supports `git-branch`, which commits the built site into a dedicated branch such as `gh-pages`
- deploy also supports `github-pages`, including external repository URLs such as `username.github.io`

Useful deploy config examples:

```json
{
  "deployTarget": "local-export",
  "deployOutputDir": "./published-site"
}
```

```json
{
  "deployTarget": "git-branch",
  "deployBranch": "gh-pages",
  "deployCommitMessage": "Deploy static site"
}
```

```json
{
  "deployTarget": "github-pages",
  "deployRepositoryUrl": "https://github.com/<user>/<user>.github.io",
  "deployBranch": "main",
  "deployCommitMessage": "Deploy static site"
}
```

## Engineering Guardrails

The main collaboration constraints live in:

- [docs/prompts/engineering-rules.md](/c:/Users/exqin/Desktop/Obsidian%20Site%20Publisher/docs/prompts/engineering-rules.md)
- [docs/prompts/task-template.md](/c:/Users/exqin/Desktop/Obsidian%20Site%20Publisher/docs/prompts/task-template.md)

## Testing Data

- `fixtures/` contains small deterministic regression vaults.
- `test_vault/hw` can be used as a real-world smoke-test vault while developing parser and diagnostics behavior.
