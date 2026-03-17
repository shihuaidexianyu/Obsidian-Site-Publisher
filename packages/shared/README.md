# `@osp/shared`

## Responsible For

- shared types and schemas
- shared constants and error shapes
- small logging primitives used across packages

## Not Responsible For

- app-specific UI logic
- filesystem traversal
- build orchestration

## Public Surface

- config, manifest, issue, build, and deploy types
- zod schemas for external inputs and persisted outputs
- shared logger and structured error helpers

## Depends On

- `zod`
