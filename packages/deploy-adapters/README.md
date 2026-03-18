# `@osp/deploy-adapters`

## Responsible For

- deployment target abstractions
- structured deploy results
- future Git and GitHub Pages publishing implementations
- local filesystem export for real deploy smoke tests

## Not Responsible For

- vault parsing
- diagnostics
- Quartz execution

## Public Surface

- `DeployAdapter`
- `DefaultDeployAdapter`
- `FileSystemDeployAdapter`
- `NoopDeployAdapter`

## Depends On

- `@osp/shared`
