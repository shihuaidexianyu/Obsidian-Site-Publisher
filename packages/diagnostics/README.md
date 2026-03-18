# `@osp/diagnostics`

## Responsible For

- deterministic diagnostics over a normalized manifest
- duplicate and unsupported-object detection
- broken-link, asset, frontmatter, and embed-cycle analysis

## Not Responsible For

- filesystem reads
- UI formatting
- build or deploy execution

## Public Surface

- `DiagnosticsEngine`
- `DefaultDiagnosticsEngine`
- `analyzeBrokenLinks`
- `analyzeMissingAssets`
- `analyzeUnpublishedReferences`
- `analyzeInvalidFrontmatter`
- `analyzeDuplicateSlugs`
- `analyzeDuplicatePermalinks`
- `analyzeCircularEmbeds`

## Depends On

- `@osp/shared`
