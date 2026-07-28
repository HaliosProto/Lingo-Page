# Milestone 2 specification: reliability, lifecycle resilience, and performance

- Status: Accepted for implementation by the product-owner Milestone 2 brief.
- Approved: 2026-07-28.
- Branch: `milestone/02-reliability-lifecycle-performance`
- Starting commit: `d7b28468744e3c7111d3d8a33e524c554b511c31`
- Beads epic: `translation-1mp.3`
- Baseline: `docs/milestones/milestone-2-reliability-baseline.md`

## Objective

Make the Manifest V3 extension recover safely and remain responsive through service-worker suspension, page and browser lifecycle changes, SPA navigation, delayed hydration, mutation storms, large pages, transient provider failures, and temporary network/backend outages. Recovery must preserve completed work, avoid duplicate provider calls, reject stale work, remain bounded, and retain the established privacy and least-privilege model.

## Browser-restart acceptance correction

Branded Chrome exposed that the initial implementation at `fa2135b` could not recover after Chrome closed and Ctrl+Shift+T restored the page. Numeric tab IDs are browser-session scoped, the old `tabs.onRemoved` path deleted the record, and `activeTab` ended when the original tab closed. ADR 0016 therefore replaces exact-tab-only restart recovery with current-origin permission plus restoration signals, session-keyed records, browser-instance epochs, strong DOM/identity compatibility, and an atomic unique-candidate claim. The historical failure remains part of the verification record until the owner retests the corrected build.

## Scope and non-goals

Milestone 2 covers bounded active-session recovery, lifecycle reconstruction, navigation generations, hydration rebinding, mutation backpressure, large-page scheduling and ceilings, provider/network recovery, idempotency, cleanup, compact recovery UX, and deterministic verification.

It does not add translation briefs, tone/dialect/audience controls, advanced glossary features, accounts, cloud sync, billing, subscriptions, deployment/publication, desktop/mobile applications, Vision/OCR, meetings/audio, Lingo Studio, a full side-panel redesign, or live-provider verification. Milestone 3 and later work must not begin.

## Authority and acceptance

The product constitution and vision define the product boundaries. This approved specification narrows Milestone 2. Current code and actual verification evidence determine what is implemented. Roadmap and task documents describe sequencing but are not proof of completion.

The milestone remains open until the implementation, minimum 68 deterministic acceptance cases, applicable static/browser/runtime/security/performance checks, documentation, and evidence pass. Unavailable branded-Chrome, physical sleep/wake, forced-GC, or live-provider checks must be reported as unavailable rather than inferred.

## State ownership and persistence contract

| State                                                                                | Owner                                        | Persistence                                     | Lifetime and bounds                                                                   |
| ------------------------------------------------------------------------------------ | -------------------------------------------- | ----------------------------------------------- | ------------------------------------------------------------------------------------- |
| Exact live `Text` node bindings and exact originals                                  | top-frame page shell                         | memory only                                     | current document/session; released on end, incompatible navigation, or unload         |
| Current navigation generation and DOM reconciliation queues                          | page shell                                   | memory, reconstructable from validated metadata | current document; bounded queues and generation checks                                |
| Active recovery record                                                               | `chrome.storage.local`                       | versioned, runtime validated                    | active session only; 30-minute expiry; bounded segments and bytes                     |
| Browser epoch, startup/recently-closed signals, and temporary handoff metadata       | service worker plus `chrome.storage.session` | privacy-safe hashes, IDs, and deadlines         | current browser process; short bounded windows                                        |
| Copy intents and comparison handoffs                                                 | service worker plus `chrome.storage.session` | existing M1 temporary contract                  | single destination/consumer; explicit expiry and cleanup                              |
| User settings and optional translated-text cache                                     | `chrome.storage.local`                       | existing validated M0/M1 contract               | until cleared/uninstalled; cache remains opt-in, capped, and disabled by privacy mode |
| Provider credentials, endpoints, retry policy, and upstream calls                    | backend                                      | never stored in extension state                 | backend policy                                                                        |
| Raw page HTML, input values, hidden/protected text, credentials, raw provider bodies | prohibited                                   | never                                           | not persisted, logged, placed in URLs, or exposed in diagnostics                      |

The recoverable record uses an explicit schema version and contains only the minimum material needed to reconstruct a compatible active session: session/operation identity, tab/frame ownership, normalized navigation identity and generation, page fingerprint, source/target/provider/model identifiers, display/lifecycle state, bounded segment fingerprints/status, completed translated text needed for the active recovery window, progress counters, idempotency ledger, deadlines, and timestamps.

The record must:

- be limited to the top frame and either its owning tab or one atomically claimed Chrome-restored replacement;
- be capped at 2,500 segment records and 2 MiB serialized size;
- expire after a bounded active-session retention window;
- be removed for ended, cancelled, expired, corrupt, incompatible, revoked, cross-tab, or cross-navigation work;
- fail closed on unknown versions or invalid fields;
- migrate only through explicit validated migrations;
- never trigger an automatic provider call during reconstruction;
- be disabled or reduced consistently with privacy mode and cache policy;
- retain only translated reuse values required for the active recovery window, not an indefinite browsing history.

