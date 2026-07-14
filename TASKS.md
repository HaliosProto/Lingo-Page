# Tasks

## Completed local MVP

- [x] Milestone 0: product specification, architecture, security/privacy models, ADRs, and verification plan.
- [x] Milestone 1: pnpm monorepo, WXT MV3 extension, Hono Worker, shared contracts, strict tooling, production builds, and browser loading.
- [x] Milestone 2: DOM discovery, deterministic mock translation, batching, progress, cancellation, stale-session safety, and exact restore.
- [x] Milestone 3 (credential-independent scope): validated API routes, provider isolation, DeepL adapter with mocked upstream tests, timeouts, limits, rate/quota controls, and safe errors.
- [x] Milestone 4 (MVP scope): dynamic-content observer, loop prevention, partial-failure state, bounded memory/persistent cache, and navigation identity.
- [x] Milestone 5 (MVP scope): production popup/options states, preferences, domain exclusions, privacy mode, sensitive-page behavior, cache controls, glossary, reduced motion, and accessible labels.
- [x] Milestone 6: selected-text context menu, isolated result UI, copy, and browser verification.

## Required before a public release

- [ ] Run a live DeepL smoke test only after the owner supplies a backend credential and local development auth token.
- [ ] Replace development authentication and in-memory usage counters with production identity, revocation, durable quotas, and abuse controls.
- [ ] Complete medium/large fixture profiling, service-worker restart tests, SPA route fixtures, accessibility audit, and branded-Chrome manual console/network inspection.
- [ ] Review provider processing/retention terms and finalize the public privacy policy and store disclosures.
- [ ] Add store listing assets, support process, release signing, deployment configuration, and incident rollback procedure.
- [ ] Decide the public product name, API hostname, supported language matrix, and production provider contract.

## Explicitly out of scope until authorized

- [ ] Deploy the Worker or publish the extension.
- [ ] Add accounts, payments, subscriptions, analytics, or remote translation-memory storage.
- [ ] Add Firefox, Safari, desktop, mobile, OCR, document, or screen-translation implementations.
