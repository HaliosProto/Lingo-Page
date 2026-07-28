# ADR 0016: Reattach genuine restored tabs with atomic session claims

- Status: Accepted.
- Date: 2026-07-28
- Supersedes: the exact-tab-only browser-restart limitation in ADR 0011.

## Context

The first Milestone 2 recovery design keyed records by numeric tab ID, required that exact ID during reconstruction, and deleted the record from `tabs.onRemoved`. Chrome tab IDs are unique only within one browser session, and closing Chrome revokes `activeTab`. A Chrome-restored page can therefore receive a new ID, lose injection authority, and find that its record was deleted before it can reconstruct. Branded-Chrome acceptance at `fa2135b` exposed this failure.

The fix must not turn a URL into cross-tab ownership. A pasted URL, History entry, duplicate, or second normal tab must not inherit cached translations merely because it has the same address.

## Decision

Recovery record version 2 is keyed by translation session ID and adds:

- normalized HTTP/HTTPS origin plus SHA-256 origin and fragment-free navigation identities;
- a translation identity covering session, operation, source/target language, provider, and model;
- a browser-instance epoch stored in `chrome.storage.session`;
- explicit `owned`, `orphaned`, and short-lived `claiming` states;
- the old and current tab IDs, navigation generation, top-frame ownership, page fingerprint, expiry, and restart-recovery capability.

The popup requests only the current origin from the Translate click. Translation still works if permission is denied, but automatic browser-restart reconstruction is disabled for that session. Required host access remains limited to the local API and the test-only fixture; production has no required all-site host grant.

Browser shutdown or tab close orphans an eligible record rather than deleting it. Explicit End session, privacy mode, corruption, terminal state, incompatible navigation, permission revocation, and 30-minute expiry remain destructive. `chrome.alarms` performs bounded expiry sweeps without an always-running worker.

A candidate may claim only when Chrome supplies a bounded restoration signal:

- a new browser-instance startup window for browser/session restoration; or
- disappearance of a matching entry from `chrome.sessions.getRecentlyClosed`, backed by a short-lived privacy-safe identity token for worker-restart races.

The service worker also requires:

- an unexpired schema-valid record;
- exact origin and navigation hashes;
- a self-consistent translation identity;
- a unique matching record and exactly one compatible open candidate;
- current-origin injection permission;
- top-frame ownership and non-cancelled, non-ended lifecycle.

It writes `claiming` with a random claim ID and incremented navigation generation, reads the value back, injects the page shell, and asks the page to rediscover the live DOM. The page applies only confident fingerprint/structure/role matches. A non-exact page needs at least 50% confident overlap; changed, unmatched, and uncertain content remains original. Only after the page reports `recovered` does the worker finalize `owned` for the new tab. No provider request is made.

Within one service worker, a mutex serializes claims. Persisted claim IDs make same-tab retries idempotent across worker restarts. An incomplete claim blocks competitors for 15 seconds and then becomes reclaimable. Chrome storage does not provide compare-and-swap, so this is transaction-like rather than a general multi-process database transaction; Manifest V3 provides one service worker instance per extension profile.

## Same-URL and lifecycle safety

A normal same-URL tab has no restoration signal and cannot claim. Two open compatible candidates make identity ambiguous and both fail closed. Multiple same-URL recently-closed entries are also ambiguous and do not recover automatically. This can reject a legitimate restoration, but it cannot leak one tab's translated session into another.

`tabs.onRemoved` distinguishes closing windows from ordinary tab closes. A recently closed tab can recover only while its Chrome session evidence and short signal window remain compatible. Browser-startup reconciliation is limited to the startup window and the existing 30-minute record retention. Tab replacement follows the same release/claim path. Reload recovery for the currently owned tab remains exact-tab behavior.

## Consequences

- Continue-where-you-left-off and Ctrl+Shift+T can rebind a compatible session to a new tab ID with zero provider calls.
- Original/Translated switching and progress resume after the final translated DOM is ready.
- `sessions` and `alarms` become required API permissions. Neither grants page content access; site injection still requires `activeTab`, a required test/local host, or the explicitly granted current origin.
- Optional HTTP/HTTPS host declarations remain capability declarations, not automatic grants. No required `<all_urls>` is added.
- Branded-Chrome acceptance remains failed at the old build and needs owner retest on the corrected commit.