## Identity and idempotency

Every translation attempt carries:

- session ID;
- operation ID;
- batch ID;
- attempt ID;
- navigation generation;
- segment IDs.

The page shell increments the navigation generation whenever content identity may have changed. Only responses matching the current tab, frame, session, operation, generation, batch, and active attempt may mutate the DOM or progress. Completed segment IDs are immutable within an operation. Duplicate initialization/messages/responses are acknowledged idempotently and cannot create another provider call, tab, observer, timer, or application pass. Cancellation and terminal session state always win over retries or late responses.

The extension and backend retry boundaries are explicit: the backend normalizes a single attempt; the extension coordinates bounded adaptive attempts. A retry ledger survives worker suspension sufficiently to avoid resending completed work or multiplying extension and backend retries.

## Lifecycle behavior

### Service-worker suspension and restart

The worker rebuilds routing and privacy-safe progress from validated storage rather than process-local maps. Pending records are reconciled against tab existence, navigation identity, page-shell state, deadlines, and terminal status. Duplicate startup is idempotent. Expired records are removed. Copy permission and handoff records retain their existing single-destination guarantees.

Long-running timers are not authoritative. Persisted absolute deadlines are reconciled on wake or next event; alarms are used only if evidence shows they are necessary and without broad host permissions.

### Popup closure and reopening

Closing the popup never owns or cancels translation. Reopening queries the page shell and validated worker record, shows the latest accurate state, and never restarts an operation.

### Page reload

After a reload the page shell requests a compatible recovery record, rediscovers eligible content, validates navigation and page fingerprints, and rebinds confident matches. It restores the previous display mode only after bounded reconciliation. Cached reconstruction makes zero provider calls. Changed, unmatched, and uncertain segments remain original and are reported. New content is never translated silently; updating it requires an explicit action.

Unsafe reconstruction leaves the normal page untouched, marks the recovery stale/incompatible, and offers a deliberate new translation.

### Browser restart, tab discard, and sleep/wake

Recovery is bounded to validated, unexpired records supported by the selected storage semantics. A new browser-instance epoch or a consumed `chrome.sessions` recently-closed entry supplies restoration evidence; neither a URL nor a new tab alone is enough. A unique compatible candidate performs an idempotent `orphaned` → `claiming` → `owned` transition and rebinds only confident page fingerprints. Browser restart never triggers provider work automatically. Elapsed Retry-After and cooldown deadlines are reconciled from absolute time. Cancelled/ended work cannot resume. Tab discard/back-forward-cache behavior must be tested where managed Chromium exposes it and otherwise documented as unknown.

### Navigation

Navigation is classified conservatively as compatible same-document, same-origin new content identity, incompatible route, full navigation, or uncertain. `pushState`, `replaceState`, `popstate`, root replacement, framework route changes, redirects, and same-URL new content increment or re-evaluate the navigation generation.

Confident unchanged content may be rebound locally. New or changed content remains original until an explicit update. Incompatible mappings, observers, queues, and pending requests are cancelled or discarded. A response or mutation from an older generation cannot affect the new route.

## Hydration and mutation contract

Initial hydration, delayed content, root replacement, rerendered text nodes, virtualized lists, and lazy sections use bounded local reconciliation. Reconciliation:

- waits only within a fixed wall-clock deadline;
- uses a fixed maximum number of passes;
- limits discovered/processed nodes per pass;
- yields between slices;
- validates session and navigation generation before each application;
- never overwrites editable/protected/hidden content or active user input;
- never creates wrappers or duplicate observers;
- acknowledges readiness only after the final bounded pass.

Mutation processing batches and deduplicates roots, applies a maximum backlog, drops obsolete generations, processes a bounded node/time slice, and yields to the browser. Observer-generated mutations cannot feed an infinite application loop. Ending a session or navigating disconnects observers, clears queues/timers, and releases DOM references.

## Large-page behavior and budgets

The 2,500-segment hard safety ceiling remains unless verification supports a safer change. The UI reports eligible, processed, deferred, and remaining counts and explains the safety ceiling. Continuation is staged and explicit rather than unbounded.

Performance verification covers small, medium, 1,000, 2,206, and ceiling-sized pages plus delayed hydration, SPA navigation, and mutation storms. Budgets are derived from the recorded M1 baseline:

- no material regression in 2,206-segment switching, copy, comparison, or zero-call reuse;
- reconstruction and navigation invalidation remain responsive and bounded;
- mutation slices yield so no new unbounded long-task pattern appears;
- storage and queue sizes remain within declared caps;
- observer/listener/timer counts return to their baseline after cleanup;
- directional heap evidence is reported only where measurable and is not called leak-free proof.

## Provider and network recovery

Adaptive recovery preserves valid partial records, retries only unresolved IDs, splits retryable failing batches, isolates a bad segment, continues the remaining queue, and never resends successful translations. Character/token limits are provider-aware. Attempts, per-segment attempts, split depth, total attempts, elapsed duration, and retry history are bounded.

