# Data retention and intelligence boundaries

## Current data lifecycle

| Data                             | Location                                           | Default          | Bound / deletion                                                 | External recipient                        |
| -------------------------------- | -------------------------------------------------- | ---------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| Eligible originals/translations  | Owning top-frame page-shell memory                 | Transient        | End session, navigation invalidation, tab close, or script loss  | Selected provider through application API |
| Explicit translated-copy handoff | `chrome.storage.session` under owning tab/token    | Off              | Acknowledgment, rejection, expiry, validation failure, tab close | None                                      |
| Explicit comparison bundle       | `chrome.storage.session` under random owning token | Off              | Single retrieval, tab cleanup, invalid data, or browser session  | None                                      |
| Translated-text cache            | `chrome.storage.local` key `translationCache`      | Off              | Maximum 200 entries; clearable; removed/disabled by privacy mode | None beyond the original active request   |
| Settings and glossary            | `chrome.storage.local` key `appSettings`           | Local            | Until clear/uninstall; schema validated                          | No sync                                   |
| Progress/session metadata        | Page/service-worker memory                         | Transient        | Lost on worker/browser lifecycle                                 | Application API receives request metadata |
| API rate/quota counters          | Worker process memory                              | Development only | Reset on restart                                                 | None                                      |
| Diagnostics                      | User-generated local export                        | Off              | User controls the file                                           | Only if user explicitly shares it         |

## Milestone 3 local intelligence state

| Data                                | Location                                 | Default                     | Bound / deletion                                                   | External recipient                                      |
| ----------------------------------- | ---------------------------------------- | --------------------------- | ------------------------------------------------------------------ | ------------------------------------------------------- |
| Translation policy and custom brief | `appSettings` in local extension storage | safe policy v1; empty brief | brief 2,000 characters; cleared with local data/uninstall          | selected provider only during explicit relevant request |
| Global/site glossary                | `appSettings` in local extension storage | empty                       | 500 entries; site values exact-origin scoped; clear/uninstall      | selected provider only when relevant                    |
| Session glossary/terminology        | owning page-shell memory                 | empty                       | 200 sent terminology entries; end/incompatible navigation/tab loss | selected provider only during active request            |
| Page/section context                | owning page-shell/request memory         | enabled, bounded            | request lifetime; title 300, heading path 8, nearby 3+3 records    | same selected provider as translation/review            |
| Quality findings/review state       | page-shell progress/recovery metadata    | deterministic checks on     | reason/ID/count metadata; active-session lifetime                  | no additional recipient; review uses selected provider  |

No raw provider/reviewer response, page history, correction analytics, remote translation memory, synchronized glossary, or training corpus is persisted. Review requests bypass translation cache; validated corrected translations follow the same opt-in cache cap and privacy-mode deletion rules.

## Future translation memory, glossary, feedback, and analytics

- Translation memory must store source/target pairs only after an explicit local or account-level choice, with scope, language, ownership, provenance, version, quality state, retention, export, and deletion.
- Glossary terms remain local by default. Team glossaries require authorization, versioning, conflict handling, auditability, and tenant isolation.
- Post-edit learning must separate raw edits from derived preferences, support review/undo/deletion, and never silently train a shared model.
- Personal analytics should prefer local aggregation. Remote metrics require a defined purpose, event minimization, consent/opt-out, short retention, deletion, and no raw page text/full URL.
- Automatic routing may use capability, language, privacy region, quality, latency, and cost metadata only under a disclosed policy. Page content cannot cause arbitrary endpoint selection.

## Persistence approval checklist

Purpose, data classification, minimum fields, owner/controller, storage region, encryption/access, retention clock, deletion semantics, export/portability, corruption/migration behavior, offline behavior, sync conflicts, child/enterprise considerations, observability redaction, incident response, and tests must be approved before implementation.

Translated-copy bundles are transferred through tab-bound `chrome.storage.session` and cloned into independent page-shell memory. Central page-text data is not consumed on retrieval: it is removed after the destination acknowledges its validated local copy, or on rejection, expiry, validation failure, tab close, or browser-session loss. Failure metadata is bounded and contains no page text. A user-visible destination tab is not cleanup data and remains open. Ending one page session cannot clear another.

Comparison snapshots are captured only after an explicit action and contain allowlisted inert structure plus original/translated session text. Bundle validation limits a session to 2,500 segments, a snapshot to 15,000 nodes, and the full serialized transfer to 2 MB. Invalid, oversized, stale, or mismatched data is rejected and cleaned up. Neither transfer is history, account data, analytics, or durable restart state.

## Active-session recovery

Milestone 2 uses a separate `translationRecovery:<sessionId>` record in `chrome.storage.local` so reloads and genuine Chrome-restored tabs can survive worker/page lifecycle loss even when a numeric tab ID changes. It is versioned, runtime validated, capped at 2,500 segments and 2 MiB, and expires 30 minutes after the latest page-shell report. It contains translated reuse values and privacy-safe identities/fingerprints but no raw source text, exact original text, full URL, title, HTML, form value, comparison snapshot, credential, or provider payload.

The record is removed on End session, cancellation for restored-tab purposes, incompatible navigation, expiry, permission revocation, corruption/unknown version, clear-data, or privacy-mode activation. A tab close may instead mark restart-enabled state `orphaned`; a short startup or recently-closed signal can transfer it once to a unique compatible tab. `chrome.storage.session` holds only the browser epoch, hashed recent-navigation signal, and short deadlines; it clears with the browser process. At most 12 recent records survive pruning, and a five-minute alarm removes expired/abandoned records. This is active recovery, not history, sync, or analytics.
