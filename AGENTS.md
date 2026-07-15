# AGENTS.md

## Purpose and authority

This file contains permanent repository instructions for contributors and automated development tools. Apply it to every task in this repository. More-specific instructions in a nested `AGENTS.md` override this file only for files in that subtree. Direct user instructions override repository defaults.

This repository is Lingo Page, a privacy-first webpage translation platform. Its current deliverable is a Chrome Manifest V3 extension that translates eligible visible page text in place through a secure application backend while preserving the page's DOM, styling, links, controls, images, formatting, and behavior.

## Current project state

- The local MVP and credential-independent portions of Milestones 0-6 are implemented.
- The verified default is the deterministic mock provider. Real-provider protocol boundaries have mocked tests, but no live real-provider call has been verified in this workspace.
- Production identity, durable quotas, public deployment, Chrome Web Store publication, formal accessibility/RTL certification, broad performance profiling, and owner acceptance remain incomplete.
- Work on exactly one approved milestone or explicitly requested task at a time. Do not silently expand into accounts, payments, deployment, publication, new platforms, or other future scope.
- Treat `TASKS.md`, `docs/milestones.md`, `docs/known-limitations.md`, and the latest verification reports as the current status sources. Do not repeat stale status from an older document without reconciling it with these files and the code.

## Working method

### 1. Inspect before coding

- Read the relevant existing code, tests, documentation, specifications, package manifests, and configuration before editing.
- Start with `git status --short` and preserve all existing work, including uncommitted changes. Never discard, overwrite, or reformat unrelated user changes.
- Use `rg` or `rg --files` to locate the current implementation and all callers before changing behavior.
- Do not guess important requirements. Reconcile implementation, tests, living documents, and accepted decisions.
- For small, local, reversible uncertainties, state a reasonable assumption and proceed.
- Ask the user only when a choice could materially affect architecture, security, privacy, cost, data handling or loss, permissions, external systems, milestone scope, or product experience.
- Never paste or print secrets while inspecting configuration, logs, history, or generated bundles.

### 2. Work from a clear goal

- For a non-trivial task, identify the user-visible or system goal and concrete acceptance criteria before implementation.
- Make a short implementation plan and keep it current while working.
- Follow `docs/spec-driven-workflow.md`: discover, specify, design, plan, accept, implement, verify, record, and stop for review.
- Continue until the acceptance criteria are satisfied or a real blocker is demonstrated. A task is not complete merely because code was written.
- If behavior, interfaces, permissions, data handling, provider selection, or milestone scope changes, update the corresponding specification, ADR, task, acceptance, security, privacy, and/or threat documents in the same task when relevant.

### 3. Keep solutions simple but complete

- Prefer the smallest complete solution that fits the existing architecture and conventions.
- Do not over-engineer or add unnecessary dependencies, abstractions, indirection, configuration, or speculative features.
- Do not add temporary hacks, placeholder behavior, weakened validation, skipped checks, or broad permissions merely to finish quickly.
- Reuse existing types, Zod schemas, configuration, design tokens, helpers, scripts, and test patterns before creating new ones.
- Preserve package boundaries. Do not bypass shared contracts or duplicate validation ad hoc.

### 4. Make surgical changes

- Change only files relevant to the requested task. Do not perform unrelated refactors, dependency upgrades, renames, formatting sweeps, or generated-file churn.
- Do not delete or rewrite code that is not understood. Trace its callers, tests, and documented intent first.
- Keep changes small, reversible, and easy to review.
- Do not modify deployment state, remotes, provider accounts, external services, or public resources unless the user explicitly authorizes that exact action.

## Actual technology stack

- Workspace: pnpm 11.7.x monorepo (`pnpm-workspace.yaml`), Node.js 24.14 or newer.
- Language: TypeScript 5.9 in strict mode, ESM packages.
- Extension: WXT 0.20, React 19, Chrome Manifest V3.
- Backend: Cloudflare Workers, Hono 4, Wrangler 4.
- Runtime validation: Zod 4 in shared validation/config packages.
- Tests: Vitest 4 for unit and API integration tests; Playwright 1.61 for managed-Chromium browser E2E.
- Quality tools: ESLint 10 and Prettier 3.
- Real-provider architecture: backend-only registry with native and compatible adapters; deterministic mock remains the normal automated and local acceptance path.

