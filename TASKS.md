# TASKS.md

## Current milestone

- [x] Milestone 0 — discovery, specification, and architecture.
- [ ] Milestone 1 — monorepo and extension shell.

## Milestone 0 completed artifacts

- [x] Repository and environment assessment.
- [x] `AGENTS.md` and living project documents.
- [x] Product specification.
- [x] Architecture, boundaries, API contracts, and data flow.
- [x] Security, privacy, and threat models.
- [x] Provider, extension framework, and backend evaluations.
- [x] Translation pipeline design.
- [x] Testing strategy and verification matrix.
- [x] Performance targets and browser compatibility plan.
- [x] Future platform roadmap.
- [x] Ordered milestones and acceptance criteria.
- [x] Initial task breakdown.

## Milestone 1 scope

- [ ] Create the pnpm workspace and TypeScript project references.
- [ ] Scaffold the WXT extension with popup, options, service worker, and content-script entrypoints.
- [ ] Scaffold the Cloudflare Worker API with health and language routes only.
- [ ] Add shared types, runtime schemas, configuration validation, and typed message envelopes.
- [ ] Add translation-core and provider interfaces without a real provider key.
- [ ] Add the initial UI shell and locale message catalog.
- [ ] Add formatter, linter, typecheck, unit-test, build, and unpacked-extension loading scripts.
- [ ] Keep the product feature behavior behind clear placeholders; do not silently begin Milestone 2.

## Open decisions to revisit

- [ ] Confirm product name and public API hostname.
- [ ] Benchmark DeepL against Google Cloud Translation and Azure Translator using representative fixtures before Milestone 3 provider lock.
- [ ] Choose the production identity/session provider before Milestone 7.
- [ ] Confirm supported language list and initial default target language.
- [ ] Decide whether to request `storage` at install time or defer it until settings are used.
