# `@osp/deploy-adapters`

## Responsible For

- deployment target abstractions
- structured deploy results
- future Git and GitHub Pages publishing implementations
- local filesystem export for real deploy smoke tests
- git branch deployment for branch-based publishing workflows
- GitHub Pages deployment for repository-backed pages publishing

## Not Responsible For

- vault parsing
- diagnostics
- Quartz execution

## Public Surface

- `DeployAdapter`
- `DefaultDeployAdapter`
- `FileSystemDeployAdapter`
- `GitBranchDeployAdapter`
- `GitHubPagesDeployAdapter`
- `NoopDeployAdapter`

## Depends On

- `@osp/shared`
