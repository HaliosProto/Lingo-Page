# ADR 0009: Acknowledge translated-copy handoff before cleanup

- Status: Accepted.
- Date: 2026-07-18

## Context

Translated copies and comparison need existing page translations without another provider call, while page text must not enter URLs, webpage JavaScript, permanent history, or a broadly readable store. Chrome's `activeTab` grant belongs to the source tab created by the user's extension action; it does not authorize injection into a newly created destination tab.

## Decision

The production manifest declares optional HTTP and HTTPS host permissions but does not grant either pattern automatically. From the explicit **Open translated copy** gesture, the extension explains why access is needed and requests only the source page's exact origin pattern, such as `https://en.wikipedia.org/*`. It never requests all-site access in one operation. A denial leaves the source session unchanged, is not prompted again by the same open view, and offers a manual duplicate-and-invoke fallback.

After the exact-origin grant is present, the source page shell exports a runtime-validated bundle capped at 2,500 segments and 2 MB. The service worker rechecks the grant, creates one visible `about:blank` destination tab, binds an unguessable token and validated cloned bundle to that tab in `chrome.storage.session`, and then navigates the tab to the exact source URL. It rechecks access against the final destination URL before injection, so a cross-origin redirect or revoked permission fails closed. The top-frame destination may retrieve the bundle only when its extension identity, tab ID, compatible navigation, version, and size are valid. Retrieval does not consume the bundle.

The destination first applies confident cached matches, waits for bounded initial readiness, and performs one bounded hydration reconciliation pass. Only after the final translated DOM is ready does it acknowledge receipt; only then is the central bundle removed. Duplicate claims after acknowledgment return an explicit already-applied status, and duplicate acknowledgments are idempotent.

A failed, expired, mismatched, unsupported, or interrupted handoff removes central page-text data and retains only bounded metadata describing failure. The user-visible destination tab is never removed by this cleanup. The tab stays open on the requested navigation so the user can retry or close it. Comparison transfer remains a separate single-retrieval owning-tab token; ADR 0010 defines its sanitized structural representation.

## Consequences

Matched copy content and comparison creation make no provider call. `activeTab` remains the normal translation permission, while translated-copy access is explicit and origin-scoped. Ending one page session cannot clear another. Temporary handoff page text exists only until acknowledgment, rejection, expiry, validation failure, or tab cleanup. A service-worker failure during the short handoff fails honestly but cannot close the visible page; durable restart recovery is deferred. The initial `about:blank` document prevents a destination startup race because the tab binding is stored before navigation begins.
