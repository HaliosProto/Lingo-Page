# Milestone 2 reliability baseline

- Recorded: 2026-07-28
- Branch: `milestone/02-reliability-lifecycle-performance`
- Starting commit: `d7b28468744e3c7111d3d8a33e524c554b511c31`
- Scope: pre-implementation behavior

## Evidence rules

`PASS` means the behavior was actually demonstrated by an existing automated or recorded runtime check. `FAIL` means current implementation or a reproduced scenario contradicts the Milestone 2 requirement. `NOT RUN` means an applicable check was not run yet. `BLOCKED` means the current environment cannot exercise it. `UNKNOWN` means inspection is insufficient and no runtime evidence exists.

Repository inspection establishes architecture and likely loss boundaries, not runtime success. Existing M1/M1.5 reports are cited only for checks they actually recorded.

## Starting architecture

- The top-frame page shell owns the authoritative normal translation session, exact originals, translated text, live DOM bindings, observer, and display/lifecycle state in memory.
- The service worker keeps normal progress and abort controllers in process-local `Map` instances.
- `chrome.storage.session` is used for temporary translated-copy intents/handoffs and comparison bundles, not for the authoritative normal active session.
- Optional translated-text cache in `chrome.storage.local` is off by default and is not an active-session reconstruction mechanism.
- Session bundles are versioned, validated, and bounded to 2,500 segments and 2 MiB, but are exported only for explicit copy/comparison flows.
- Adaptive provider recovery already preserves valid partial output, retries unresolved IDs, splits eligible failures, respects bounded attempts/duration and `Retry-After`, and exposes normalized failures.
- Page-shell mutation observation is debounced, but no explicit bounded mutation backlog, per-slice node/time budget, navigation generation, or recovery ledger exists.

## Scenario baseline

| Scenario                                        | State survival                                                                                     | Stale/duplicate risk                                                                              | User state and cleanup                                                              | Status                                                    |
| ----------------------------------------------- | -------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------- | ----------------------------------------------------------------------------------- | --------------------------------------------------------- |
| Popup close/reopen                              | Page-shell session survives; popup re-queries progress                                             | No provider call is intentionally started by reopening                                            | Existing progress UI returns while page shell and worker remain alive               | PASS (existing M1 E2E)                                    |
| Service-worker suspension/restart while idle    | Page-owned DOM/session may survive; worker maps are lost                                           | Normal progress cannot be reconstructed from validated persistence                                | No explicit recovered/expired state                                                 | FAIL (repository evidence)                                |
| Service-worker restart during translation/retry | Page shell may retain local session; controllers/progress/retry coordination are process-local     | Pending operation and retry identity are not durably coordinated                                  | Recovery accuracy and cleanup are unverified                                        | FAIL (repository evidence)                                |
| Duplicate worker initialization                 | Copy/comparison records have idempotent intent state; normal operation ledger is absent            | Normal translation duplicate-call behavior after restart is unknown                               | Expired copy/comparison cleanup exists                                              | UNKNOWN                                                   |
| Page reload after translated/partial session    | Page-owned authoritative session and bindings are destroyed                                        | No automatic provider call is specified, but reusable normal session is unavailable               | Page returns to normal state without reconstruction UX                              | FAIL (repository evidence)                                |
| Wrong fingerprint/stale reload                  | No normal recovery attempt exists                                                                  | Old translation is not rebound because state is lost                                              | No stale/incompatible explanation                                                   | FAIL (missing required behavior)                          |
| Browser restart                                 | `storage.session` persistence semantics and normal session recovery are not implemented            | Cancelled/ended work cannot resume because all normal state is lost, but valid work is also lost  | No recovered/expired state                                                          | FAIL                                                      |
| Sleep/wake and Retry-After                      | Adaptive recovery uses an in-memory wait/timer and elapsed-duration clock                          | Worker suspension can lose wait/retry coordination; duplication is unverified                     | No wake reconciliation UX                                                           | FAIL (repository evidence)                                |
| Tab discard/restore                             | No dedicated evidence                                                                              | Unknown                                                                                           | Unknown                                                                             | UNKNOWN                                                   |
| Back-forward cache                              | No dedicated evidence                                                                              | Navigation URL checks exist, but generation-safe lifecycle behavior is unverified                 | Unknown                                                                             | UNKNOWN                                                   |
| `pushState`/`replaceState`/`popstate`           | No explicit navigation-generation coordinator                                                      | Old responses/mutations may remain associated only with the old URL string check                  | No SPA navigation state                                                             | FAIL (missing required control)                           |
| Same-URL new content identity                   | Segment/page fingerprints exist for scans and copy matching                                        | No generation bump is guaranteed                                                                  | Explicit M1 page-change scan is available                                           | FAIL for automatic lifecycle classification               |
| Full navigation/redirect                        | Page shell unload generally drops state; copy flow verifies exact origins/navigation               | Old normal state is lost rather than recovered                                                    | Copy wrong-origin/revocation paths are covered                                      | FAIL for M2 recovery                                      |
| Delayed hydration/root replacement              | Translated-copy flow has one bounded hydration reconciliation pass                                 | Normal active session rebind behavior across general root replacement is incomplete               | Copy acknowledgement waits for final bounded pass                                   | PASS for translated copy; FAIL for general M2 requirement |
| Framework rerender/virtualized content          | Local scan/mutation logic can rediscover changes                                                   | No explicit bounded general rebind/backpressure contract                                          | New/changed content requires explicit update                                        | UNKNOWN                                                   |
| Infinite scroll/mutation storm                  | Debounced mutation observer exists                                                                 | Backlog, per-slice nodes/CPU, obsolete-generation dropping, and retained-memory bounds are absent | Responsiveness not measured                                                         | FAIL (missing required controls)                          |
| 1,000 and 2,206 segments                        | Recorded M1 performance fixture completed and zero-call view switching was demonstrated            | No duplicate provider calls in the recorded normal flow                                           | 2,206-segment completion was approximately 483 ms in the prior report; no forced GC | PASS for M1 baseline only                                 |
| 2,500 ceiling                                   | Bundle hard cap exists                                                                             | UI explanation/staged continuation is incomplete                                                  | Limit behavior not separately accepted                                              | UNKNOWN                                                   |
| Partial/malformed provider output               | Valid partial translations are filtered/applied; unresolved IDs split and retry                    | Completed IDs are not retried within one living coordinator                                       | Deterministic provider-recovery E2E exists                                          | PASS for in-process recovery                              |
| Retry-After/rate limit                          | Delay is honored in-process                                                                        | Persisted deadline and restart/wake safety are absent                                             | Retrying/waiting presentation exists                                                | PASS in-process; FAIL across lifecycle                    |
| Connection refused/backend outage/offline       | Normalized backend-unavailable failure preserves completed work                                    | Automatic online/restart coordination is absent                                                   | Retry/reconnect/continue actions exist; offline category is not distinct            | FAIL for M2                                               |
| Cancellation during recovery                    | Adaptive coordinator polls cancellation before work; existing cancellation/continuation is covered | Cancellation during a sleeping `Retry-After` wait is not abortable                                | Partial work can remain switchable                                                  | FAIL for M2 recovery                                      |
| Source tab close                                | Worker tab cleanup covers temporary handoffs/maps where registered                                 | Normal persisted active-session cleanup is not applicable because it does not exist               | Dedicated lifecycle evidence absent                                                 | UNKNOWN                                                   |
| Destination/comparison close                    | Existing temporary ownership and tab cleanup are implemented                                       | Source session remains independent by design                                                      | Existing M1 acceptance evidence                                                     | PASS                                                      |
| Permission revocation                           | Translated-copy exact-origin and revocation failure paths exist                                    | No broad permissions are requested                                                                | Source remains unchanged/fails safely                                               | PASS                                                      |

