# `@osp/core`

## Responsible For

- orchestrating parser, diagnostics, staging, builder, and deploy adapters
- preserving pipeline boundaries
- exposing a stable application service for plugin and CLI entrypoints

## Not Responsible For

- Obsidian UI
- direct Quartz implementation
- direct Git implementation

## Public Surface

- `PublisherOrchestrator`
- `PublisherDependencies`
- `ScanReport`

## Depends On

- `@osp/shared`
- `@osp/parser`
- `@osp/diagnostics`
- `@osp/staging`
- `@osp/builder-adapter-quartz`
- `@osp/deploy-adapters`
