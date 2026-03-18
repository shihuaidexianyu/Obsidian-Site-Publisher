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

- default `ObsidianSitePublisherPlugin`
- `PublisherPluginShell`
- `PluginCommandController`
- `pluginManifest`

## Current Behavior

- provides a real Obsidian `Plugin` entry backed by the official `obsidian` API
- loads and saves plugin settings through Obsidian `loadData()` / `saveData()`
- registers four commands: preview, build, publish, issues
- creates a status bar item and updates it with the latest command result
- exposes a settings tab for publish mode, publish root, output dir, deploy target selection, deploy repository settings, and Quartz feature toggles
- opens a dedicated issues view for scan/build results
- opens a dedicated build logs view for build/publish results
- executes commands through `@osp/core`
- keeps the latest issues, logs, build result, preview session, and deploy result in plugin state

## Depends On

- `@osp/core`
- `@osp/shared`
- `obsidian` types
