# ADR 0007: Make durable sessions and BiDi safety Milestone 1 architecture work

- Status: Proposed; implementation pending Milestone 1 approval.
- Date: 2026-07-18

## Context

Originals and node mappings live safely in the active page shell, while service-worker progress/controllers are transient. Mixed-direction rendering has coarse `dir="auto"` support but no content-unit isolation contract. These gaps affect correctness and release confidence.

## Proposed decision

Design a versioned, text-minimizing browser session journal that can reconcile page identity, original/translated state, changed sections, pending work, and lifecycle recovery without automatically persisting raw page text. Pair it with a BiDi Safety Engine contract that separates UI chrome, source, translation, and identifier direction and preserves logical clipboard strings.

## Evidence required

Threat/privacy review, storage quota/migration/deletion behavior, stale-DOM recovery prototype, service-worker/browser lifecycle matrix, repeated-toggle no-call proof, changed-section identity tests, mixed-script visual/clipboard/screen-reader fixtures, and rollback to the current in-memory path.

## Consequences

No persistence schema or host-page direction mutation is accepted by this ADR yet. Failure to meet privacy/correctness evidence keeps the current transient session model and limits release claims.
