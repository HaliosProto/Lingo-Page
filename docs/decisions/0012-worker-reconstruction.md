# ADR 0012: Reconstruct worker state from validated page and storage authority

- Status: Accepted.
- Date: 2026-07-28

## Context

Manifest V3 service workers are temporary. Process-local progress maps, abort controllers, retry waits, and handoff coordinators cannot be the only source of recoverable state.

## Decision

On startup and popup queries, the worker treats process maps as caches. It validates and prunes recovery storage, queries the current page shell, and imports an exact-tab/navigation recovery record only when the page shell is idle. Pending provider work is never restarted automatically. Absolute expiry/navigation identity and terminal state decide whether the record is recovered, paused, expired, stale, or removed.

Duplicate request attempts share one in-process promise keyed by operation, batch, attempt, and navigation generation. Existing translated-copy and comparison records retain their single-owner, bounded, idempotent state machines.

## Consequences

Worker restart no longer discards completed reusable work, popup reopening does not restart translation, and duplicate messages cannot multiply a living attempt. In-flight network ambiguity becomes a paused user-resumable state after page lifecycle loss rather than an automatic resend. Physical worker termination remains a manual acceptance check where browser tooling exposes it.
