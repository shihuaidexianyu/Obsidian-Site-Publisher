# ADR 0003: Official Obsidian Syntax Only

## Status

Accepted

## Context

Community plugin syntax is effectively unbounded and would make diagnostics, staging, and rendering behavior unstable.

## Decision

Only support official Obsidian syntax and official file formats in scope for the product.

## Consequences

- Product boundaries stay understandable.
- Unsupported syntax can be reported clearly instead of guessed.
- The implementation remains compatible with fixture-driven development.
