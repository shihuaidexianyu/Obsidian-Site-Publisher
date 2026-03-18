# `apps/obsidian-plugin`

## Responsible For

- Obsidian-facing commands, views, and settings wiring
- translating user actions into calls to an external `publisher-cli`
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
- exposes a settings tab for publish mode, publish root, output dir, deploy target selection, external CLI path, CLI log directory, preview port, deploy repository settings, and Quartz feature toggles
- opens a dedicated issues view for scan/build results
- opens a dedicated build logs view for build/publish results
- executes commands through an external CLI subprocess so Quartz/build work stays outside the Obsidian renderer
- keeps plugin-specific code focused on settings, views, and subprocess bridging rather than core pipeline logic
- keeps the latest issues, logs, build result, preview session, and deploy result in plugin state

## Packaging

- run `corepack pnpm build:obsidian-plugin` from the workspace root
- the installable plugin bundle is written to `.obsidian-plugin-build/obsidian-site-publisher`
- copy `main.js`, `manifest.json`, and `versions.json` from that folder into:
  `YourVault/.obsidian/plugins/obsidian-site-publisher/`
- the plugin no longer bundles `cli.js` or `runtime/`
- you must separately install or build `publisher-cli`, then either:
  - expose `publisher-cli` on your system `PATH`
  - or point the plugin setting `CLI 可执行文件路径` at the executable/script

## External CLI

- `publisher-cli` is now a standalone program with its own logs and error output
- the plugin treats it as an external dependency and only sends commands/config to it
- when `CLI 日志目录` is empty, the CLI defaults to `<vault>/.osp/logs`
- when `预览端口` is empty, the CLI uses its default preview port
- if you are using this repository directly, run `corepack pnpm build` first and then point the plugin at `apps/publisher-cli/dist/main.js`
- on Windows, a common setup is either:
  - `publisher-cli.cmd` available on `PATH`
  - or a direct path such as `C:\\path\\to\\publisher-cli.cmd`
  - or the built workspace entry `C:\\path\\to\\apps\\publisher-cli\\dist\\main.js`

## Depends On

- `@osp/shared`
- `obsidian` types
