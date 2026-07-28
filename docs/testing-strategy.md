# Testing strategy

## Test pyramid

### Unit tests

Pure tests cover eligibility, traversal, whitespace normalization, segmentation, inline grouping, batching, deduplication, placeholder protection, cache keys, glossary rules, overflow decisions, response validation, message schemas, error normalization, exact user-facing failure explanations/actions, privacy-safe diagnostic projection, navigation identity, and privacy exclusions.

Provider contract tests additionally cover registration/configuration state, immutable request construction, model allowlists, native and compatible response normalization, malformed/fenced JSON, ID reconciliation, placeholders/glossary/prompt-injection data, authentication/rate/quota/outage errors, timeout/cancellation, retry bounds, usage normalization, discovery filtering, custom endpoint restrictions, and secret-safe errors. Every upstream boundary is mocked.

### Integration tests

Exercise popup/worker/content messaging with fake Chrome APIs; worker/API request validation; API/provider adapter boundaries; local/upstream rate classification and Retry-After propagation; cancellation; partial failure; restore; dynamic content; service-worker restart recovery; cache reuse; authentication/usage-limit errors; and invalid provider responses.

### Browser end-to-end tests

Use local deterministic fixtures, not third-party sites, for static articles, documentation/code, nested inline formatting, links, lists, tables, forms, RTL, SPA navigation, dynamic insertion, infinite scroll, large pages, unsupported pages, backend outage, provider timeout/invalid response, partial response, cancellation, pending-only continuation, restore, repeated language changes, reload, and navigation races. The implemented large fixture cancels a 1,000-section run after partial success, confirms completed text is preserved exactly once, and completes the remainder in the same session.

### Manual browser checks

Load the unpacked production build into the installed Chrome executable. Inspect page console, popup console, service-worker console, API logs, and network requests. Confirm only the application backend is contacted by the extension and no provider credential is visible.

## Test data rules

Fixtures use synthetic text. Sensitive-looking fixture labels are synthetic and never contain real credentials or personal data. Provider integration tests use a mock server or recorded schema-safe responses; real provider tests are opt-in and scrubbed.

## Failure testing

Inject malformed JSON, duplicate/missing/unknown IDs, empty/truncated/expanded output, slow provider responses, aborts, rate limits, 401/403/429/5xx, tab close, navigation, DOM replacement, storage corruption, and observer storms.

## Implemented quality commands

`pnpm verify` runs format checking, lint, strict typecheck, unit/integration tests, and production builds. `pnpm test:e2e` builds a fixture-only manifest variant and runs managed Chromium. `pnpm test:e2e:performance` runs the isolated 25/400/1,000/2,200-node deterministic baseline with a loopback-only high-rate measurement server. Secret and permission scans are documented in the milestone reports; manual branded-Chrome checks are in `docs/local-development.md`.

Managed extension E2E files run with one Playwright worker because they share one deterministic loopback API and each launches a persistent extension profile. Serializing those profiles prevents cross-test backend/timing contention from masquerading as a translation failure; it does not change production concurrency.

Set `CAPTURE_BASELINE_SCREENSHOTS=1` only when running `pnpm test:e2e` with synthetic fixtures to refresh ignored local popup, Options, and selected-result screenshots under `artifacts/milestone-0-visual-baseline`. Screenshots are evidence for visual review, not substitutes for semantic/accessibility assertions.

Set `CAPTURE_MILESTONE_1_SCREENSHOTS=1` to refresh ignored session-state evidence under `artifacts/milestone-1-visual-baseline`. Milestone 1 E2E covers five repeated full switches, cancelled-partial switching, explicit no-change/changes-found/updated scan states, scans in Original and Translated views, zero request deltas, changed-only new/modified/removed/reordered/uncertain handling, acknowledged and duplicate translated-copy handoff, redirected failure with the visible tab retained, source/copy isolation, and full-page comparison. Comparison coverage asserts the same structural snapshot, no segment cards, sanitized unsafe content, 50/50 layout, two-way linked and independent scrolling, relink, pointer/keyboard divider, reset, swap, partial fallback, light/dark themes, reduced motion, 200% zoom, narrow layout, mixed-direction identifiers, and zero source-script execution. The performance suite adds ten full cycles per size plus a 2,206-segment copy/comparison reuse run.

Milestone 2 retains the 68 named deterministic baseline cases for recovery decisions, expiry/pruning, navigation identity, mutation backpressure, request idempotency, persisted retry deadlines, network categories, and completed-ID filtering. The restart acceptance correction adds different-tab-ID reclaim, restoration-signal gating, atomic/competing claims, worker-restart idempotence, wrong origin/navigation/target, terminal/corrupt state, and privacy-safe identity tests. Managed Chromium additionally reloads a translated page, proves zero-call reconstruction, uses `chrome.sessions.restore()` to restore a compatible page into a different tab ID, checks manual same-URL non-inheritance and Original/Translated switching, replaces the root with compatible hydration, applies a 600-node mutation storm, and verifies an SPA content-identity change remains original. Physical sleep/wake, the owner branded-Chrome Tests A-E, and forced-GC evidence remain separate manual gates.
