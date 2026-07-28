# Milestone 2 verification report

- Date: 2026-07-28
- Branch: `milestone/02-reliability-lifecycle-performance`
- Starting commit: `d7b28468744e3c7111d3d8a33e524c554b511c31`
- Status: Browser-restart acceptance correction implemented; full automated rerun and owner branded-Chrome retest remain explicit below.
- Beads epic: `translation-1mp.3`

## Scope delivered

Milestone 2 adds:

- a versioned, runtime-validated, 30-minute active-session recovery record capped at 2,500 segments and 2 MiB;
- session-keyed recovery with exact-tab reload ownership plus browser-epoch/recently-closed restoration evidence and atomic restored-tab claims;
- normalized-origin, navigation, translation, page-fingerprint, target-language, frame, generation, expiry, and unique-candidate validation;
- fail-closed expiry, corruption, privacy-mode, clear-data, navigation, explicit-end, permission-revocation, and ambiguous same-URL cleanup;
- zero-provider-call page reload reconstruction with confident fingerprint/structure/role rebinding and changed/uncertain original fallback;
- operation, batch, attempt, navigation-generation, and segment identity plus duplicate living-attempt promise reuse;
- conservative SPA route invalidation and obsolete response/mutation rejection;
- compatible root-replacement/hydration rebinding;
- a generation-aware mutation backlog capped at 256 roots, 48 roots or 8 ms per slice, with yielding and deduplication;
- distinct offline/backend-unavailable recovery state and preserved adaptive partial-response/retry behavior;
- compact, semantic recovery UX and safety-ceiling/deferred counts;
- ADRs 0011–0015 and updated architecture, retention, privacy, security, threat, testing, performance, accessibility, BiDi, limitations, roadmap, tasks, and memory documents.

The record does not contain raw source text, exact originals, full URLs, page titles, HTML, form values, hidden/protected text, cookies, credentials, or provider bodies. Privacy mode removes and disables it. No account, sync, billing, deployment, publication, desktop/mobile, Vision/audio/meetings, Studio, live-provider, or Milestone 3 work was added.

## Acceptance matrix

The original test `apps/extension/src/session-recovery.test.ts` contained 68 named deterministic M2 cases. The browser-restart correction retains those cases and adds restored-tab identity, atomic-claim, ambiguity, corruption, and worker-restart cases; the final rerun count is recorded below.

| Group                                                           | Cases | Result |
| --------------------------------------------------------------- | ----: | ------ |
| Worker/reload/browser recovery decisions                        |  1–10 | PASS   |
| Navigation identity and same-document fragments                 | 11–15 | PASS   |
| Expiry, terminal cleanup, pruning, and bounded retention        | 16–23 | PASS   |
| Mutation deduplication, backpressure, slices, and generations   | 24–35 | PASS   |
| Request/response idempotency, cancellation, and stale attempts  | 36–47 | PASS   |
| Persisted Retry-After deadlines and wake reconciliation         | 48–55 | PASS   |
| Offline/backend/timeout/429/5xx/invalid-response classification | 56–64 | PASS   |
| Completed-ID filtering and zero resend                          | 65–68 | PASS   |

Added correction coverage includes a new numeric tab ID, compatible reclaim, zero-provider-call reconstruction, Original/Translated switching, manual same-URL non-inheritance, unique-candidate enforcement, concurrent and restart-idempotent claims, wrong origin/navigation/target, fingerprint mismatch, changed/uncertain fallback, terminal/expired/corrupt rejection, explicit-end cleanup, reload regression, and recently-closed restoration.

## Historical branded-Chrome acceptance failure

The owner tested the production build at baseline `fa2135b` in branded Chrome: a Gemini-translated page was left active, Chrome was closed, and Ctrl+Shift+T restored the tab within 30 minutes. The restored page remained original, no recovery status appeared, and cached translations were not applied. This result is **FAIL** and remains historical evidence.

Root cause was confirmed in code and Chrome lifecycle documentation:

1. recovery storage was keyed by the old numeric tab ID and required that exact ID;
2. `tabs.onRemoved` deleted the record during shutdown/tab close;
3. recovery ran only after popup progress polling;
4. closing the tab ended `activeTab`, so the new restored tab lacked injection authority;
5. no persisted browser epoch, restored-tab signal, or atomic claim transition existed.