Use the versions pinned in `package.json` and `pnpm-lock.yaml`. Do not substitute npm, Yarn, a different runtime, or unpinned package upgrades without an explicit task requiring it.

## Repository map and boundaries

```text
apps/extension/                 WXT MV3 extension: popup, options, service worker, page engine
apps/api/                       Hono Cloudflare Worker API and provider orchestration
packages/shared-types/          Cross-boundary domain types and discriminated unions
packages/shared-validation/     Runtime schemas and safe parsing
packages/shared-config/         Defaults, environment/config validation, feature policy
packages/translation-core/      DOM- and provider-independent translation logic
packages/translation-providers/ Provider registry, prompts/payloads, response parsing, retries
packages/ui/                    Shared design tokens and reusable UI exports
packages/testing/               Test helpers and fixtures
tests/e2e/                      Playwright extension browser scenarios
tests/fixtures/                 Synthetic local test pages
scripts/                        Local startup, release-candidate, provider, and security tooling
docs/                           Living specifications, architecture, security, and verification
```

Boundary rules:

- `translation-core` must not import provider SDKs, Chrome APIs, React, or backend runtime code.
- `translation-providers` owns provider-specific payloads, fixed instructions/prompts, credentials, endpoints, retries, and response parsing; it must not own DOM or UI behavior.
- The extension owns DOM discovery/mutation and browser orchestration, never provider credentials or arbitrary provider endpoints.
- The API owns authentication, quotas, limits, provider selection/allowlists, credentials, upstream calls, and privacy-safe operational logging.
- Shared cross-boundary messages and API data must use the shared types and runtime schemas. Validate at every trust boundary.

## Canonical commands

Derive future command changes from the root and workspace `package.json` files; keep this section synchronized when scripts change.

### Prerequisites and installation

```text
pnpm install
```

Requirements: Node.js 24.14+, pnpm 11.7.x, and Chrome/Chromium for browser work.

### Development and local startup

```text
pnpm dev                 # run API and extension dev processes in parallel
pnpm dev:extension       # WXT Chrome development mode
pnpm dev:api             # local Wrangler API on port 8787
pnpm local:test          # verify, build the local RC, and start loopback API in mock mode
pnpm local:mock          # start/restart loopback API, forcing deterministic mock mode
pnpm local:providers     # start using configured providers from apps/api/.dev.vars
pnpm local:stop          # stop the helper-managed local API
```

For owner/manual acceptance, the standard command is `pnpm local:test`, then load `artifacts/translation-extension-local-rc/extension` through `chrome://extensions` as an unpacked extension. Use `pnpm local:stop` when finished. `pnpm local:start` uses the configured `.dev.vars` setup but does not build the extension; do not present it as a clean release-candidate workflow.

### Formatting, linting, types, tests, and builds

```text
pnpm format:check
pnpm format
pnpm lint
pnpm typecheck
pnpm test
pnpm test:unit
pnpm test:integration
pnpm test:e2e
pnpm build
pnpm verify
pnpm security:scan
pnpm build:release-candidate
```

- `pnpm verify` runs `format:check`, lint, strict type checking, unit/integration tests, and production builds.
- `pnpm verify` does **not** run Playwright E2E or `pnpm security:scan`; run those separately whenever the change affects browser behavior or a security-sensitive boundary.
- `pnpm test:e2e` builds a test-only Chrome extension with permission only for the local fixture origin, then runs managed Chromium.
- `pnpm build` creates the production extension manifest and a Wrangler dry-run backend build.
- `pnpm build:release-candidate` runs the static/test/build gate, packages ignored local artifacts, checks manifest permissions, and runs the security scan.
- Provider live-test/benchmark commands can transmit text and incur cost. Never run them without explicit user authorization and properly configured backend-only secrets.

## Verification rules

