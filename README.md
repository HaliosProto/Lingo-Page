# Lingo Page

Lingo Page is a privacy-first Chrome extension and local application API for translating eligible webpage text in place. The local release candidate is verified with a deterministic mock provider and includes a backend-only universal provider registry for optional local testing.

The repository is governed by `PRODUCT_CONSTITUTION.md`, `PRODUCT_VISION.md`, and `ROADMAP.md`. The original Milestones 0-6 describe implemented local-MVP history; the current program foundation is recorded in `docs/milestone-0-verification-report.md`, and the durable-session milestone is recorded in `docs/milestone-1-verification-report.md`.

## What works

- Explicit whole-page translation with source detection and target selection.
- Durable page-owned sessions with instant Original/Translated switching, partial-session reuse, changed-section updates, deliberate refresh, and explicit session cleanup.
- Translated copy tabs and a plain-text comparison foundation reuse confident same-navigation translations without provider calls.
- Text-node-only DOM updates, exact original restoration, cancellation, progress, stale-navigation protection, and dynamic-content translation.
- Exclusions for code, form controls, hidden/non-translatable regions, restricted pages, configured domains, and privacy-mode sensitive pages.
- Selected-text translation from the Chrome context menu with an isolated copyable result card.
- Local settings for privacy, caching, sensitive-page warnings, domain exclusions, dynamic content, reduced motion, theme preference, and glossary terms.
- Validated extension messages and API contracts, bounded requests, rate/quota controls, safe errors, server-only provider credentials, and privacy-safe logs.
- Backend-enabled provider/model selection with native Gemini, OpenAI, Anthropic, Cohere, and DeepL adapters plus compatible profiles for DeepSeek, Kimi, GLM, Qwen, xAI, Mistral, MiniMax, and a restricted custom endpoint.

## Architecture

```text
Popup / options / context menu
              |
              v
MV3 service worker -----> Hono API on Cloudflare Workers -----> provider registry/adapters
              |
              v
Injected page engine (authoritative tab session and original text)
```

The production manifest uses `activeTab`, `contextMenus`, `scripting`, and `storage`. It has no `<all_urls>` access. Provider keys never enter the extension bundle.

## Quick start

Requirements: Node.js 24.14+, pnpm 11.7.x, and Chrome/Chromium.

```text
pnpm install
pnpm local:test
```

This builds the local release candidate and starts the loopback API at `http://127.0.0.1:8787` with the visible deterministic mock provider. Load `artifacts/translation-extension-local-rc/extension` from `chrome://extensions`. See `docs/local-development.md` and `docs/user-acceptance-testing.md` for the complete owner workflow.

## Quality commands

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm test:e2e:performance
pnpm build
pnpm verify
pnpm security:scan
pnpm local:stop
```

`pnpm test:e2e` builds a test-only extension variant with access to the single local fixture origin. `pnpm build` produces the production manifest without that fixture permission.

## Privacy and security

Page text is sent only after an explicit translate action. Persistent translated-text caching is off by default, capped at 200 entries when enabled, and disabled by privacy mode. Password/payment input values are never discovered. The extension calls only the application API; provider credentials are backend-only.

No deployment, Chrome Web Store publication, real-provider call, account system, or payment integration is performed by this repository. These require separate authorization and production configuration.

## Program documentation

- Current architecture audit: `docs/current-architecture-audit.md`
- Platform direction: `docs/platform-architecture.md`
- Security baseline: `docs/security-baseline.md`
- Performance baseline: `docs/v2-performance-baseline.md`
- Durable-session specification and evidence: `docs/milestone-1-specification.md`, `docs/milestone-1-verification-report.md`
- Design, accessibility, and BiDi: `docs/design-strategy.md`, `docs/accessibility.md`, `docs/bidi-safety.md`
- Workflow, task graph, and memory: `docs/tooling-and-workflow.md`, `docs/project-memory.md`
- Research and positioning: `docs/research-registry.md`, `docs/competitive-parity.md`, `docs/marketing-strategy.md`
