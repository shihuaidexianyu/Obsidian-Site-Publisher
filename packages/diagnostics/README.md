# `@osp/diagnostics`

## Responsible For

- deterministic diagnostics over a normalized manifest
- duplicate and unsupported-object detection
- future broken-link and unpublished-reference analysis

## Not Responsible For

- filesystem reads
- UI formatting
- build or deploy execution

## Public Surface

- `DiagnosticsEngine`
- `DefaultDiagnosticsEngine`
- `analyzeBrokenLinks`
- `analyzeDuplicateSlugs`
- `analyzeDuplicatePermalinks`

## Depends On

- `@osp/shared`
