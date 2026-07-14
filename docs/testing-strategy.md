# Testing strategy

## Test pyramid

### Unit tests

Pure tests cover eligibility, traversal, whitespace normalization, segmentation, inline grouping, batching, deduplication, placeholder protection, cache keys, glossary rules, overflow decisions, response validation, message schemas, error normalization, navigation identity, and privacy exclusions.

### Integration tests

Exercise popup/worker/content messaging with fake Chrome APIs; worker/API request validation; API/provider adapter boundaries; cancellation; partial failure; restore; dynamic content; service-worker restart recovery; cache reuse; authentication/usage-limit errors; and invalid provider responses.

### Browser end-to-end tests

Use local deterministic fixtures, not third-party sites, for static articles, documentation/code, nested inline formatting, links, lists, tables, forms, RTL, SPA navigation, dynamic insertion, infinite scroll, large pages, unsupported pages, backend outage, provider timeout/invalid response, partial response, cancellation, restore, repeated language changes, reload, and navigation races.

### Manual browser checks

Load the unpacked production build into the installed Chrome executable. Inspect page console, popup console, service-worker console, API logs, and network requests. Confirm only the application backend is contacted by the extension and no provider credential is visible.

## Test data rules

Fixtures use synthetic text. Sensitive-looking fixture labels are synthetic and never contain real credentials or personal data. Provider integration tests use a mock server or recorded schema-safe responses; real provider tests are opt-in and scrubbed.

## Failure testing

Inject malformed JSON, duplicate/missing/unknown IDs, empty/truncated/expanded output, slow provider responses, aborts, rate limits, 401/403/429/5xx, tab close, navigation, DOM replacement, storage corruption, and observer storms.

## Required quality commands after implementation

The exact scripts are established in Milestone 1, but every milestone must provide formatter, lint, strict typecheck, unit/integration tests, E2E tests, production build, secret scan, and runtime/browser verification evidence.
