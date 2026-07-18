# ADR 0007: Make durable sessions and BiDi safety Milestone 1 architecture work

- Status: Accepted and implemented in Milestone 1.
- Date: 2026-07-18

## Context

Originals and node mappings live safely in the active page shell, while service-worker progress/controllers are transient. Mixed-direction rendering has coarse `dir="auto"` support but no content-unit isolation contract. These gaps affect correctness and release confidence.

## Decision

Keep the authoritative session, exact text, and DOM bindings in top-frame page-shell memory. Separate display mode from lifecycle, retain originals/translations through view switches, and use versioned bounded bundles only for explicit copy/comparison actions. Pair this with content-boundary `dir="auto"`, logical CSS, plain-text clipboard values, and no ancestor-direction mutation.

## Evidence required

Threat/privacy review, storage quota/migration/deletion behavior, stale-DOM recovery prototype, service-worker/browser lifecycle matrix, repeated-toggle no-call proof, changed-section identity tests, mixed-script visual/clipboard/screen-reader fixtures, and rollback to the current in-memory path.

## Consequences

Normal page text remains transient and page-owned. Temporary comparison bundles use `chrome.storage.session` with a single-use owning-tab token; translated copies receive independent cloned sessions. Full restart persistence remains deferred, and no host-page direction mutation is introduced.
