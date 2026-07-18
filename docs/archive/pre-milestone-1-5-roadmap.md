# Historical milestone plan and current program link

Status as of 2026-07-15: Milestones 0-2 and the credential-independent local-MVP scope of Milestones 3-6 are implemented. Live-provider verification, production identity/quotas, public-release hardening, and expansion remain open.

These entries preserve implementation history. The post-MVP program established on 2026-07-18 is authoritative in `ROADMAP.md`; its Milestone 0 is the completed foundation/audit gate and its Milestone 1 is the implemented durable-session foundation, not the historical monorepo shell below.

## Milestone 0 — Discovery, specification, architecture

Deliver the living documents, evaluations, contracts, risk models, roadmap, acceptance criteria, and verification matrix. Complete.

## Milestone 1 — Monorepo and extension shell

Create the pnpm monorepo, WXT extension, Worker API shell, shared packages, manifest, popup/options shell, service worker, content-script registration, runtime-validated messaging, environment validation, scripts, tests, builds, and unpacked loading. No real provider key and no full DOM translation.

Status: complete.

## Milestone 2 — Deterministic local translation prototype

Implement DOM discovery, eligibility, segmentation, IDs, inline mapping, batching, visible mock provider transformation, in-place text replacement, originals, restore, progress, cancellation, tab/navigation state, fixtures, and browser tests. No real provider.

Status: complete.

## Milestone 3 — Secure backend and real provider

Implement validated translation/detection routes, development auth, server-side secret, first provider adapter, limits, rate limiting, timeout/retry, usage/cost guardrails, secret scans, and end-to-end real translation.

Status: implementation complete except live credential smoke test and production identity. Mock mode is the supported local extension path.

## Milestone 4 — Dynamic pages and resilience

Add mutation observer, SPA route handling, dynamic content, loop prevention, caches, partial failure, retries, large-page processing, performance measurements, restart recovery, and leak testing.

Status: local MVP subset complete (dynamic insertion, loop prevention, cache, partial states, navigation identity); large-page profiling, durable restart recovery, and leak testing remain release work.

## Milestone 5 — Production UI and settings

Polish design system, themes, preferences, exclusions, privacy mode, sensitive warnings, cache controls, glossary UI, accessibility, RTL, reduced motion, and complete state coverage.

Status: local MVP UI complete; formal accessibility/RTL certification remains release work.

## Milestone 6 — Selected text

Add explicit selected-text translation, result/copy/replace flow, keyboard accessibility, and browser tests.

Status: translate/result/copy and browser test complete; replacing the original selection is intentionally not enabled because it is a higher-risk page mutation.

## Milestone 7 — Accounts, quotas, abuse protection

Add production identity/session system, revocation, usage records, free allowance, quotas, abuse controls, usage display, and account deletion architecture. Do not add payments without instruction.

## Milestone 8 — Security, privacy, and store readiness

Audit permissions/bundles/secrets, complete security/privacy tests, retention docs, privacy policy draft, store listing/assets/troubleshooting, and final regression. Do not publish without explicit authorization.

## Milestone 9 — Expansion architecture

Detailed designs only for Firefox, Safari, desktop, mobile, composer, screen, documents, OCR, local models, billing, team glossaries, and enterprise controls.

## Current program crosswalk

- Historical local MVP and release-candidate gaps -> current M0 baseline plus M1 durable browser foundation.
- Historical M7 production identity -> current M7 after browser durability is accepted.
- Historical M8 store readiness -> current M8, still without deployment/publication authority.
- Historical M9 expansion -> current M9-M12 staged cross-browser, media, Studio, and Platform work.
