# Program status

Beads is the operational task/dependency graph; run `bd prime` and `bd ready` for actionable work. This file is a human-readable milestone/status summary, not a second issue tracker.

## Current foundation gate

- [x] Audit the real post-MVP repository and reconcile the current/historical source of truth.
- [x] Establish the product constitution, vision, architecture, roadmap, risks, retention, workflow, memory, design/accessibility/BiDi, research, competitive, positioning, and user-action documents.
- [x] Establish the Beads program/Milestone 0 structure and detailed Milestone 1 graph.
- [x] Record bounded defensive security and reproducible managed-Chromium mock performance baselines.
- [x] Complete final Milestone 0 quality gates and the authorized local commit (the commit containing `docs/milestone-0-verification-report.md` is the closure artifact).
- [x] Product owner approved the exact Milestone 1 scope and dedicated branch on 2026-07-18.

## Completed local MVP

- [x] Milestone 0: product specification, architecture, security/privacy models, ADRs, and verification plan.
- [x] Milestone 1: pnpm monorepo, WXT MV3 extension, Hono Worker, shared contracts, strict tooling, production builds, and browser loading.
- [x] Milestone 2: DOM discovery, deterministic mock translation, batching, progress, cancellation, stale-session safety, and exact restore.
- [x] Milestone 3 (credential-independent scope): validated API routes, provider isolation, DeepL adapter with mocked upstream tests, timeouts, limits, rate/quota controls, and safe errors.
- [x] Milestone 4 (MVP scope): dynamic-content observer, loop prevention, partial-failure state, bounded memory/persistent cache, and navigation identity.
- [x] Milestone 5 (MVP scope): production popup/options states, preferences, domain exclusions, privacy mode, sensitive-page behavior, cache controls, glossary, reduced motion, and accessible labels.
- [x] Milestone 6: selected-text context menu, isolated result UI, copy, and browser verification.

## Required before a public release

- [ ] Run a live DeepL smoke test only after the owner supplies a backend credential and explicitly approves the local test; the credential remains in ignored `apps/api/.dev.vars`.
- [ ] Replace development authentication and in-memory usage counters with production identity, revocation, durable quotas, and abuse controls.
- [ ] Complete medium/large fixture profiling, service-worker restart tests, SPA route fixtures, accessibility audit, and branded-Chrome manual console/network inspection.
- [ ] Review provider processing/retention terms and finalize the public privacy policy and store disclosures.
- [ ] Add store listing assets, support process, release signing, deployment configuration, and incident rollback procedure.
- [ ] Decide the public product name, API hostname, supported language matrix, and production provider contract.

## Current local release-candidate handoff

- [x] Universal backend provider registry, native/compatible adapters, safe model catalogs, provider/model settings, controlled test route, benchmark harness, and mocked contract tests.
- [x] Full static/test/build gate, clean dependency audit, managed-Chromium mock regression, secret/bundle scan, and rebuilt local release candidate.
- [x] Gemini-only local environment regression: blank optional template values, health/provider registry runtime, request-ID diagnostics, and provider-test HTTP error classification.
- [x] Exact partial/stop explanations, normalized safe failure metadata, real retry-delay progress, pending-only continuation, and multi-batch browser regression.
- [ ] Owner optionally configures and smoke-tests each desired real provider locally; no real provider has been called by automated verification.
- [ ] Owner runs `docs/user-acceptance-testing.md` against `pnpm local:test`.
- [ ] Owner approves the checklist and the exact next milestone before any deployment or publication work.

## Explicitly out of scope until authorized

- [ ] Deploy the Worker or publish the extension.
- [ ] Add accounts, payments, subscriptions, analytics, or remote translation-memory storage.
- [ ] Add Firefox, Safari, desktop, mobile, OCR, document, or screen-translation implementations.

## Next proposed milestone

Milestone 1 was merged into `main`. Post-merge acceptance defects for translated-copy acknowledgment, full-page split comparison, and explicit page-change scan results are tracked under Beads parent `translation-1mp.2.11`; translated-copy optional permission/hydration is `translation-1mp.2.12`, adaptive incomplete-provider recovery is `translation-1mp.2.13`, and one-click permission intent continuation is `translation-1mp.2.14`. Work remains confined to `fix/milestone-1-acceptance-bugs`. See `docs/milestone-1-specification.md`, ADRs 0009/0010, and the dedicated verification report. Milestone 2 has not begun.
