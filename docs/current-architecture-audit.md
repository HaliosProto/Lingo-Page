# Current architecture audit

Audit date: 2026-07-18. Baseline inspected: `fdcc9aaca680691981bc5bcc0019e669b254bad1`; historical comparison baseline: `b929ac52484840c8c5b69f40719efb04b768f425`.

## Boundaries confirmed from code

- `apps/extension` owns Chrome activation, page support policy, DOM discovery/mutation, popup/options, transient page sessions, local settings/cache, and extension messaging.
- `apps/api` owns authentication policy, request limits, rate/quota checks, provider/model selection, operational errors, and route orchestration.
- `packages/translation-core` owns pure text normalization, IDs, batching, protected tokens, glossary transformations, and cache-key helpers.
- `packages/translation-providers` owns backend provider configuration, fixed payload construction, upstream calls, timeouts/retries, response parsing, and provider registry policy.
- Shared types, validation, configuration, UI tokens, and test helpers have explicit package boundaries. No architectural rewrite is justified by this audit.

## Translation lifecycle

The “tests” column names current evidence categories; gaps are listed separately to avoid implying more coverage than exists.

| #   | Stage                   | Code path and transformation                                          | Owner / trust boundary                 | Failure, privacy, and performance concerns                              | Current evidence / reuse                                                      |
| --- | ----------------------- | --------------------------------------------------------------------- | -------------------------------------- | ----------------------------------------------------------------------- | ----------------------------------------------------------------------------- |
| 1   | User activation         | Popup or context menu -> validated runtime request in `background.ts` | Extension UI/service worker            | Wrong tab, restricted page, accidental disclosure                       | Managed E2E; browser-specific activation remains client-owned                 |
| 2   | Page eligibility        | `classifyPageSupport` and domain/privacy settings                     | Service worker; URL is untrusted       | Heuristics miss sensitive pages; full URL must not be logged            | Unit/integration coverage; reusable policy inputs, browser-specific injection |
| 3   | DOM discovery           | `discover()` walks text nodes in `page-shell.ts`                      | Page shell; hostile DOM                | Large trees and mutation storms can block; top-level DOM only           | Unit logic plus 1,000-section E2E; DOM traversal remains browser-specific     |
| 4   | Exclusion filtering     | `excludedSelector`, `isVisible`, text heuristics                      | Page shell                             | Editable/hidden ancestor edge cases can disclose text                   | Fixture exclusions; missing inherited editability/hidden-ancestor cases       |
| 5   | Segment creation        | `createRecord()` normalizes and captures original                     | Page shell -> shared contract          | `surroundingText` can include excluded descendants; text held in memory | Unit and E2E mapping; segment contract reusable                               |
| 6   | Identity/fingerprint    | `createSegmentId`; ordinal and role                                   | Translation core/page session          | IDs are request-scoped, not durable identity                            | Unit tests; durable changed-section identity is M1 work                       |
| 7   | Priority selection      | Current order is DOM order                                            | Page shell                             | No viewport priority; long pages delay visible work                     | Inferred from code; viewport strategy pending                                 |
| 8   | Batch creation          | `batchSegments`, normally 50 segments/10,000 chars                    | Translation core                       | Many serial batches increase latency; bounds protect API                | Unit tests; reusable pure domain function                                     |
| 9   | Queueing                | `translateRecords` serial loop, progress counters                     | Page session                           | Popup closure loses presentation, not page state; no persistent job     | Partial/cancel E2E; durable queue design pending                              |
| 10  | Backend request         | `makeTranslationRequest` -> service worker `fetch`                    | Extension -> application API           | Backend unavailable, abort, invalid response                            | Mock integration/E2E; transport contract reusable                             |
| 11  | Local limits            | API content length/body/schema/segment/character/rate/quota checks    | API trust boundary                     | Body is buffered before encoded-byte check; counters are process-local  | API tests; production enforcement pending                                     |
| 12  | Provider selection      | Backend registry and model allowlist                                  | API/provider boundary                  | Unconfigured/disabled/invented values; no silent fallback               | Mocked provider/API tests; backend-only by design                             |
| 13  | Provider request        | Native/compatible adapters and `fetchProviderJson`                    | Provider package -> external recipient | Key secrecy, timeout, redirect/address policy, response size            | Mocked contract suite; live calls opt-in only                                 |
| 14  | Response normalization  | Adapter-specific parsing -> shared response                           | Provider package                       | Refusal, malformed JSON, truncation, upstream errors                    | Extensive mocked contract matrix                                              |
| 15  | Validation              | Zod plus ID/token/plain-text/expansion checks                         | Provider/API/extension boundaries      | Missing/duplicate/stale IDs or markup-like output                       | Unit/integration tests; reusable contracts                                    |
| 16  | DOM application         | `record.node.nodeValue = translatedText`                              | Page shell -> hostile page             | Detached/replaced nodes, page interference                              | Plain-text and restore E2E; browser-specific mutation                         |
| 17  | Progress update         | Page shell reports bounded structured progress                        | Page shell -> service worker -> popup  | Worker restart loses map; stale presentation                            | E2E and validation; progress schema reusable                                  |
| 18  | Retry                   | One bounded rate-limit retry with visible delay                       | Page session/API/provider              | Retry cost and cancellation timing                                      | Unit/browser partial-state evidence; provider retry policy backend-owned      |
| 19  | Partial continuation    | Reuses session; selects records without translations                  | Page session                           | Must never resend completed work                                        | 1,000-section cancellation/continuation E2E                                   |
| 20  | Cancellation            | Page epoch/timer plus service-worker AbortControllers                 | Page shell/service worker              | Worker suspension can lose controller; provider may finish remotely     | Unit/integration/E2E; lifecycle restart gap                                   |
| 21  | Navigation invalidation | `location.href` navigation identity and stale checks                  | Page session                           | SPA changes can require new action; URL equality is coarse              | Basic tests; route/race fixtures pending                                      |
| 22  | Restoration             | Exact captured `originalText` returned to connected nodes             | Page session -> DOM                    | New page-owned replacements must not be overwritten                     | Restore E2E; durable cross-restart restore unsupported                        |
| 23  | Cache interaction       | Memory map and optional bounded `translationCache`                    | Service worker/local storage           | 32-bit hashed key collision; opt-in text persistence                    | Unit/integration logic; cache off by default and clearable                    |
| 24  | Session cleanup         | Restore/navigation/tab events and bounded maps                        | Page/service worker/backend process    | Browser sleep/restart and backend restart lose transient state/counters | Partial evidence; explicit M1 lifecycle matrix required                       |

