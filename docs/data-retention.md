# Data retention and intelligence boundaries

## Current data lifecycle

| Data                            | Location                                           | Default          | Bound / deletion                                                 | External recipient                        |
| ------------------------------- | -------------------------------------------------- | ---------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| Eligible originals/translations | Owning top-frame page-shell memory                 | Transient        | End session, navigation invalidation, tab close, or script loss  | Selected provider through application API |
| Explicit comparison bundle      | `chrome.storage.session` under random owning token | Off              | Single retrieval, tab cleanup, invalid data, or browser session  | None                                      |
| Translated-text cache           | `chrome.storage.local` key `translationCache`      | Off              | Maximum 200 entries; clearable; removed/disabled by privacy mode | None beyond the original active request   |
| Settings and glossary           | `chrome.storage.local` key `appSettings`           | Local            | Until clear/uninstall; schema validated                          | No sync                                   |
| Progress/session metadata       | Page/service-worker memory                         | Transient        | Lost on worker/browser lifecycle                                 | Application API receives request metadata |
| API rate/quota counters         | Worker process memory                              | Development only | Reset on restart                                                 | None                                      |
| Diagnostics                     | User-generated local export                        | Off              | User controls the file                                           | Only if user explicitly shares it         |

## Future translation memory, glossary, feedback, and analytics

- Translation memory must store source/target pairs only after an explicit local or account-level choice, with scope, language, ownership, provenance, version, quality state, retention, export, and deletion.
- Glossary terms remain local by default. Team glossaries require authorization, versioning, conflict handling, auditability, and tenant isolation.
- Post-edit learning must separate raw edits from derived preferences, support review/undo/deletion, and never silently train a shared model.
- Personal analytics should prefer local aggregation. Remote metrics require a defined purpose, event minimization, consent/opt-out, short retention, deletion, and no raw page text/full URL.
- Automatic routing may use capability, language, privacy region, quality, latency, and cost metadata only under a disclosed policy. Page content cannot cause arbitrary endpoint selection.

## Persistence approval checklist

Purpose, data classification, minimum fields, owner/controller, storage region, encryption/access, retention clock, deletion semantics, export/portability, corruption/migration behavior, offline behavior, sync conflicts, child/enterprise considerations, observability redaction, incident response, and tests must be approved before implementation.

Translated-copy bundles are transferred directly between extension contexts and cloned into independent page-shell memory. They are not a durable store and ending one copy cannot clear another. Bundle validation limits a session to 2,500 segments and 2 MB; invalid, oversized, stale, or mismatched data is rejected and cleaned up.
