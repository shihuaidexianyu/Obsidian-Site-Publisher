# `@osp/staging`

## Responsible For

- preparing temporary build and preview workspaces
- writing normalized manifest artifacts
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
