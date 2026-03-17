# `apps/obsidian-plugin`

## Responsible For

- Obsidian-facing commands, views, and settings wiring
- translating user actions into calls to `@osp/core`
- presenting build issues, progress, and logs inside Obsidian

## Not Responsible For

- parsing vault content
- diagnostics logic
- staging or filesystem build orchestration
- Quartz integration details

## Public Surface

- `PublisherPluginShell`
- `pluginManifest`

## Depends On

- `@osp/core`
- `@osp/shared`