The normalized failure taxonomy distinguishes partial valid output, malformed or truncated JSON, missing/duplicate/unknown IDs, empty output, timeout, rate limit, temporary unavailability, authentication, quota, refusal/invalid model, backend unavailable, offline, cancellation, and retry exhaustion.

HTTP 429 honors bounded `Retry-After`. HTTP 500/502/503/504, connection refusal, backend restart, temporary offline, slow response, timeout, and invalid backend output preserve completed work and expose a deliberate retry/resume action. No immediate retry loop is permitted. Going online does not automatically duplicate an in-flight or ambiguous request. Non-retryable failures do not split. Cancellation interrupts waits and recovery promptly.

## Recovery UX

The compact popup may add only reliability states and actions:

- recovering/reconstructing session;
- recovered;
- expired;
- stale/incompatible/page changed;
- offline;
- local backend unavailable;
- provider retry and automatic split;
- retry exhausted;
- paused and resume available;
- SPA navigation detected.

Primary text is plain-language, reports exact remaining counts, preserves successful work, and avoids repeated equivalent retry buttons. Technical identity/timing metadata remains in bounded diagnostics. Original/Translated switching remains available whenever translated work exists. End session stays a separate action. Status changes use restrained live-region announcements, keyboard-operable controls, visible focus, reduced motion, 200% zoom, the compact popup, LTR/RTL, and mixed-direction isolation.

## Security, privacy, and permissions

Required API permissions are `activeTab`, `alarms`, `contextMenus`, `scripting`, `sessions`, and `storage`; no required `<all_urls>` or broad host grant is added. `alarms` supports expiry sweeps and `sessions` supplies recently-closed restoration evidence. Optional HTTP/HTTPS origins are requested only from an explicit user gesture and only for the current origin, for translated-copy injection or browser-restart recovery.

All persisted and message data is runtime validated, versioned, size/retention bounded, and bound to tab, top frame, session, navigation, generation, and operation. Corrupt, expired, revoked, cross-tab, cross-navigation, or replayed state fails closed and is cleaned. Diagnostics and logs exclude page text, full URLs/query strings, forms, credentials, raw provider bodies, and unbounded stacks.

## Cleanup contract

End session, incompatible navigation, expiry, permission denial/revocation, destination failure, comparison close, restart reconciliation, and corrupt state remove their owned observers, listeners, timers/alarms, storage entries, queues, maps, bundles, intents, handoffs, abort controllers, and popup subscriptions. A tab close instead orphans restart-enabled recovery for the bounded restore window; ordinary same-URL tabs cannot claim it, and expiry alarms remove abandoned records. Closing a translated copy or comparison does not mutate the source session. Cleanup is idempotent and scoped to the owning tab/session.

## Required automated acceptance matrix

At least 68 deterministic cases must cover:

1. Worker restart: idle, translating, provider retry, copy permission, handoff, duplicate initialization, and expiry.
2. Reload: complete, partial, stale, fingerprint mismatch, zero-call reconstruction, uncertain matches, and changed-count reporting.
3. Browser/sleep: valid recovery, expiry, cancelled non-resumption, accurate deadlines, and no duplicate request after wake.
4. SPA: compatible route reuse, incompatible invalidation, stale-response rejection, back/forward, and same-URL new identity.
5. Hydration: delayed rebind, one root-replacement reconciliation, bounds, user-input protection, and no duplicate observer/wrapper.
6. Mutations: responsiveness, deduplication, backpressure, obsolete-generation discard, and bounded repeated-run memory.
7. Provider recovery: partial preservation, splitting, unresolved-only retry, queue continuation, bad-segment isolation, honest exhaustion, non-retryable handling, Retry-After, restart-safe recovery, and no resend.
8. Network: connection refusal, offline, online recovery, timeout, 429, 503, invalid response, cancellation during outage, and no immediate loop.
9. Cleanup: end, tab close, navigation, comparison close, destination close, expiry, and permission revocation.
10. Regression: zero-call switching, comparison, scan, and translated-copy reuse; unchanged permissions; BiDi, accessibility, and security gates.

## Verification gates

Run the repository’s real scripts for formatting, lint, strict types, docs links, dependency cycles, unit/integration tests, production builds, managed Chromium E2E, performance E2E, release-candidate packaging, worker dry run where supported, and security scan. Inspect the manifest, bundles, source maps, ignored secrets, git diff, and Beads evidence.

Runtime evidence must distinguish managed Chromium from branded Chrome and synthetic lifecycle controls from physical sleep/restart. The interactive Playwright skill is used only when its environment preconditions are met; otherwise managed Playwright coverage is the recorded evidence.

## Documentation and closure

Update the roadmap, tasks, changelog, docs index, architecture/session/provider/pipeline/retention/security/threat/privacy/testing/performance/limitations/acceptance documents, ADRs, milestone verification report, Beads evidence, and concise project memory only to match verified implementation.

Push only `milestone/02-reliability-lifecycle-performance`, prepare the PR summary, do not merge, leave `main` unchanged, and do not begin Milestone 3.