## Baseline verification status

| Gate                                        | Status  | Evidence                                                                                                                            |
| ------------------------------------------- | ------- | ----------------------------------------------------------------------------------------------------------------------------------- |
| Clean branch/worktree before implementation | PASS    | `git status --short --branch` showed only `milestone/02-reliability-lifecycle-performance`                                          |
| M1/M1.5 merged starting point               | PASS    | `origin/main` at `d7b28468744e3c7111d3d8a33e524c554b511c31`; squash tree is equivalent to the accepted M1.5 branch                  |
| Required permissions unchanged              | PASS    | Starting manifest uses `activeTab`, `contextMenus`, `scripting`, and `storage`; optional HTTP/HTTPS origins support translated copy |
| Existing static/unit/build verification     | PASS    | `pnpm verify`: formatting, ESLint, strict types, docs/cycles, 166 unit tests, 21 API tests, builds, and Worker dry run passed       |
| Existing managed Chromium E2E               | PASS    | `pnpm test:e2e`: 5 tests passed in managed Chromium                                                                                 |
| Existing performance E2E                    | PASS    | `pnpm test:e2e:performance`: 2,206 segments completed in 445 ms with zero long tasks and zero reuse provider calls                  |
| Branded Chrome                              | NOT RUN | No new pre-implementation branded-browser run                                                                                       |
| Physical browser restart/sleep/laptop sleep | BLOCKED | Managed automation does not reproduce physical owner-machine lifecycle evidence                                                     |
| Forced-GC/heap proof                        | BLOCKED | No forced-GC facility in current evidence                                                                                           |
| Live providers                              | NOT RUN | Explicitly outside routine M2 verification; deterministic providers only                                                            |

## Baseline gaps that define implementation

1. No versioned normal active-session recovery record or reconstruction handshake.
2. Normal progress/controllers/retry deadlines depend on a continuously alive worker.
3. Reload and browser restart discard valid sessions rather than reconstruct them.
4. No navigation generation or operation/batch/attempt idempotency contract spans the page shell and worker.
5. General hydration/root replacement reconciliation is not covered by the translated-copy-only pass.
6. Mutation handling has no explicit backlog, slice, generation, or memory bounds.
7. Large-page ceiling explanation and staged continuation are incomplete.
8. Provider recovery is strong in-process but not restart/wake durable.
9. Network/offline categories and cancellation during waits need hardening.
10. Cleanup and memory claims lack dedicated lifecycle instrumentation and repeated-run evidence.

This document is intentionally frozen as the pre-implementation baseline. Later results belong in the Milestone 2 verification report and must not rewrite these starting observations.
