# V2 performance and lifecycle baseline

Measured 2026-07-18 with `pnpm test:e2e:performance`: managed headless Playwright Chromium, synthetic loopback fixture/API, deterministic mock provider, 1 ms configured mock delay, rate limit raised only for the isolated measurement server, cold page per size, and distinct target language per size to avoid cross-fixture cache hits. Host hardware and browser scheduling affect absolute values; these are a reproducible development baseline, not production-provider or end-user claims.

## Measured results

| Fixture    | Added / eligible nodes | API batches | First visible | Completion | Show original | Show translated | 10 full switch cycles | Calls while switching | Long tasks |
| ---------- | ---------------------- | ----------- | ------------- | ---------- | ------------- | --------------- | --------------------- | --------------------- | ---------- |
| Very small | 25 / 31                | 1           | 52 ms         | 59 ms      | 8 ms          | 8 ms            | 80 ms                 | 0                     | 0          |
| Medium     | 400 / 406              | 9           | 63 ms         | 187 ms     | 10 ms         | 11 ms           | 93 ms                 | 0                     | 0          |
| Large      | 1,000 / 1,006          | 21          | 78 ms         | 189 ms     | 19 ms         | 16 ms           | 139 ms                | 0                     | 0          |
| Very large | 2,200 / 2,206          | 45          | 106 ms        | 483 ms     | 40 ms         | 34 ms           | 254 ms                | 0                     | 0          |

Dynamic insertion after a completed session translated in 844 ms, consistent with the observer debounce plus one local request. A separate 2,206-segment same-navigation copy confidently applied 2,205 translations in 212 ms, held one ambiguous match original, and made zero provider calls; its comparison page became visible in 623 ms with zero provider calls. The mixed Persian/English RTL paragraph translated in every size, and the form value remained unchanged.

Directional Chromium heap snapshots before translation / after translation / after the final original view were 5.4/9.1/10.1 MB (very small), 2.2/6.6/6.6 MB (medium), 3.2/8.0/6.2 MB (large), and 3.5/8.0/7.8 MB (very large). No forced collection was available, so these directional snapshots are a remaining leak-profile risk, not proof of collection or a leak.

## Interpretation

- First-visible translation and both view directions remain within the accepted local mock baseline. Ten very-large full cycles average about 12.7 ms per individual direction change and do not progressively slow down in this run.
- Serial 50-segment/10,000-character batching still produced 45 requests for 2,206 segments. Viewport-first/adaptive batching is deferred; it is not required for the completed Milestone 1 reuse contract.
- Copy and comparison reuse made zero provider calls. One ambiguous copied segment remained original, demonstrating the fail-safe matching rule rather than blind application.
- No PerformanceObserver long-task entry was recorded. This does not prove absence across hardware, visible branded Chrome, mutation storms, or real sites.
- Heap values are directional snapshots, not leak evidence: no forced collection or process isolation was applied, and very-large heap remained elevated immediately after restore. A repeated-run/forced-GC/manual memory profile is required.
- Completion values include test polling/scheduling and the mock delay; they are not a provider latency benchmark.

## Reproducibility

`playwright.performance.config.ts` starts only loopback fixture and API servers. `tests/performance/browser-baseline.spec.ts` emits a `LINGO_PERFORMANCE_BASELINE` JSON line containing raw metrics. It verifies completion, both switch directions, ten repeated cycles, zero switch calls, copy matching/application, comparison load, form exclusion, RTL/mixed content, dynamic updates, request count, optional long tasks, and Chromium heap indicators.

## Inferred from code, not separately measured

- DOM discovery and DOM writes occur synchronously inside the page shell; current instrumentation cannot separate them from first-visible/total time.
- Queue delay is the serial time before each batch; there is no independent queue scheduler.
- Repeated target/content pairs may use the service-worker memory/optional local cache, but a controlled cold/warm hit ratio was not measured.
- Page-owned sessions survive popup closure/reopen while the content script remains alive; full service-worker/browser restart persistence is intentionally unsupported.

## Not yet testable or not run in this milestone

| Scenario                                                                   | Status / required environment                                                                |
| -------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Wikipedia-like, infinite-scroll storm, and separate forms-only fixtures    | Not yet implemented; add synthetic M1 fixtures                                               |
| Service-worker termination/restart, browser sleep/wake, popup close/reopen | Requires managed lifecycle harness plus branded-Chrome confirmation                          |
| Backend disconnect/reconnect and restart during an active job              | Requires isolated failure server and durable-session design                                  |
| Local 429, upstream-like 429, timeout, retry, duplicate request count      | Behavior tests exist in parts; no performance timing baseline                                |
| Main-thread trace and memory leak/cleanup profile                          | Requires trace/manual DevTools or repeatable CDP instrumentation                             |
| Dark/light/zoom/accessibility visual timing                                | Dark/narrow managed screenshots exist; zoom, screen reader, and branded Chrome remain manual |
| Real provider latency/cost/quality                                         | Requires explicit owner approval, backend-only key, synthetic text, and cost/terms review    |
| Branded Chrome and physical-device performance                             | Requires product-owner environment/manual evidence                                           |

## Remaining dedicated performance work

Cold/warm cache repetitions, p50/p95 across hosts, isolated discovery/write/queue timing, viewport milestones, SPA/infinite mutation CPU, GC-aware leak profiling, disconnect/429/timeout timing, and branded-Chrome traces remain follow-up work rather than Milestone 1 completion claims.
