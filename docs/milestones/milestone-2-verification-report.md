# Milestone 2 verification report

- Date: 2026-07-28
- Branch: `milestone/02-reliability-lifecycle-performance`
- Starting commit: `d7b28468744e3c7111d3d8a33e524c554b511c31`
- Status: Automated implementation and verification complete; owner/manual evidence remains explicit below.
- Beads epic: `translation-1mp.3`

## Scope delivered

Milestone 2 adds:

- a versioned, runtime-validated, 30-minute active-session recovery record capped at 2,500 segments and 2 MiB;
- exact-tab/top-frame/SHA-256 navigation ownership and fail-closed expiry, corruption, privacy-mode, clear-data, navigation, end-session, and tab-close cleanup;
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

The test `apps/extension/src/session-recovery.test.ts` contains exactly 68 named deterministic M2 cases:

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

Existing adaptive-recovery tests additionally cover valid partial output, malformed/truncated output, missing/duplicate/unknown/empty IDs, splitting, stubborn-segment isolation, bounded exhaustion, rate limits, timeout, authentication, quota, cancellation, and safe diagnostics.

## Verification evidence

| Area                                                      | Status  | Evidence                                                                                                                                                     |
| --------------------------------------------------------- | ------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatting                                                | PASS    | Prettier full-repository check                                                                                                                               |
| ESLint                                                    | PASS    | `pnpm lint` through `pnpm verify`                                                                                                                            |
| Strict TypeScript                                         | PASS    | all packages, API, and extension                                                                                                                             |
| Markdown links                                            | PASS    | 82 files validated                                                                                                                                           |
| Dependency cycles                                         | PASS    | no cycles across 9 workspace packages                                                                                                                        |
| Unit tests                                                | PASS    | 13 files, 234 tests, including the 68 M2 cases                                                                                                               |
| API integration                                           | PASS    | 21 tests                                                                                                                                                     |
| Production extension build                                | PASS    | Chrome MV3, 633.41 kB                                                                                                                                        |
| Worker dry run                                            | PASS    | Wrangler dry run, 739.95 KiB upload / 119.33 KiB gzip                                                                                                        |
| Managed Chromium E2E                                      | PASS    | 6 tests; existing M1/copy/provider tests plus lifecycle resilience                                                                                           |
| Page reload reconstruction                                | PASS    | translated page reload restored cached text; zero provider-call delta                                                                                        |
| Delayed/root hydration                                    | PASS    | compatible original DOM replacement rebound translated text                                                                                                  |
| Mutation storm                                            | PASS    | 600 deterministic nodes remained responsive; no duplicate provider work                                                                                      |
| SPA navigation                                            | PASS    | new route stayed original; stale state surfaced; zero old-result calls                                                                                       |
| Adaptive provider recovery                                | PASS    | deterministic partial recovery and provider-outage E2E                                                                                                       |
| Performance E2E                                           | PASS    | 1 deterministic browser performance test                                                                                                                     |
| Security/secret scan                                      | PASS    | source plus 2 extension roots; zero configured secret values printed                                                                                         |
| Release candidate                                         | PASS    | extension/backend/version/checksum artifacts created                                                                                                         |
| Manifest inspection                                       | PASS    | required permissions unchanged; optional HTTP/HTTPS only; no required `<all_urls>`                                                                           |
| Bundle inspection                                         | PASS    | 14 extension files, 633,410 bytes; defensive scan passed                                                                                                     |
| Source-map inspection                                     | PASS    | no extension source maps; backend Worker map only and included in defensive scan                                                                             |
| `.dev.vars` handling                                      | PASS    | ignored by `.gitignore`, untracked                                                                                                                           |
| Beads lint                                                | PASS    | 32 issues checked, no template warnings                                                                                                                      |
| Beads doctor                                              | BLOCKED | embedded mode does not support `bd doctor`; `bd status` succeeded                                                                                            |
| Production dependency audit                               | FAIL    | 3 high advisories in WXT/web-ext/ESLint development toolchain: `adm-zip`, `shell-quote`, `brace-expansion`; no dependency change was authorized              |
| Branded Chrome                                            | NOT RUN | managed Chromium only                                                                                                                                        |
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

Screenshots:

- `artifacts/milestone-2-visual-baseline/session-recovered.png`
- `artifacts/milestone-2-visual-baseline/hydration-rebound.png`
- `artifacts/milestone-2-visual-baseline/spa-navigation-stale.png`

These are ignored local evidence, not committed product assets.

## Performance comparison

| Fixture        | Pre-M2 completion | Post-M2 completion | Post long tasks |
| -------------- | ----------------: | -----------------: | --------------: |
| 31 segments    |             85 ms |              80 ms |               0 |
| 406 segments   |            188 ms |             187 ms |               0 |
| 1,006 segments |            194 ms |             190 ms |               0 |
| 2,206 segments |            445 ms |             445 ms |               0 |

Post-M2 dynamic translation measured 190 ms versus 792 ms in the frozen pre-change run. The 2,206-segment copy match/application measured 2,078 ms versus 2,063 ms, comparison load 471 ms versus 469 ms, and cached copy/comparison provider calls remained zero. Heap values are directional without forced collection and are not proof of a leak-free runtime.

## Security and privacy result

- Required permissions remain `activeTab`, `contextMenus`, `scripting`, and `storage`.
- Required host permission remains the loopback development API only.
- Optional HTTP/HTTPS patterns remain explicit-origin translated-copy capability; no automatic all-site grant exists.
- Recovery storage is exact-tab/top-frame/navigation bound, versioned, bounded, pruned, and disabled in privacy mode.
- Provider output remains text-only.
- No raw source text, page HTML/title/full URL/form data, credential, provider payload, or secret was added to recovery diagnostics/storage.
- No credentials were found in source or release artifacts by the repository security scan.

## Known limitations and owner actions

1. Run the unpacked release candidate in branded Chrome and repeat reload, worker termination if available, offline/reconnect, 390 px, 200% zoom, reduced motion, RTL/LTR, and console/network/storage inspection.
2. Perform physical browser restart, sleep/wake, tab discard/restore, and BFCache checks before claiming those owner-machine behaviors.
3. Review the three development-toolchain advisories separately; do not mix dependency upgrades into M2 without approval.
4. Review recovery retention and the residual sensitivity of translated values before merge.
5. Do not begin Milestone 3 until this milestone is reviewed and accepted.

## Closure state

Automated implementation and repository verification are complete. The branch may be pushed and a draft pull request prepared, but it must not be merged automatically. The Beads epic remains open until the owner/manual evidence above is accepted or explicitly waived.
