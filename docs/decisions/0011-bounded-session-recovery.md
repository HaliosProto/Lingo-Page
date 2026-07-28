# ADR 0011: Persist privacy-minimized active-session recovery records

- Status: Accepted.
- Date: 2026-07-28

## Context

The page shell intentionally owns exact originals and live DOM bindings in memory, but that made every reload or browser lifecycle loss discard reusable translated work. Persisting the full page or M1 comparison bundle would retain unnecessary source text, HTML-like structure, and page titles.

## Decision

Persist one versioned, runtime-validated recovery record per active top-frame translation session in `chrome.storage.local` for at most 30 minutes. The record is capped at 2,500 segments and 2 MiB and contains tab/session/operation/navigation identities, fingerprints, status, completed segment IDs, and completed translated values. It excludes raw source text, exact originals, page titles, comparison snapshots, HTML, form values, hidden/protected content, credentials, and provider bodies.

Same-tab recovery requires the owning tab ID, top frame, exact fragment-free SHA-256 navigation identity, supported schema version, unexpired deadline, and non-terminal lifecycle. Privacy mode removes and disables recovery records. End session, incompatible navigation, expiry, corruption, clear-data, and privacy-mode activation clean the record. ADR 0016 defines the narrower exception for genuine Chrome-restored tabs: a close may orphan the record and a unique candidate may atomically claim it using Chrome restoration evidence.

## Consequences

Compatible reloads and Chrome-restored tabs can rediscover current originals and rebind cached translations with zero provider calls. Cancelled work never reattaches automatically. Recovery is intentionally bounded and is not browsing history or cloud synchronization. Numeric tab ID is no longer the sole restart identity; ADR 0016 requires current-origin permission, a restoration signal, strong compatibility, uniqueness, and an atomic claim.
