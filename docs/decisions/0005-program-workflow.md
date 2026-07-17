# ADR 0005: Use specifications for authority and Beads for execution

- Status: Accepted.
- Date: 2026-07-18

## Context

The established repository has living specifications, historical milestone documents, a Beads database, and an optional future specification-template CLI. Duplicate task/specification/memory systems could contradict or overwrite repository rules.

## Decision

Use this authority order: product constitution/vision; approved milestone specification; ADRs/contracts; Beads task/dependency graph; implementation/tests; project memory/historical notes. Beads is operational tracking and durable short memory, not the product specification. Optional Obsidian notes link to canonical sources and use explicit status labels. The template CLI may be integrated only through the isolated, pinned, diff-reviewed plan in `docs/tooling-and-workflow.md`.

## Consequences

Only the next approved milestone receives detailed tasks. No tool may rewrite `AGENTS.md`, canonical docs, Beads configuration, or memory files without review. A missing optional CLI does not block specification-driven work.
