# System Overview

## Goal

Obsidian Site Publisher turns a selected subset of a desktop Obsidian vault into a static site without moving build complexity into the Obsidian renderer process.

## Runtime Layers

### 1. Obsidian Plugin

Responsibilities:

- expose settings and commands
- show status, issue summaries, and log summaries
- call an external CLI process

Non-responsibilities:

- parsing vault content
- running Quartz directly in-process
- owning deploy logic

### 2. Publisher CLI

Responsibilities:

- provide the executable interface for `scan`, `build`, `preview`, and `deploy`
- own CLI logging and machine-readable JSON results
- host preview as an external process

The CLI is the operational boundary used by the plugin.

### 3. Core Pipeline

`@osp/core` coordinates:

1. parser
2. diagnostics
3. staging
4. builder adapter
5. deploy adapter

This package is the only place allowed to orchestrate the full workflow.

## End-to-End Flow

### Scan

1. CLI receives vault path or config path
2. `@osp/parser` scans the vault and produces a manifest
3. `@osp/diagnostics` analyzes the manifest and emits issues
4. CLI returns structured JSON and writes a log file

### Build

1. scan the vault
2. diagnose the manifest
3. stop on blocking issues when required
4. stage only the publish slice and required assets
5. hand the staging workspace to Quartz
6. return a structured build result

### Preview

1. run the same pipeline as build
2. start a preview server from the staged/build output
3. keep preview lifecycle in the CLI process
4. return preview URL and log metadata

### Deploy

1. build successfully
2. select a deploy adapter
3. push to local export, Git branch, or GitHub Pages
4. return a structured deploy result

## Supported Content Model

Supported in v1:

- Markdown notes
- frontmatter / Properties
- Obsidian links, embeds, headings, and block references
- official attachment directory behavior
- `.canvas` / `.base` detection and reporting

Unsupported in v1:

- community plugin syntax
- full Obsidian renderer parity
- edit-back from website to vault

## Testing Strategy

The repository uses two input classes:

- `fixtures/` for deterministic focused regression tests
- `test_vault/hw` for real-world smoke validation

The goal is to keep product logic stable while still validating behavior against a realistic vault.