The corrected managed-Chromium recently-closed test restores the fixture to a different tab ID, reapplies cached text, switches Original/Translated, and observes a zero `/v1/translate` call delta. This is automated evidence, not a replacement for the required owner branded-Chrome Tests A-E.

Existing adaptive-recovery tests additionally cover valid partial output, malformed/truncated output, missing/duplicate/unknown/empty IDs, splitting, stubborn-segment isolation, bounded exhaustion, rate limits, timeout, authentication, quota, cancellation, and safe diagnostics.

## Verification evidence

| Area                                                      | Status  | Evidence                                                                                                                                                     |
| --------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatting                                                | PASS    | Prettier full-repository check                                                                                                                               |
| ESLint                                                    | PASS    | `pnpm lint` through `pnpm verify`                                                                                                                            |
| Strict TypeScript                                         | PASS    | all packages, API, and extension                                                                                                                             |
| Markdown links                                            | PASS    | 84 files validated                                                                                                                                           |
| Dependency cycles                                         | PASS    | no cycles across 9 workspace packages                                                                                                                        |
| Unit tests                                                | PASS    | 13 files, 253 tests, retaining the 68 M2 baseline and adding restored-tab/claim/revocation cases                                                             |
| API integration                                           | PASS    | 21 tests                                                                                                                                                     |
| Production extension build                                | PASS    | Chrome MV3, 670.66 kB                                                                                                                                        |
| Worker dry run                                            | PASS    | Wrangler dry run, 741.82 KiB upload / 119.68 KiB gzip                                                                                                        |
| Managed Chromium E2E                                      | PASS    | 7 serialized tests; existing shell/copy/provider coverage plus reload and different-tab-ID restoration                                                       |
| Page reload reconstruction                                | PASS    | translated page reload restored cached text; zero provider-call delta                                                                                        |
| Delayed/root hydration                                    | PASS    | compatible original DOM replacement rebound translated text                                                                                                  |
| Mutation storm                                            | PASS    | 600 deterministic nodes remained responsive; no duplicate provider work                                                                                      |
| SPA navigation                                            | PASS    | new route stayed original; stale state surfaced; zero old-result calls                                                                                       |
| Adaptive provider recovery                                | PASS    | deterministic partial recovery and provider-outage E2E                                                                                                       |
| Performance E2E                                           | PASS    | 1 deterministic browser performance test                                                                                                                     |
| Security/secret scan                                      | PASS    | source plus 2 extension roots; zero configured secret values printed                                                                                         |
| Release candidate                                         | PASS    | extension/backend/version/checksum artifacts created                                                                                                         |
| Manifest inspection                                       | PASS    | required APIs add only `alarms`/`sessions`; optional HTTP/HTTPS remains; no required `<all_urls>`                                                            |
| Bundle inspection                                         | PASS    | 14 extension files, 670.66 kB; defensive scan passed                                                                                                         |
| Source-map inspection                                     | PASS    | no extension source maps; backend Worker map only and included in defensive scan                                                                             |
| `.dev.vars` handling                                      | PASS    | ignored by `.gitignore`, untracked                                                                                                                           |
| Beads lint                                                | PASS    | 32 issues checked, no template warnings                                                                                                                      |
| Beads doctor                                              | BLOCKED | embedded mode does not support `bd doctor`; `bd status` succeeded                                                                                            |
| Production dependency audit                               | FAIL    | 3 high advisories in WXT/web-ext/ESLint development toolchain: `adm-zip`, `shell-quote`, `brace-expansion`; no dependency change was authorized              |
| Branded Chrome                                            | FAIL    | owner restart/Ctrl+Shift+T test failed at `fa2135b`; corrected build awaits owner Tests A-E                                                                  |
| Interactive Playwright skill                              | BLOCKED | current Codex sandbox does not meet the skill’s required danger-full-access precondition; managed Playwright CLI used                                        |
| Physical browser restart/laptop sleep/tab discard/BFCache | NOT RUN | not exposed reliably by the managed harness                                                                                                                  |
| Service-worker forced termination                         | BLOCKED | `chrome.runtime.reload()` did not expose a replacement worker event to Playwright and the bounded attempt timed out; logic remains covered deterministically |
| Forced-GC leak proof                                      | BLOCKED | no forced-GC facility; directional heap only                                                                                                                 |
| Formal screen-reader/contrast/high-contrast/400% zoom     | NOT RUN | manual release evidence                                                                                                                                      |
| Live providers                                            | NOT RUN | explicitly excluded; deterministic mock providers only                                                                                                       |