- Never claim a change works based only on code inspection, compilation, or the existence of tests.
- Run the narrowest relevant tests while iterating, then all applicable gates before completion. At minimum, use the evidence required by `docs/verification-matrix.md`.
- For normal implementation work, run formatting check, lint, strict type checking, relevant unit/integration tests, and production build. Run the complete `pnpm verify` when the scope warrants it.
- For extension/frontend/DOM behavior, also run `pnpm test:e2e` and inspect the real unpacked application in Chrome. Managed Chromium and branded Chrome are separate evidence; name which one was actually used.
- Never claim browser, visual, console, network, persistence, reload, restart, or service-worker-lifecycle verification unless that exact scenario was performed.
- For API/runtime changes, start the applicable local runtime, exercise success and relevant failure paths, and inspect only privacy-safe logs/responses.
- For persistence changes, save representative data, refresh/reopen the UI, restart the relevant extension/runtime or browser context, confirm the data remains when it should, and confirm clear/disable/privacy behavior removes it when required.
- Check adjacent functionality for regressions, especially cancel/continue/restore, navigation safety, dynamic content, exclusions, provider selection, and error normalization.
- Use synthetic fixtures and mock upstreams in automated tests. Normal tests, builds, browser E2E, and verification must never make paid provider calls.
- Run `pnpm security:scan` for changes involving permissions, message schemas, authentication, API routes, providers, secrets, storage, page-text collection, logs, generated bundles, or release packaging.
- A docs-only task does not require pretending to run application checks; run relevant document formatting/link/content checks and report application verification as not applicable.

## Frontend design and animation expectations

- Follow the existing UI in `packages/ui/src/tokens.css` and `apps/extension/src/ui/global.css`; reuse tokens rather than introducing one-off colors, radii, timing, or theme logic.
- Preserve the compact 360 px popup and the responsive options layout (up to 680 px, collapsing multi-column controls at 600 px).
- Support system/light/dark themes, readable LTR and RTL content, `dir="auto"` where appropriate, keyboard operation, semantic controls, visible focus, accessible labels/live regions, zoom, and adequate contrast.
- Keep motion subtle and functional. The current fast-motion token is 120 ms. No interaction may depend on animation, and reduced-motion behavior must remove or effectively eliminate nonessential transitions. Test both OS `prefers-reduced-motion` behavior and the saved reduced-motion preference when the changed surface uses it.
- Current CSS directly handles the OS reduced-motion media query. The `reducedMotion` setting is stored and exposed in Options, but no separate runtime style application is evident in the current source; treat that as an unverified implementation gap and do not claim the saved preference changes motion without browser proof.
- Every UI change must cover the relevant states: loading, empty, success, warning, unsupported, disabled, error, retry/continuation, cancellation, partial progress, restore, offline/backend unavailable, hover, focus, and active interaction.
- Visually inspect popup, Options, and any page-owned overlay/card affected by the change. Check narrow/normal widths, overflow, long translated strings, RTL text, light/dark themes, and keyboard focus order.
- Do not inject UI CSS that destabilizes the host page. Extension-owned page UI must stay isolated, and translated provider output must always be inserted as plain text.

## Persistence and data lifecycle

- Settings are stored in `chrome.storage.local` under `appSettings` and persist until cleared or the extension is uninstalled.
- Translation originals and authoritative page-session state stay in memory and must remain recoverable for safe restore during the active page session. Do not persist raw page text by default.
- The optional translated-text cache uses `translationCache`, is off by default, is capped at 200 entries, must be clearable, and must be removed/disabled when persistent caching is turned off or privacy mode is enabled.
- Privacy mode must block warning-class sensitive pages and disable persistent translated-text caching.
- Local API rate/quota counters are process-local and reset on Worker restart; they are not production enforcement or durable usage storage.
- Any new persistence requires explicit product/privacy approval, runtime validation, bounds, versioned keys/migrations, retention and deletion rules, clear UI, failure/corruption tests, and updates to privacy/security documentation.
- Never silently sync page text, settings, history, glossary data, diagnostics, or cache content to an account or remote store.

## Security, privacy, and DOM safety rules

