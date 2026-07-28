# ADR 0011: Persist privacy-minimized active-session recovery records

- Status: Accepted.
- Date: 2026-07-28

## Context

The page shell intentionally owns exact originals and live DOM bindings in memory, but that made every reload or browser lifecycle loss discard reusable translated work. Persisting the full page or M1 comparison bundle would retain unnecessary source text, HTML-like structure, and page titles.

## Decision

Persist one versioned, runtime-validated recovery record per active top-frame tab in `chrome.storage.local` for at most 30 minutes. The record is capped at 2,500 segments and 2 MiB and contains tab/session/operation/navigation identities, fingerprints, status, completed segment IDs, and completed translated values. It excludes raw source text, exact originals, page titles, comparison snapshots, HTML, form values, hidden/protected content, credentials, and provider bodies.

Recovery requires the owning tab ID, top frame, exact fragment-free SHA-256 navigation identity, supported schema version, unexpired deadline, and non-terminal lifecycle. Privacy mode removes and disables recovery records. End session, tab close, incompatible navigation, expiry, corruption, clear-data, and privacy-mode activation clean the record.

## Consequences

Compatible reloads and Chrome-restored tabs can rediscover current originals and rebind cached translations with zero provider calls. Cancelled work reconstructs as paused and never resumes automatically. Recovery is intentionally bounded and is not browsing history or cloud synchronization. Browser restart support remains limited to Chrome restoring the same tab identity; broader cross-tab claiming is rejected to prevent leakage.
