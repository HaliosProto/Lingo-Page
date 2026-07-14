# ADR 0004: Translate text nodes in place; never replace page HTML

- Status: Accepted.
- Date: 2026-07-15

## Context

Replacing page HTML would destroy event handlers, framework state, form values, links, styling relationships, security boundaries, and user changes. Provider output is untrusted.

## Decision

Traverse eligible text nodes, preserve exact originals, apply validated translated strings to those nodes, and track reversible scoped layout metadata. Provider output is always plain text.

## Consequences

Some inline sentence structures, canvas text, image text, shadow DOM, cross-origin frames, and heavily dynamic pages require conservative partial support. The product reports those limitations instead of pretending to translate them. Restore must detect page-authored changes before writing originals back.
