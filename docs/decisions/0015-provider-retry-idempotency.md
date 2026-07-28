# ADR 0015: Separate provider recovery from request idempotency

- Status: Accepted.
- Date: 2026-07-28

## Context

Adaptive splitting already recovered partial provider output in one live page shell, but lifecycle retries need stable identity and must not multiply extension and backend attempts.

## Decision

The page shell remains the adaptive-recovery coordinator. It preserves valid records, retries unresolved IDs only, splits retryable incomplete/timeout work, honors Retry-After, and bounds depth, attempts, and elapsed time. Each outbound attempt carries operation, batch, attempt, navigation-generation, and segment identities. The worker deduplicates identical living attempts and returns the same promise.

Completed translated values are persisted only in the bounded active recovery record. Reload/worker reconstruction never makes an automatic provider request; it restores completed work and exposes remaining work as paused/partial. Offline, backend-unavailable, timeout, rate-limit, provider-unavailable, authentication, quota, invalid-response, cancellation, and exhaustion remain distinct privacy-safe categories.

## Consequences

Completed sections are never automatically resent after lifecycle recovery, cancellation wins over waits, and retry loops remain bounded. Because the backend has no durable production idempotency store in Milestone 2, an ambiguous in-flight transport failure is not auto-replayed; the user deliberately resumes remaining work.
