# ADR 0020: Keep terminology memory bounded to the active page session

- Status: Accepted.
- Date: 2026-08-03

## Context

Separate long-page batches need consistent terminology, but remote or cross-site learning would create new retention, consent, privacy, and leakage risks.

## Decision

Maintain at most 200 source/translation term pairs in the active page session. Entries come from explicit glossary rules or validated translations, use bounded values, resolve conflicts with the latest explicit value, and travel only with relevant batches. Session rules override site rules, site rules override inferred terms, and irrelevant glossary entries are filtered before transfer.

Context and terminology memory remain structurally separate from translatable segment records. They cannot be returned or applied as segments. Memory is cleared on session end or incompatible navigation and is never synchronized or shared across sites in Milestone 3.

## Consequences

Long pages gain deterministic cross-batch consistency without unbounded prompt growth or autonomous learning. Cloud/team glossaries and durable translation memory remain future, separately approved work.
