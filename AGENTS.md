# Repository contribution instructions

## Purpose and authority

These durable instructions apply throughout the repository. A nested `AGENTS.md` may narrow them for its subtree. Direct task instructions take precedence.

Lingo Page is a privacy-first webpage translation platform. The current product is a Chrome Manifest V3 extension that translates eligible visible text through the application backend while preserving the host page's DOM, styling, links, controls, images, formatting, and behavior.

## Current scope

- The deterministic mock provider is the verified default. Real-provider protocol boundaries have mocked tests; no live call is current workspace evidence.
- Work on exactly one approved milestone or requested task. Do not silently expand into accounts, billing, deployment, publication, desktop, mobile, Vision, meetings, Studio, or other future scope.
- `PRODUCT_CONSTITUTION.md`, `PRODUCT_VISION.md`, and `ROADMAP.md` define product authority. `TASKS.md`, Beads, approved milestone specifications, `docs/known-limitations.md`, and the latest verification reports define current execution status.
- M2 implementation must not begin until M1.5 is accepted. Desktop/mobile implementation must not begin until the M8 extension General Availability gate is accepted.

## Working method

### Inspect and specify before editing

- Start with `git status --short`; preserve all existing work and unrelated changes.
- Read the relevant source, tests, specifications, package manifests, configuration, and current evidence.
- Use `rg` or `rg --files` to locate behavior, callers, and path references.
- Follow `docs/spec-driven-workflow.md`: discover, specify, design, plan, accept, implement, verify, record, and stop for review.
- For non-trivial work, define the system/user goal and observable acceptance criteria in Beads before implementation.
- Ask only when a choice materially changes architecture, security, privacy, cost, data handling/loss, permissions, external systems, milestone scope, or product experience. Make and state small reversible assumptions.
- Never print or paste secrets while inspecting configuration, logs, history, or bundles.

### Keep changes surgical

- Prefer the smallest complete solution that follows existing architecture and conventions.
- Reuse shared types, Zod schemas, settings, tokens, helpers, scripts, and tests.
- Do not add speculative dependencies, placeholders, weakened validation, skipped checks, broad permissions, unrelated refactors/upgrades/renames, formatting sweeps, or generated churn.
- Trace callers before deleting, moving, or rewriting material. Update every path reference and preserve historical evidence.
- Do not modify external services, remotes, provider accounts, deployment state, publication state, or public resources without exact authorization.

## Technology and package boundaries

- Workspace: pnpm 11.7.x monorepo; Node.js 24.14 or newer.
- TypeScript 5.9 strict ESM; Zod 4 runtime validation.
- Extension: WXT 0.20, React 19, Chrome Manifest V3.
- Backend: Cloudflare Workers, Hono 4, Wrangler 4.
- Tests: Vitest 4 and Playwright 1.61 managed Chromium.
- Formatting/lint: Prettier 3 and ESLint 10.

Use versions pinned in `package.json` and `pnpm-lock.yaml`. Do not substitute package managers or upgrade dependencies without an explicit task.

Repository boundaries:

- `apps/extension/`: browser UI, activation, DOM discovery/mutation, session orchestration; never provider credentials or arbitrary endpoints.
- `apps/api/`: authentication policy, quotas/limits, provider selection, credentials, upstream calls, and privacy-safe operational errors/logging.
- `packages/shared-types/`: cross-boundary domain types and discriminated unions.
- `packages/shared-validation/`: runtime schemas and safe parsing at every trust boundary.
- `packages/shared-config/`: defaults, environment validation, and feature policy.
- `packages/translation-core/`: DOM/provider/UI-independent translation logic; no Chrome, React, provider SDK, or backend runtime imports.
- `packages/translation-providers/`: provider payloads, fixed instructions, endpoints, credentials, retries, parsing, and registry; no DOM/UI behavior.
- `packages/ui/`: shared design tokens and reusable UI primitives.
- `packages/testing/`, `tests/fixtures/`, `tests/e2e/`: deterministic test support and browser scenarios.

## Canonical commands

Use the root scripts; derive changes from the current `package.json` files.

```text
pnpm install
pnpm dev
pnpm dev:extension
pnpm dev:api
pnpm local:test
pnpm local:mock
pnpm local:providers
pnpm local:stop
pnpm format:check
pnpm format
pnpm lint
pnpm docs:check
pnpm deps:cycles
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm test:e2e:performance
pnpm build
pnpm verify
pnpm security:scan
pnpm build:release-candidate
```

- `pnpm verify` covers formatting, lint, strict types, unit/integration tests, and production builds; it does not cover browser E2E or the security scan.
- `pnpm test:e2e` uses a test-only extension with local-fixture permission.
- `pnpm local:test` is the owner/manual release-candidate path; load `artifacts/translation-extension-local-rc/extension` as unpacked, then use `pnpm local:stop`.
- Live provider test/benchmark commands transmit text and may cost money. Run them only with explicit approval, backend-only secrets, and non-sensitive synthetic text.

## Verification

- Never claim behavior from inspection, compilation, or test existence alone.
- Run narrow tests while iterating and the applicable `docs/verification-matrix.md` gates before completion.
- Normal implementation work requires formatting check, lint, strict typecheck, relevant tests, and production build. Use `pnpm verify` when scope warrants it.
- Browser/frontend/DOM work also requires managed Chromium E2E and inspection of the running unpacked extension. Name managed Chromium and branded Chrome evidence separately.
- API/runtime changes require a local runtime plus success and relevant failure-path requests with privacy-safe logs/responses.
- Persistence claims require save, refresh/reopen, relevant restart, retention, clear/disable/privacy, and corruption/failure evidence.
- Check adjacent cancel/continue/restore, navigation safety, dynamic content, exclusions, provider selection, and error normalization.
- Normal tests use synthetic fixtures and mocked upstreams; never paid providers.
- Run `pnpm security:scan` for permissions, messages, auth, API, provider, secret, storage, page-text, logging, bundle, or release changes.
- Docs-only work needs document formatting/link/reference checks; do not pretend application checks apply.
- Report unavailable checks and failed commands honestly.

