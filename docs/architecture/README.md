# Architecture Overview

The repository is organized around a strict orchestration boundary:

1. `@osp/parser` turns vault content into a normalized manifest.
2. `@osp/diagnostics` evaluates the manifest and emits structured issues.
3. `@osp/staging` prepares a temporary workspace for build or preview.
4. `@osp/builder-adapter-quartz` turns the staged workspace into a site.
5. `@osp/deploy-adapters` publishes a successful build.
6. `@osp/core` is the only package allowed to coordinate all of the above.

## Boundary Rules

- UI layers must not parse vault content directly.
- Adapters must not own product policy.
- Shared schemas must validate all persisted configuration and manifest data.
- Unsupported official features must be surfaced explicitly, not silently ignored.

## Current Implementation Status

- Interfaces and workspace structure are in place.
- Diagnostics has a first-pass implementation for duplicate slugs, duplicate permalinks, and unsupported-object reporting.
- Parser, Quartz build, and deploy adapters are scaffolded and intentionally minimal.