## Managed Chromium runtime result

The lifecycle fixture:

1. translated the page using the deterministic mock;
2. waited for the completed recovery record;
3. reloaded the source page;
4. reconstructed the session and reapplied confident cached translations;
5. observed no additional `/v1/translate` request;
6. replaced the root with compatible original markup and rebound translated values;
7. applied a 600-node mutation burst within the 5-second responsiveness assertion;
8. changed the SPA route/content identity and confirmed new-route text remained original;
9. observed no page, popup, or worker console errors.

The restored-tab fixture additionally:

1. translated with the deterministic mock and recorded the provider-call count;
2. proved a normal second same-URL tab stayed original;
3. closed the owner, observed an orphaned record, and restored it through `chrome.sessions.restore()`;
4. observed a different numeric tab ID;
5. atomically transferred ownership and reapplied cached translations;
6. switched Original and Translated in the new tab;
7. observed zero additional `/v1/translate` requests and no runtime errors.

## Verification retries and failures

- The first focused restored-tab runs failed while the implementation still deleted/failed to signal the record; diagnostic metadata identified missing host-authority handling and an in-memory recently-closed race. The final focused lifecycle suite passed 2/2.
- Two initial full E2E attempts failed intermittently while multiple persistent extension profiles shared one loopback Worker and 5-second cold-start assertions. The harness now serializes extension profiles and uses a bounded 10-second assertion window. The final repository command passed 7/7; each earlier failed case also passed in isolation.
- The first two performance commands were BLOCKED because an orphaned test-only M2 `workerd` process retained port 8787 after E2E. The confirmed M2 process was stopped; the unchanged performance command then passed.

Screenshots:

- `artifacts/milestone-2-visual-baseline/session-recovered.png`
- `artifacts/milestone-2-visual-baseline/hydration-rebound.png`
- `artifacts/milestone-2-visual-baseline/spa-navigation-stale.png`

These are ignored local evidence, not committed product assets.

## Performance comparison

| Fixture        | Pre-M2 completion | Post-M2 completion | Post long tasks |
| -------------- | ----------------: | -----------------: | --------------: |
| 31 segments    |             85 ms |              59 ms |               0 |
| 406 segments   |            188 ms |             185 ms |               0 |
| 1,006 segments |            194 ms |             190 ms |               0 |
| 2,206 segments |            445 ms |             492 ms |               0 |

The corrected run measured dynamic translation at 188 ms. The 2,205-segment copy match/application measured 2,129 ms, comparison load 486 ms, and cached copy/comparison provider calls remained zero. The 2,206-segment completion increased 47 ms (10.6%) versus the previous M2 run while retaining zero long tasks; this is recorded as a small regression rather than hidden. Heap values are directional without forced collection and are not proof of a leak-free runtime.

## Security and privacy result

- Required permissions are `activeTab`, `alarms`, `contextMenus`, `scripting`, `sessions`, and `storage`; the two additions expose cleanup/session metadata APIs, not page-content access.
- Required host permission remains the loopback development API only.
- Optional HTTP/HTTPS patterns remain explicit-current-origin capabilities for translated copy and restart recovery; no automatic all-site grant exists.
- Recovery storage is top-frame/session/origin/navigation/translation bound, versioned, bounded, pruned, and disabled in privacy mode; restored-tab ownership requires a unique atomic claim.
- Provider output remains text-only.
- No raw source text, page HTML/title/full URL/form data, credential, provider payload, or secret was added to recovery diagnostics/storage.
- No credentials were found in source or release artifacts by the repository security scan.

## Known limitations and owner actions

1. Run branded-Chrome Tests A-E from `docs/user-acceptance-checklist.md` against the corrected unpacked production build. Do not change the historical FAIL until the owner supplies the requested evidence.
2. Perform physical sleep/wake, tab discard/restore, and BFCache checks before claiming those owner-machine behaviors.
3. Review the three development-toolchain advisories separately; do not mix dependency upgrades into M2 without approval.
4. Review recovery retention and the residual sensitivity of translated values before merge.
5. Do not begin Milestone 3 until this milestone is reviewed and accepted.

## Closure state

Automated implementation and repository verification are complete. The branch may be pushed and a draft pull request prepared, but it must not be merged automatically. The Beads epic remains open until the owner/manual evidence above is accepted or explicitly waived.
