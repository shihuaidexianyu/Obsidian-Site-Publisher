# Obsidian Site Publisher

[English](README.md) | [简体中文](README.zh-CN.md)

Publish a selected subset of an Obsidian vault as a static site.

Obsidian Site Publisher is built around three layers:

- an Obsidian plugin for settings and commands
- a standalone `publisher-cli` for scan/build/preview/deploy
- a Quartz-based build pipeline behind `@osp/core`

## Features

- Scan real Obsidian vaults and build a normalized manifest
- Diagnose common publishing problems before build
- Select a public slice with `frontmatter`, `folder`, `publishRoot`, `includeGlobs`, and `excludeGlobs`
- Stage only the required notes and assets for Quartz
- Build and preview static sites with Quartz
- Deploy to local export, Git branch, or GitHub Pages
- Trigger the workflow from Obsidian without running the build inside the renderer process

## Status

This repository is usable for a first public preview of the workflow.

Supported in v1:

- Markdown notes
- frontmatter / Properties
- Obsidian wikilinks, markdown links, embeds, headings, and block references
- official attachment folder behavior
- official `.canvas` / `.base` detection and reporting

Out of scope in v1:

- Dataview
- Templater
- Excalidraw
- community plugin syntax compatibility
- web-to-vault round-trip editing

## Architecture

The project keeps a strict orchestration boundary:

1. `@osp/parser` scans vault content into a manifest
2. `@osp/diagnostics` produces structured issues
3. `@osp/staging` prepares a Quartz-ready workspace
4. `@osp/builder-adapter-quartz` builds or previews the site
5. `@osp/deploy-adapters` publishes a successful build
6. `@osp/core` orchestrates the full pipeline
7. `apps/publisher-cli` exposes the pipeline as a standalone program
8. `apps/obsidian-plugin` remains a thin UI shell around the external CLI

More details:

- [Architecture Index](docs/architecture/README.md)
- [System Overview](docs/architecture/system-overview.md)
- [Module Boundaries](docs/architecture/module-boundaries.md)
- [ADR](docs/adr)

## Requirements

### End users

Using a release package:

- Obsidian desktop
- a local vault on the desktop filesystem
- Git, only if you want Git-based deploy targets

End users do not need to install Node.js when using the packaged release.

### Developers

Building from source:

- Node.js 20+
- `corepack`
- `pnpm`
- Git

## Installation

There are two supported ways to install the project.

### Option A: Install from a release package

Recommended for normal users.

The release workflow produces a platform-specific plugin package that includes:

- the Obsidian plugin files
- a packaged native CLI
- the runtime files required by the CLI

Expected layout after extracting the archive:

```text
obsidian-site-publisher/
  main.js
  manifest.json
  versions.json
  bin/
    publisher-cli(.exe)
    runtime/
```

Installation steps:

1. Download the package for your platform from Releases.
2. Extract it.
3. Copy the whole `obsidian-site-publisher/` directory into:

```text
<Vault>/.obsidian/plugins/
```

4. Open Obsidian and enable the plugin.

By default, the plugin will look for the bundled CLI in `bin/`, so no extra CLI path configuration is usually required.

### Option B: Build from source

Recommended for development and debugging.

1. Install dependencies:

```bash
corepack pnpm install
```

2. Build the workspace:

```bash
corepack pnpm build
```

3. Build the Obsidian plugin bundle:

```bash
corepack pnpm build:obsidian-plugin
```

4. Copy the generated files from:

```text
.obsidian-plugin-build/obsidian-site-publisher/
```

into:

```text
<Vault>/.obsidian/plugins/obsidian-site-publisher/
```

5. In the plugin settings, set `CLI executable path` to:

```text
<repo>/apps/publisher-cli/dist/main.js
```

## Usage

### From the Obsidian plugin

Available commands:

- `Site Publisher: Check Issues`
- `Site Publisher: Build Site`
- `Site Publisher: Start Preview`
- `Site Publisher: Publish Site`

Typical workflow:

1. Choose a publish mode
2. Narrow the public slice with `publishRoot`, `includeGlobs`, and `excludeGlobs`
3. Run `Check Issues`
4. Run `Build Site` or `Start Preview`
5. Run `Publish Site`

### From the CLI

Common commands:

```bash
publisher-cli scan --vault-root /path/to/vault
publisher-cli build --vault-root /path/to/vault
publisher-cli preview --vault-root /path/to/vault
publisher-cli deploy --vault-root /path/to/vault
```

You can also pass a config file:

```bash
publisher-cli build --config ./publisher.config.json
```

Useful flags:

- `--json`
- `--log-dir`
- `--preview-port`
- `--quartz-package-root`

## Configuration

Main config fields:

- `publishMode`
- `publishRoot`
- `includeGlobs`
- `excludeGlobs`
- `outputDir`
- `deployTarget`
- `deployOutputDir`
- `deployRepositoryUrl`
- `deployBranch`
- `deployCommitMessage`
- `strictMode`

Example:

```json
{
  "vaultRoot": "./my-vault",
  "publishMode": "folder",
  "publishRoot": "Public",
  "includeGlobs": ["Notes/**"],
  "excludeGlobs": ["Diary/**", "**/.obsidian/**", "**/.osp/**"],
  "outputDir": "./my-vault/.osp/dist",
  "builder": "quartz",
  "deployTarget": "github-pages",
  "deployRepositoryUrl": "https://github.com/example/example.github.io",
  "deployBranch": "main",
  "deployCommitMessage": "Deploy static site",
  "enableSearch": true,
  "enableBacklinks": true,
  "enableGraph": true,
  "strictMode": false
}
```

## Logging and Output

Default vault-local locations:

- workspace and preview files: `<vault>/.osp/`
- CLI logs: `<vault>/.osp/logs/`
- build output: `<vault>/.osp/build/dist/`

The plugin shows only lightweight summaries. Full logs are written to the CLI log files.

## Releasing

### Build release artifacts locally

Use the following command to generate the platform-specific release package on your current machine:

```bash
corepack pnpm build:release
```

The generated files are written to:

```text
.release/v<version>/artifacts/
```

### Publish a GitHub Release from the cloud

This repository includes a GitHub Actions workflow at [`.github/workflows/build-release.yml`](.github/workflows/build-release.yml).

You can trigger it in two ways:

1. Push a version tag:

```bash
git tag v0.1.0
git push origin v0.1.0
```

2. Run the workflow manually from GitHub Actions and fill in `release_tag`, for example `v0.1.0`.

When triggered with a `v*` tag or a manual `release_tag`, the workflow will:

- build release artifacts on Windows, macOS, and Linux
- create a GitHub Release
- upload the generated `.zip` files to the Release assets

## Development

Useful commands:

```bash
corepack pnpm lint
corepack pnpm test
corepack pnpm build
corepack pnpm check
corepack pnpm build:obsidian-plugin
corepack pnpm build:release
```

Fixtures and smoke inputs:

- deterministic fixtures: [`fixtures/`](fixtures/)
- real-world smoke vault: `test_vault/hw`

## Repository Layout

```text
apps/
  obsidian-plugin/
  publisher-cli/
packages/
  builder-adapter-quartz/
  core/
  deploy-adapters/
  diagnostics/
  parser/
  shared/
  staging/
docs/
  adr/
  architecture/
  prompts/
fixtures/
test_vault/
```

## Documentation

- [简体中文 README](README.zh-CN.md)
- [Plugin README](apps/obsidian-plugin/README.md)
- [Architecture Index](docs/architecture/README.md)
- [Engineering Rules](docs/prompts/engineering-rules.md)
- [Task Template](docs/prompts/task-template.md)
- [Roadmap](todo.md)

## Known Limitations

- `.canvas` and `.base` are detected and reported, but not rendered in v1
- some Quartz/KaTeX warnings may remain for math that mixes markdown-like syntax inside formulas
- community plugin syntax is intentionally unsupported

## License

This repository does not currently declare a separate license file.
