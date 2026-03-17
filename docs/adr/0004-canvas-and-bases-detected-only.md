# ADR 0004: Canvas And Bases Are Detected Only In V1

## Status

Accepted

## Context

Canvas and Bases are official features, but they are not part of the main markdown rendering path we are targeting first.

## Decision

Detect `.canvas` and `.base` files during scan and surface them as informational issues without rendering them into full site views.

## Consequences

- Official capabilities are acknowledged instead of ignored.
- The v1 scope stays aligned with markdown-first publishing.
