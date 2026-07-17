# Data retention and intelligence boundaries

## Current data lifecycle

| Data                                 | Location                                            | Default          | Bound / deletion                                                 | External recipient                        |
| ------------------------------------ | --------------------------------------------------- | ---------------- | ---------------------------------------------------------------- | ----------------------------------------- |
| Eligible page segments and originals | Page/service-worker memory during an active session | Transient        | Lost on lifecycle end; restore/cleanup where supported           | Selected provider through application API |
| Translated-text cache                | `chrome.storage.local` key `translationCache`       | Off              | Maximum 200 entries; clearable; removed/disabled by privacy mode | None beyond the original active request   |
| Settings and glossary                | `chrome.storage.local` key `appSettings`            | Local            | Until clear/uninstall; schema validated                          | No sync                                   |
| Progress/session metadata            | Page/service-worker memory                          | Transient        | Lost on worker/browser lifecycle                                 | Application API receives request metadata |
| API rate/quota counters              | Worker process memory                               | Development only | Reset on restart                                                 | None                                      |
| Diagnostics                          | User-generated local export                         | Off              | User controls the file                                           | Only if user explicitly shares it         |

## Future translation memory, glossary, feedback, and analytics

- Translation memory must store source/target pairs only after an explicit local or account-level choice, with scope, language, ownership, provenance, version, quality state, retention, export, and deletion.
- Glossary terms remain local by default. Team glossaries require authorization, versioning, conflict handling, auditability, and tenant isolation.
- Post-edit learning must separate raw edits from derived preferences, support review/undo/deletion, and never silently train a shared model.
- Personal analytics should prefer local aggregation. Remote metrics require a defined purpose, event minimization, consent/opt-out, short retention, deletion, and no raw page text/full URL.
- Automatic routing may use capability, language, privacy region, quality, latency, and cost metadata only under a disclosed policy. Page content cannot cause arbitrary endpoint selection.

## Persistence approval checklist

Purpose, data classification, minimum fields, owner/controller, storage region, encryption/access, retention clock, deletion semantics, export/portability, corruption/migration behavior, offline behavior, sync conflicts, child/enterprise considerations, observability redaction, incident response, and tests must be approved before implementation.
