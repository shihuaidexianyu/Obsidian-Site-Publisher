# ADR 0001: Use Quartz As Primary Builder

## Status

Accepted

## Context

The project needs a static site engine with strong Obsidian compatibility, but the repository should not own a full markdown rendering stack.

## Decision

Use Quartz as the primary site builder behind a dedicated builder adapter package.

## Consequences

- We reuse mature site-generation features instead of rebuilding them.
- The project remains an orchestrator, not a competing SSG.
- Builder replacement stays possible because Quartz is hidden behind an interface.