- Treat the webpage, extension messages, storage contents, API input, provider output, and upstream errors as untrusted.
- Preserve page DOM structure. Never replace `document.body.innerHTML`, rebuild the page, inject provider-returned HTML/JavaScript, use `eval`, or insert remote executable code. Apply translations only as plain text to eligible text nodes and retain exact originals.
- Do not translate passwords, payment/security inputs, editable fields, scripts, styles, code/preformatted regions, hidden text, URLs, technical identifiers, `translate=no` regions, or extension-owned UI.
- Use least privilege. Do not add broad host permissions or `<all_urls>` when `activeTab` and `scripting` are sufficient. Production extension traffic must go only to the application API.
- Never put provider keys, auth tokens, administrator credentials, or private provider endpoints in extension source, WXT-prefixed variables, bundles, source maps, storage, logs, client configuration, screenshots, commands, chat, or fixtures.
- Real local secrets belong only in ignored `apps/api/.dev.vars` or the platform secret store. Keep `.env`, `.env.*` except `.env.example`, build outputs, local logs, test artifacts, and release artifacts out of version control.
- Do not log raw page text, full URLs, query strings, cookies, form values, authorization headers, tokens, keys, raw provider bodies, stacks, or private endpoints by default. Errors and diagnostics must be normalized, bounded, metadata-only, and safe to expose.
- Validate sender/tab/frame/navigation/request identity and message schemas. Preserve cancellation and stale-session rejection so old responses cannot mutate a new page.
- Provider/model IDs, endpoints, credentials, allowed models, timeouts, retries, output limits, and emergency disable controls remain backend-owned. Never silently fall back to another real provider after a selected-provider failure.
- Live provider requests require explicit user approval because they transmit data externally and may cost money. Use only non-sensitive synthetic text and never reveal configured secrets.
- Security-sensitive changes require updates to the relevant `docs/security-model.md`, `docs/threat-model.md`, and `docs/privacy-model.md`, plus a secret/bundle/permission scan.

## Specifications and living documentation

Read the subset relevant to the task before implementation:

- Product and scope: `docs/product-spec.md`, `TASKS.md`, `docs/milestones.md`
- Acceptance and definition of done: `docs/acceptance-criteria.md`, `docs/verification-matrix.md`
- Architecture and decisions: `docs/architecture.md`, `docs/decisions/`, `docs/provider-architecture.md`
- API and DOM flow: `docs/api-contracts.md`, `docs/translation-pipeline.md`
- Security/privacy: `docs/security-model.md`, `docs/threat-model.md`, `docs/privacy-model.md`
- Testing/performance/browser: `docs/testing-strategy.md`, `docs/performance-targets.md`, `docs/browser-compatibility.md`
- Local operation/UAT: `docs/local-development.md`, `docs/user-acceptance-testing.md`, `docs/user-acceptance-checklist.md`
- Current evidence and limitations: `docs/mvp-verification-report.md`, `docs/known-limitations.md`, `docs/current-state-audit.md`
- Process and history: `docs/spec-driven-workflow.md`, `CHANGELOG.md`

Update living documents when their claims, commands, status, acceptance criteria, risks, or limitations change. Record unverified items honestly; do not rewrite historical reports to imply checks that were not performed.

## Definition of done

A requested change is done only when all of the following are true:

1. The agreed goal and acceptance criteria are satisfied without expanding scope.
2. The implementation follows package boundaries, existing conventions, privacy requirements, and least-privilege rules.
3. Relevant success, failure, boundary, cancellation/recovery, and regression cases are tested.
4. Applicable format, lint, strict type, unit, integration, build, runtime, browser, security, persistence, and visual checks pass.
5. Frontend changes were inspected in the real application at the relevant sizes/states, with the actual browser evidence identified.
6. Security-sensitive changes passed secret/bundle/permission checks and updated security/privacy/threat documentation.
7. `TASKS.md`, `CHANGELOG.md`, specifications, limitations, and verification evidence are updated when the task changes them.
8. `git diff` contains only intentional task-related edits and no secrets, generated clutter, or unrelated user changes.
9. Any unavailable check, remaining risk, or known limitation is clearly reported; no high-severity security, privacy, correctness, or data-loss issue remains concealed.

A milestone is complete only when its entries in `docs/acceptance-criteria.md` and `docs/verification-matrix.md` are satisfied and recorded. Code existing is not sufficient.

## Required final report

At the end of every task, clearly report:

- **Changed:** the files and behavior/documentation changed.
- **Verified:** checks and scenarios that passed, distinguishing static, automated browser, and manual branded-Chrome evidence.
- **Not verified:** checks that were not run or could not be completed, with the reason.
- **Commands run:** every material command used for inspection and verification, including failed commands.
- **Remaining problems or risks:** blockers, limitations, follow-up work, and any assumptions that still matter.

Do not say "all tests pass," "works in Chrome," "persists," "secure," or "complete" unless the corresponding evidence was actually produced during the task or is explicitly cited as prior evidence rather than current verification.