## State survival matrix

| State                                      | Popup closes                    | Service worker suspends            | Tab reload/navigation | Browser sleep/restart               | Backend restart                   |
| ------------------------------------------ | ------------------------------- | ---------------------------------- | --------------------- | ----------------------------------- | --------------------------------- |
| Page originals and translated-node records | Survives while page shell lives | Survives in page context           | Lost or invalidated   | Not guaranteed                      | Unaffected                        |
| Active AbortControllers and progress map   | Survives popup close            | Lost                               | Cleared/best effort   | Lost                                | Unaffected                        |
| Settings                                   | Survives                        | Survives in `chrome.storage.local` | Survives              | Survives unless cleared/uninstalled | Unaffected                        |
| Optional translation cache                 | Survives when enabled           | Survives, bounded to 200           | Survives              | Survives unless cleared/uninstalled | Unaffected                        |
| API rate/quota/provider usage maps         | Unaffected                      | Unaffected                         | Unaffected            | Unaffected if process remains       | Lost                              |
| Provider credentials/configuration         | Never in extension              | Never in extension                 | Never in extension    | Never in extension                  | Reloaded from backend environment |

## Architecture findings

1. The page shell is the authoritative owner of originals and current node mappings. This is safe for an active page but insufficient for guaranteed service-worker/browser recovery.
2. Popup state is a projection; closing it should not terminate page translation, but formal closure/reopen timing is unmeasured.
3. Current batching is deterministic and serial. That favors correctness but lacks viewport-first priority and adaptive concurrency.
4. The API is a development-ready orchestration boundary, not a production identity/quota boundary.
5. Provider abstraction is sufficiently isolated to preserve. Automatic hidden routing requires a future policy/consent/quality ADR; it must not be inferred from the registry.

## Required Milestone 1 tests

- Inherited/variant editable regions and hidden ancestors.
- Context construction that cannot include excluded descendant text.
- Popup close/reopen, service-worker termination/restart, tab reload/close, sleep/wake approximation, and backend restart.
- `pushState`, `replaceState`, `popstate`, in-flight navigation, and infinite-scroll mutation budgets.
- Small/medium/large/very-large timing, long-task, memory cleanup, cache, and restore evidence.
