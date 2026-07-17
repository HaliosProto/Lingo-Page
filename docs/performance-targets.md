# Performance targets

The initial targets below are retained. The first reproducible post-MVP measurements and their limitations are in `docs/v2-performance-baseline.md`; Milestone 1 must recalibrate targets with repeated traces and lifecycle evidence.

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
