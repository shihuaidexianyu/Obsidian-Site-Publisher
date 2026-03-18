# `apps/publisher-cli`

## Responsible For

- local debugging entrypoint
- CI-friendly orchestration entrypoint
- shell-safe command routing for `scan`, `build`, `preview`, and `deploy`
- loading config from `osp.config.json` / `publisher.config.json` or `--vault-root`
- human-readable terminal summaries and exit codes

## Not Responsible For

- Obsidian UI
- vault parsing internals
- diagnostics internals
- deploy target internals

## Public Surface

- `runCli`

## Current Behavior

- `publisher-cli scan --vault-root ./test_vault/hw`
- `publisher-cli build --config ./osp.config.json`
- `publisher-cli preview --vault-root ./my-vault`
- `publisher-cli deploy --config ./publisher.config.json`

## Depends On

- `@osp/core`
- `@osp/shared`
