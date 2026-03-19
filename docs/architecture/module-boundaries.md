# Module Boundaries

## Design Rule

The project uses a thin-shell architecture:

- the plugin is a shell around an external CLI
- the CLI is a shell around `@osp/core`
- `@osp/core` is the shell around the pipeline packages

## Package Responsibilities

### `packages/shared`

- shared types
- zod schemas
- config/result contracts
- protocol objects used across layers

### `packages/parser`

- scan files from the vault
- parse frontmatter and note metadata
- extract links, embeds, headings, block ids, and asset references

### `packages/diagnostics`

- analyze the manifest
- produce structured `BuildIssue[]`
- never mutate vault data

### `packages/staging`

- prepare a temporary workspace for build/preview
- copy only the selected public slice and required assets
- apply normalization needed for stable publishing

### `packages/builder-adapter-quartz`

- adapt the staged workspace to Quartz
- collect build/preview logs
- convert Quartz failures into structured output

### `packages/deploy-adapters`

- publish a successful build to a concrete target
- keep deploy-target specifics out of `@osp/core`

### `packages/core`

- own orchestration
- own stop/go decisions based on issues and config
- expose the stable runtime API consumed by CLI

### `apps/publisher-cli`

- present user-facing CLI commands
- write logs
- manage preview process lifecycle
- return machine-readable JSON for plugin integration

### `apps/obsidian-plugin`

- provide settings UI
- register commands
- show notices and lightweight views
- call the external CLI

## Boundary Rules

The following are intentional restrictions:

- UI code must not parse vault content directly
- UI code must not own build or deploy policy
- parser/diagnostics/staging logic must not move into the plugin
- every persisted config or external input must have schema validation
- unsupported official features must be surfaced explicitly

## Why This Matters

These boundaries keep the repository aligned with the vibe-coding rules:

- smaller changesets
- easier regression tests
- lower UI complexity
- clearer failure ownership
- better portability between CLI and plugin flows
