# Lingo Page

Lingo Page is a privacy-first Chrome extension and local application API for translating eligible webpage text in place. The local MVP is implemented and verified with a deterministic mock provider; a credential-gated DeepL adapter is included for backend integration testing.

## What works

- Explicit whole-page translation with source detection and target selection.
- Text-node-only DOM updates, exact restore, cancellation, progress, stale-navigation protection, and dynamic-content translation.
- Exclusions for code, form controls, hidden/non-translatable regions, restricted pages, configured domains, and privacy-mode sensitive pages.
- Selected-text translation from the Chrome context menu with an isolated copyable result card.
- Local settings for privacy, caching, sensitive-page warnings, domain exclusions, dynamic content, reduced motion, theme preference, and glossary terms.
- Validated extension messages and API contracts, bounded requests, rate/quota controls, safe errors, server-only provider credentials, and privacy-safe logs.

## Architecture

```text
Popup / options / context menu
              |
              v
MV3 service worker -----> Hono API on Cloudflare Workers -----> mock or DeepL
              |
              v
Injected page engine (authoritative tab session and original text)
```

The production manifest uses `activeTab`, `contextMenus`, `scripting`, and `storage`. It has no `<all_urls>` access. Provider keys never enter the extension bundle.

## Quick start

Requirements: Node.js 24.14+, pnpm 11.7.x, and Chrome/Chromium.

```text
pnpm install
pnpm dev:api
pnpm dev:extension
```

The API runs at `http://localhost:8787` with the visible deterministic mock provider. See `docs/local-development.md` for production-build loading, environment variables, DeepL adapter testing, and troubleshooting.

## Quality commands

```text
pnpm format:check
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
pnpm verify
```

`pnpm test:e2e` builds a test-only extension variant with access to the single local fixture origin. `pnpm build` produces the production manifest without that fixture permission.

## Privacy and security

Page text is sent only after an explicit translate action. Persistent translated-text caching is off by default, capped at 200 entries when enabled, and disabled by privacy mode. Password/payment input values are never discovered. The extension calls only the application API; provider credentials are backend-only.

No deployment, Chrome Web Store publication, real-provider call, account system, or payment integration is performed by this repository. These require separate authorization and production configuration.
