# Changelog

## Unreleased

### Local MVP — 2026-07-15

- Created the pnpm/TypeScript monorepo, WXT React MV3 extension, Cloudflare Worker/Hono API, shared runtime schemas, translation core, provider adapters, and test fixtures.
- Added explicit page translation, progress, cancellation, stale-navigation protection, exact restoration, dynamic-content translation, and deterministic batching.
- Added selected-text translation with a Chrome context-menu action and isolated copyable result card.
- Added popup and options experiences for language preferences, privacy mode, sensitive-page protection, domain exclusions, dynamic content, cache policy, theme/reduced motion, and personal glossary terms.
- Added mock and DeepL providers. DeepL credentials remain server-side; upstream responses, token restoration, timeouts, and errors are validated without a live credential.
- Added validated translation, detection, languages, usage, and health routes with body/segment/character limits, development auth rules, per-client rate limits, session quotas, emergency disable, safe CORS, security headers, and redacted logging.
- Kept the production manifest to `activeTab`, `contextMenus`, `scripting`, and `storage`, with only the local API host permission. The localhost fixture grant exists only in the E2E build mode.
- Added 36 unit/integration tests and a managed-Chromium workflow covering translation, exclusions, dynamic content, cancellation, restoration, selected text, popup, and options.

### Milestone 0 — 2026-07-15

- Added repository operating rules and the product, architecture, security, privacy, threat, pipeline, testing, compatibility, performance, roadmap, milestone, acceptance, and verification documents.
- Selected WXT + React, Cloudflare Workers + Hono, a provider-neutral translation core, and DeepL as the provisional first real provider.

### Local release-candidate workflow - 2026-07-15

- Added loopback-only local mock/DeepL start-stop scripts and ignored release-candidate packaging with checksums.
- Added explicit local provider/version status, retry UX, metadata-only diagnostics export, and owner acceptance runbooks.
