# ADR 0013: Reject stale work with navigation generations

- Status: Accepted.
- Date: 2026-07-28

## Context

URL string checks alone do not cover delayed responses, same-document routing, repeated initialization, or mutation work queued before a route transition.

## Decision

Every page session owns a monotonically increasing navigation generation. Translation requests carry session, operation, batch, attempt, generation, and segment identities. A 250 ms page-shell route check plus `tabs.onUpdated` invalidates incompatible URL/content identities. Mutation queues and response application validate the active generation; advancing it drops queued roots and cancels obsolete provider work.

Fragment-only navigation retains the same hashed identity. Path/query/origin changes invalidate persisted recovery. Same-URL DOM replacement is treated as content reconciliation and may rebind only unique fingerprint-plus-structure matches.

## Consequences

Late results and obsolete mutations cannot affect a new route. Compatible node replacement can reuse cached translations locally, while incompatible routes remain original and require a deliberate new translation. The conservative policy may invalidate some reusable SPA content rather than risk cross-route mutation.
