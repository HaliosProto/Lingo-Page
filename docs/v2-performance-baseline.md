# V2 performance and lifecycle baseline

Measured 2026-07-18 with `pnpm test:e2e:performance`: managed headless Playwright Chromium, synthetic loopback fixture/API, deterministic mock provider, 1 ms configured mock delay, rate limit raised only for the isolated measurement server, cold page per size, and distinct target language per size to avoid cross-fixture cache hits. Host hardware and browser scheduling affect absolute values; these are a reproducible development baseline, not production-provider or end-user claims.

## Measured results

| Fixture    | Added / eligible nodes | API batches | Avg input chars/batch | First visible | Completion | Restore | Long tasks (>50 ms) | JS heap before / after / after restore |
| ---------- | ---------------------- | ----------- | --------------------- | ------------- | ---------- | ------- | ------------------- | -------------------------------------- |
| Very small | 25 / 31                | 1           | 949                   | 73 ms         | 79 ms      | 7 ms    | 0                   | 1.8 / 10.6 / 10.8 MB                   |
| Medium     | 400 / 406              | 9           | 1,430                 | 60 ms         | 190 ms     | 11 ms   | 0                   | 2.2 / 7.0 / 5.3 MB                     |
| Large      | 1,000 / 1,006          | 21          | 1,527                 | 64 ms         | 184 ms     | 19 ms   | 0                   | 3.2 / 6.4 / 6.5 MB                     |
| Very large | 2,200 / 2,206          | 45          | 1,593                 | 72 ms         | 445 ms     | 31 ms   | 0                   | 3.5 / 8.9 / 9.5 MB                     |

Dynamic insertion after a completed session translated in 834 ms, consistent with the observer debounce plus one local request. The mixed Persian/English RTL paragraph translated in every size, and the form value remained unchanged. All discovered segments completed with zero failures.

## Interpretation

- First visible translation and restore meet the existing local mock targets on this run.
- Serial 50-segment/10,000-character batching produced 45 requests for 2,206 segments. Real-provider latency therefore dominates long-page completion and makes viewport-first priority/adaptive batching high-value M1 work.
- No PerformanceObserver long-task entry was recorded. This does not prove absence across hardware, visible branded Chrome, mutation storms, or real sites.
- Heap values are directional snapshots, not leak evidence: no forced collection or process isolation was applied, and very-large heap remained elevated immediately after restore. A repeated-run/forced-GC/manual memory profile is required.
- Completion values include test polling/scheduling and the mock delay; they are not a provider latency benchmark.

## Reproducibility

`playwright.performance.config.ts` starts only loopback fixture and API servers. `tests/performance/browser-baseline.spec.ts` emits a `LINGO_PERFORMANCE_BASELINE` JSON line containing raw metrics. It verifies completion, restore, form exclusion, RTL/mixed content, dynamic updates, request count, batch input characters, optional long tasks, and Chromium heap indicators.

## Inferred from code, not separately measured

- DOM discovery and DOM writes occur synchronously inside the page shell; current instrumentation cannot separate them from first-visible/total time.
- Queue delay is the serial time before each batch; there is no independent queue scheduler.
- Repeated target/content pairs may use the service-worker memory/optional local cache, but a controlled cold/warm hit ratio was not measured.
- Popup closure should not remove the page-owned session, but presentation/reopen continuity is unverified.

## Not yet testable or not run in this milestone

| Scenario                                                                   | Status / required environment                                                             |
| -------------------------------------------------------------------------- | ----------------------------------------------------------------------------------------- |
| Wikipedia-like, infinite-scroll storm, and separate forms-only fixtures    | Not yet implemented; add synthetic M1 fixtures                                            |
| Service-worker termination/restart, browser sleep/wake, popup close/reopen | Requires managed lifecycle harness plus branded-Chrome confirmation                       |
| Backend disconnect/reconnect and restart during an active job              | Requires isolated failure server and durable-session design                               |
| Local 429, upstream-like 429, timeout, retry, duplicate request count      | Behavior tests exist in parts; no performance timing baseline                             |
| Main-thread trace and memory leak/cleanup profile                          | Requires trace/manual DevTools or repeatable CDP instrumentation                          |
| Dark/light/zoom/accessibility visual timing                                | Interactive visual inspection unavailable this session                                    |
| Real provider latency/cost/quality                                         | Requires explicit owner approval, backend-only key, synthetic text, and cost/terms review |
| Branded Chrome and physical-device performance                             | Requires product-owner environment/manual evidence                                        |

## Milestone 1 measurement gate

Add cold/warm cache runs; p50/p95 repetitions; isolated discovery/write/queue timings; viewport milestones (25/50%); SPA/infinite mutation counts and CPU; repeated restore/navigation cleanup with GC-aware heap trends; lifecycle and disconnect recovery; 429/timeout timing; branded-Chrome trace; and thresholds calibrated without weakening safety limits.