## Frontend, accessibility, and BiDi

- Use `packages/ui/src/tokens.css` and shared UI primitives; do not create independent screen-specific design systems.
- Preserve the compact 360 px popup and responsive Options layout up to 680 px, with controls collapsing at 600 px.
- Support system/light/dark themes, LTR/RTL and mixed-direction content, `dir="auto"` where appropriate, keyboard operation, semantic controls, visible focus, accessible labels/live regions, zoom, and adequate contrast.
- Motion is subtle and functional; the fast token is 120 ms. Both OS and saved reduced-motion behavior must eliminate nonessential motion on changed surfaces.
- Cover relevant loading, empty, success, warning, unsupported, disabled, error, retry/recovery, cancellation, partial, restore, offline, hover, focus, and active states.
- Inspect popup, Options, comparison, and any affected page-owned UI at normal/narrow widths, 200% zoom, long strings, RTL/LTR, light/dark, keyboard focus, and reduced motion.
- Do not claim formal screen-reader, contrast, accessibility, BiDi, or branded-browser acceptance unless that exact evidence exists.
- Extension-owned page UI stays isolated. Provider output is always inserted as plain text.

## Persistence and privacy lifecycle

- Settings use `chrome.storage.local` key `appSettings` until cleared/uninstalled.
- Originals and authoritative active-page session state remain memory-only and exactly restorable; do not persist raw page text by default.
- Optional translated-text cache key `translationCache` is off by default, capped at 200, clearable, and removed/disabled when caching is off or privacy mode is on.
- Privacy mode blocks warning-class sensitive pages and disables persistent translated-text caching.
- Local API counters are process-local and are not production quota enforcement.
- New persistence needs explicit product/privacy approval, runtime validation, bounds, versioned migration, retention/deletion rules, clear UX, corruption/failure tests, and documentation.
- Never silently sync page text, settings, history, glossary, diagnostics, or cache data.

## Security and DOM safety

- Treat pages, messages, storage, API input, provider output, and upstream errors as untrusted.
- Never replace `document.body.innerHTML`, rebuild host pages, interpret provider HTML/script, use `eval`, or insert remote executable code. Mutate only eligible text nodes and retain exact originals.
- Exclude passwords, payment/security inputs, editable fields, scripts/styles, code/pre, hidden text, URLs, technical identifiers, `translate=no`, and extension-owned UI.
- Keep least privilege: no broad host permission or `<all_urls>` when `activeTab`/`scripting` and an explicit origin request suffice.
- Provider/model IDs, endpoints, credentials, allowlists, timeouts, retries, output limits, and emergency controls are backend-owned. Never silently fall back to another real recipient.
- Keep real local secrets only in ignored `apps/api/.dev.vars` or a platform secret store. Never put them in extension source, client variables, bundles, source maps, storage, logs, screenshots, commands, chat, or fixtures.
- Do not log raw page text, full URLs/query strings, cookies, form values, authorization, provider bodies, private endpoints, or unbounded stacks. Normalize and bound metadata-only errors.
- Validate sender/tab/frame/navigation/request identity and schemas; preserve cancellation and stale-session rejection.
- Update `docs/security-model.md`, `docs/threat-model.md`, and `docs/privacy-model.md` for security-sensitive changes, then scan secrets/bundles/permissions.

## Documentation and tracking

- Use `docs/INDEX.md` for the canonical hierarchy and document status.
- Update living specifications, ADRs, tasks, acceptance, security/privacy/threat, limitations, and verification evidence when their claims change.
- Never rewrite historical reports to imply checks that were not run.
- Use Beads for issues, dependencies, status, ownership, acceptance evidence, and concise durable memory. Run `bd prime` for the current workflow.
- Create/claim the Beads issue before implementation; close only after acceptance and applicable gates. Use `bd remember` for concise durable facts, not ad hoc memory files.
- Beads initialization or generated setup must never overwrite `AGENTS.md`. This file is maintained intentionally; generated workflow text belongs in the project-local Beads integration.
- Do not copy entire roadmaps, specifications, source files, secrets, or user data into Beads or memory.

## Git and external actions

- Preserve uncommitted user work; never use destructive reset/checkout or broad deletion without explicit authorization.
- Work on the approved branch. Do not push to `main`, force-push, rewrite shared history, merge automatically, delete branches automatically, or change repository visibility.
- Before a commit, review staged names/content/message, ensure only task files are included, and confirm no secrets, ignored environment files, generated artifacts, or prohibited development-tool attribution.
- Commit, push, open pull requests, sync Beads remotes, deploy, publish, purchase, or mutate external systems only when explicitly authorized by the task or active profile.

## Definition of done and final report

A task is done only when scope/acceptance are satisfied, boundaries and privacy are preserved, relevant success/failure/boundary/recovery/regression cases pass, applicable static/browser/runtime/security/persistence/visual checks pass, living docs are current, and the final diff is intentional and secret-free.

Every final report includes:

- **Changed:** files and behavior/documentation changed.
- **Verified:** static, automated browser, and manual branded-browser evidence distinguished.
- **Not verified:** skipped/unavailable checks and reasons.
- **Commands run:** every material inspection/verification command, including failures.
- **Remaining problems or risks:** blockers, limitations, follow-up, and assumptions.

Do not claim all tests pass, Chrome behavior, persistence, security, or completion without the corresponding evidence.
