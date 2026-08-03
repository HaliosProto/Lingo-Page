# ADR 0019: Validate one provider-neutral structured output contract

- Status: Accepted.
- Date: 2026-08-03

## Context

Native provider schemas improve conformance but cannot replace local trust-boundary validation. Malformed, truncated, missing, duplicate, unknown, empty, expanded, or markup-producing output must not reach DOM application, while independently valid siblings should survive.

## Decision

Use response schema version 1 and output-contract version 1 for every provider. Prefer native schema-constrained output, then native JSON mode, then strict JSON instructions. All paths parse into the same internal response and run the same identity, record, plain-text, protected-token, size, and deterministic-quality validation.

Valid records are accepted independently. Invalid, missing, duplicate, or unknown records remain unresolved for the existing adaptive coordinator. Completed IDs remain immutable and are never resent. Raw provider bodies never cross the provider boundary or enter logs/diagnostics.

## Consequences

Provider capability changes affect mechanism rather than meaning. Partial recovery remains useful without weakening validation, and raw output cannot reach DOM mutation code.
