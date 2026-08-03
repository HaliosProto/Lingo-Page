# Performance targets

The initial targets below are retained. The first reproducible post-MVP measurements and their limitations are archived in `docs/archive/v2-performance-baseline.md`; Milestone 1 added repeated reuse evidence, while Milestone 2 owns further profiling and target recalibration.

These are initial product targets for local representative fixtures; measure and revise after Milestone 2 profiling.

| Metric                           | Target                                                                                                     |
| -------------------------------- | ---------------------------------------------------------------------------------------------------------- |
| Popup cold startup               | ≤ 250 ms to interactive on a typical desktop.                                                              |
| First eligible-segment discovery | ≤ 200 ms for a medium fixture.                                                                             |
| First translated visible content | ≤ 1.5 s with mock provider; network target is measured separately.                                         |
| Medium article completion        | ≤ 3 s with mock provider and ≤ 500 eligible segments.                                                      |
| Large-page behavior              | Never block the main thread for > 50 ms; process within a bounded budget and report partial/lazy progress. |
| Restore original                 | ≤ 250 ms for a medium fixture after user action.                                                           |
| Mutation cycle                   | ≤ 20 ms CPU budget per debounce window; coalesce storms.                                                   |
| Memory                           | No unbounded growth; session memory budget and cleanup test defined during Milestone 2.                    |
| API request                      | Enforce client timeout around 20 s; provider timeout is shorter and configurable.                          |
| Concurrency                      | Start conservatively at 2–4 translation batches; benchmark before raising.                                 |

## Fixture sizes

- Small: 10–30 eligible nodes, inline formatting, controls, code, and exclusions.
- Medium: 300–500 eligible nodes, repeated strings, tables/lists, nested links, and dynamic updates.
- Large: 2,000+ nodes, long text, below-fold content, mutation bursts, and virtualized/infinite-scroll simulation.

## Measurement rules

Use browser Performance APIs and Playwright traces for page work, API timing for backend calls, and Chrome task/memory inspection during manual runs. Report p50/p95 where repeated measurements are meaningful. Do not optimize by weakening eligibility or safety limits.

## Milestone 3 budgets

- Policy validation and fingerprinting, prompt compilation, glossary filtering, context extraction, and deterministic checks must remain bounded and must not create a new long task on 1,000/2,206/2,500-segment fixtures.
- Per provider request, heading paths are at most 8 entries, nearby context at most 3+3 records, relevant glossary at most 200 entries, terminology memory at most 200 entries, privileged instructions at most 16,000 characters, and serialized untrusted prompt data at most 192,000 characters.
- Clean translation remains one provider call per batch and zero review calls. Suspicious or explicit review is at most one additional call for no more than 50 selected IDs and never resends unrelated completed segments.
- Measurements record policy validation/fingerprint, compiler, glossary, context, deterministic-check duration, request/response bytes, cache/storage size, translation/review calls, and clean/suspicious latency for small, medium, 1,000, 2,206, and 2,500 segments plus large glossary, repeated terminology, injection, and mixed-direction fixtures.

## Milestone 2 measured result

Managed Chromium after M2 completed 2,206 segments in 445 ms, matching the frozen pre-change 445 ms run, with zero reported long tasks. Repeated switching remained zero-call; cached copy/comparison reuse made zero provider calls. The compatible-copy match/application measured 2,078 ms versus the 2,063 ms pre-change run. The deterministic dynamic-content measurement improved from 792 ms to 190 ms after bounded mutation scheduling. Heap values remain directional without forced GC and are not leak-proof evidence.

Mutation work is capped at 256 queued roots, 48 roots per slice, and an 8 ms slice budget. Recovery records are capped at 2,500 segments, 2 MiB, 12 recent records, and a 30-minute lifetime.

## Milestone 3 measured result

The final managed-Chromium M3 run used deterministic mock responses and recorded:

| Eligible segments | Completion | Translation calls | Review calls | Longest observed task |
| ----------------: | ---------: | ----------------: | -----------: | --------------------: |
|                31 |     255 ms |                 1 |            0 |                 80 ms |
|               406 |     316 ms |                 9 |            0 |                 76 ms |
|             1,006 |     629 ms |                21 |            0 |                 73 ms |
|             2,206 |   1,249 ms |                45 |            0 |                 82 ms |
|             2,500 |   1,350 ms |                50 |            0 |                108 ms |

The 2,206-segment result is 757 ms slower than the final recorded M2 run (1,249 ms versus 492 ms). The increase reflects the versioned structured request, policy/context propagation, cache identity, response validation, and per-segment deterministic checks; it is a documented performance regression, not an unqualified pass against the aspirational 50 ms long-task target. Context extraction was changed from a per-segment heading query to one document-order pass after an initial 2,475 ms / 1,343 ms-long-task measurement. Dynamic translation remained 128 ms; 2,205-segment translated-copy reuse took 3,219 ms; comparison load took 1,485 ms; both reuse paths made zero provider calls. Heap readings remain directional without forced collection.

Focused Node measurements recorded 1,000 policy validations in 30.07 ms, 1,000 policy fingerprints in 35.95 ms, a 500-entry glossary filter for 50 segments in 1.50 ms, 50 deterministic checks in 4.27 ms, and a 50-segment/200-term prompt compile in 3.32 ms. That compiled prompt used 1,476 privileged bytes and 24,317 untrusted-data bytes; the representative structured request and response were 26,464 and 4,134 bytes. Default policy storage was 818 bytes and the 200-entry terminology memory fixture was 17,801 bytes.
