# `@osp/staging`

## Responsible For

- preparing temporary build and preview workspaces
- copying the selected markdown slice into a Quartz-ready content tree
- copying referenced asset files that published notes depend on
- applying `publishMode / publishRoot / includeGlobs / excludeGlobs` before filesystem copy
- normalizing a small, explicit subset of Obsidian-authored markdown quirks before Quartz sees them
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

## Markdown Compatibility Rules

Before staged markdown is written to disk, `@osp/staging` applies a narrow compatibility pass for math syntax that is commonly accepted by Obsidian but fragile in Quartz/KaTeX pipelines:

- `($$ ... $$)` and `（$$ ... $$）` are collapsed into inline `$...$`
- `\(...\)` is normalized into inline `$...$`
- `\[...\]` is normalized into canonical `$$` display-math blocks
- single-line `$$ ... $$` display math is rewritten so the delimiters live on their own lines
- extra blank lines at the edges of display-math blocks are trimmed
- fenced code blocks and inline code spans are left untouched

This pass is intentionally conservative: it only smooths over syntax mismatches we have reproduced in real vaults, and it does not attempt to emulate community-plugin rendering.
