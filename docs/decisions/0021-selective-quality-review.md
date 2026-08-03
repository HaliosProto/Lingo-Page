# ADR 0021: Review only suspicious or explicitly selected segments

- Status: Accepted.
- Date: 2026-08-03

## Context

Sending every translation through a second model call doubles cost and clean-page latency. Deterministic checks can catch many integrity failures cheaply, but some semantic warnings benefit from a model review.

## Decision

Run bounded deterministic checks first. Structural protected-token and output-contract failures remain unresolved. Number, URL, email, code/product/formula/identifier, glossary, identical-output, truncation, expansion, markup/control, and language-carryover signals produce typed metadata.

Standard mode automatically reviews only suspicious IDs and permits one pass. Review-off makes no review call. On-demand review sends only the flagged IDs selected by the page session. Corrected results are restored, schema validated, and deterministically rechecked. Review failure, timeout, rate limit, malformed output, or unresolved status preserves the original safe translation and reports a warning. Cancellation stops review; review cannot recursively review itself.

Translation and review provider-call counts remain separate in the response and popup state.

## Consequences

Clean batches make one provider call. Suspicious work can improve without resending unrelated or successful segments, and review failure is non-destructive. Human quality acceptance and live-provider evaluation remain optional owner checks.
