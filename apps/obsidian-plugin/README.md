# `apps/obsidian-plugin`

## Responsible For

- Obsidian-facing commands, views, and settings wiring
- translating user actions into calls to `@osp/core`
- presenting build issues, progress, and logs inside Obsidian
- retaining the latest build / preview / publish state for UI surfaces

## Not Responsible For

- parsing vault content
- diagnostics logic
- staging or filesystem build orchestration
- Quartz integration details

## Public Surface

- `PublisherPluginShell`
- `pluginManifest`

## Current Behavior

- exposes four command definitions: preview, build, publish, issues
- creates a default config from the active vault root
- executes commands through `@osp/core`
- keeps the latest issues, logs, build result, preview session, and deploy result in plugin state

## Depends On

- `@osp/core`
- `@osp/shared`