<!-- BEGIN BEADS INTEGRATION v:1 profile:minimal hash:970c3bf2 -->
## Beads Issue Tracker

This project uses **bd (beads)** for issue tracking. Run `bd prime` to see full workflow context and commands.

### Quick Reference

```bash
bd ready              # Find available work
bd show <id>          # View issue details
bd update <id> --claim  # Claim work
bd close <id>         # Complete work
```

### Rules

- Use `bd` for ALL task tracking — do NOT use TodoWrite, TaskCreate, or markdown TODO lists
- Run `bd prime` for detailed command reference and session close protocol
- Use `bd remember` for persistent knowledge — do NOT use MEMORY.md files

**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.

## Agent Context Profiles

The managed Beads block is task-tracking guidance, not permission to override repository, user, or orchestrator instructions.

- **Conservative (default)**: Use `bd` for task tracking. Do not run git commits, git pushes, or Dolt remote sync unless explicitly asked. At handoff, report changed files, validation, and suggested next commands.
- **Minimal**: Keep tool instruction files as pointers to `bd prime`; use the same conservative git policy unless active instructions say otherwise.
- **Team-maintainer**: Only when the repository explicitly opts in, agents may close beads, run quality gates, commit, and push as part of session close. A current "do not commit" or "do not push" instruction still wins.

## Session Completion

This protocol applies when ending a Beads implementation workflow. It is subordinate to explicit user, repository, and orchestrator instructions.

1. **File issues for remaining work** - Create beads for anything that needs follow-up
2. **Run quality gates** (if code changed) - Tests, linters, builds
3. **Update issue status** - Close finished work, update in-progress items
4. **Handle git/sync by active profile**:
   ```bash
   # Conservative/minimal/default: report status and proposed commands; wait for approval.
   git status

   # Team-maintainer opt-in only, unless current instructions forbid it:
   git pull --rebase
   bd dolt push
   git push
   git status
   ```
5. **Hand off** - Summarize changes, validation, issue status, and any blocked sync/commit/push step

**Critical rules:**
- Explicit user or orchestrator instructions override this Beads block.
- Do not commit or push without clear authority from the active profile or the current user request.
- If a required sync or push is blocked, stop and report the exact command and error.
<!-- END BEADS INTEGRATION -->

<!-- BEGIN BEADS CODEX SETUP: generated by bd setup codex -->
## Beads Issue Tracker

Use Beads (`bd`) for durable task tracking in repositories that include it. Use the `beads` skill at `.agents/skills/beads/SKILL.md` (project install) or `~/.agents/skills/beads/SKILL.md` (global install) for Beads workflow guidance, then use the `bd` CLI for issue operations.

### Quick Reference

```bash
bd ready                # Find available work
bd show <id>            # View issue details
bd update <id> --claim  # Claim work
bd close <id>           # Complete work
bd prime                # Refresh Beads context
```

### Rules

- Use `bd` for all task tracking; do not create markdown TODO lists.
- Run `bd prime` when Beads context is missing or stale. Local development environments may load Beads context through hooks; inspect local hook settings when troubleshooting.
- Keep persistent project memory in Beads via `bd remember`; do not create ad hoc memory files.

## Repository Attribution and Tooling Privacy

Treat every tracked file and all public Git metadata as product-owned material.

* Never mention development assistants, AI models, model providers, coding agents, prompt systems, or generation tools in tracked repository content.
* This prohibition includes source code, comments, documentation, filenames, configuration, package metadata, changelogs, tests, screenshots, commit messages, pull-request titles and descriptions, release notes, and user-facing text.
* Never add phrases such as “generated by,” “built with,” “assisted by,” or similar development-tool attribution.
* Keep assistant-specific configuration, prompts, logs, transcripts, caches, and local automation files outside Git tracking.
* Write commits and documentation as normal work performed by the project team.
* Before every commit, inspect staged filenames, staged content, and the commit message for prohibited tool or provider names. Stop and remove any matches before committing.
* These rules apply to all agents, contributors, automated scripts, and generated output.


**Architecture in one line:** issues live in a local Dolt DB; sync uses `refs/dolt/data` on your git remote; `.beads/issues.jsonl` is a passive export. See https://github.com/gastownhall/beads/blob/main/docs/SYNC_CONCEPTS.md for details and anti-patterns.
<!-- END BEADS CODEX SETUP -->
