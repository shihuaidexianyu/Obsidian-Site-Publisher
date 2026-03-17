# `apps/publisher-cli`

## Responsible For

- local debugging entrypoint
- CI-friendly orchestration entrypoint
- shell-safe command routing for scan, build, preview, and deploy

## Not Responsible For

- Obsidian UI
- vault parsing internals
- diagnostics internals
- deploy target internals

## Public Surface

- `runCli`

## Depends On

- `@osp/core`
- `@osp/shared`
