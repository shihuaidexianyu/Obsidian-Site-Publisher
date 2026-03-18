# `@osp/builder-adapter-quartz`

## Responsible For

- adapting prepared workspaces to Quartz preview and build commands
- materializing the minimal Quartz runtime files inside the staging workspace
- capturing build logs and returning structured build results
- starting and stopping local Quartz preview processes

## Not Responsible For

- vault parsing
- diagnostics
- deployment

## Public Surface

- `BuilderAdapter`
- `QuartzBuilderAdapter`
- `QuartzBuilderAdapter.stopPreview()`

## Depends On

- `@osp/shared`
- official Quartz v4 runtime from `github:jackyzha0/quartz#v4`
