# `@osp/parser`

## Responsible For

- scanning vault content into a normalized manifest
- extracting metadata needed for diagnostics and staging
- identifying official-but-unsupported objects such as Canvas and Bases

## Not Responsible For

- rendering HTML
- Quartz execution
- deployment

## Public Surface

- `VaultParser`
- `FileSystemVaultParser`
- `ScanInput`
- `ScanResult`

## Depends On

- `@osp/shared`
