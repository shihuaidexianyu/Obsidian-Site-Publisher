# `apps/obsidian-plugin`

## Responsible For

- Obsidian-facing commands, views, and settings wiring
- translating user actions into calls to the bundled publisher CLI
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
- executes commands through a bundled CLI subprocess so Quartz/build work stays outside the Obsidian renderer
- keeps plugin-specific code focused on settings, views, and subprocess bridging rather than core pipeline logic
- keeps the latest issues, logs, build result, preview session, and deploy result in plugin state

## Packaging

- run `corepack pnpm build:obsidian-plugin` from the workspace root
- the installable plugin bundle is written to `.obsidian-plugin-build/obsidian-site-publisher`
- copy `main.js`, `cli.js`, `manifest.json`, `versions.json`, and the `runtime/` directory from that folder into:
  `YourVault/.obsidian/plugins/obsidian-site-publisher/`
- the bundled `cli.js` is the subprocess entrypoint used by the plugin commands
- the bundled `runtime/` directory contains the Quartz runtime used by `build`, `preview`, and `publish`

## Depends On

- `@osp/shared`
- `obsidian` types
