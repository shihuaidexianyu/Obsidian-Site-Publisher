# `@osp/staging`

## Responsible For

- preparing temporary build and preview workspaces
- copying the selected markdown slice into a Quartz-ready content tree
- copying referenced asset files that published notes depend on
- applying `publishMode / publishRoot / includeGlobs / excludeGlobs` before filesystem copy
- writing normalized manifest artifacts
- clearing stale staging output before each run
- isolating filesystem side effects away from core orchestration

## Not Responsible For

- vault parsing
- diagnostics rules
- Quartz process execution

## Public Surface

- `StagingService`
- `PrepareStagingInput`
- `FileSystemStagingService`

## Depends On

- `@osp/shared`
