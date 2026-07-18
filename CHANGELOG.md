# Changelog

## Unreleased

- Added bounded provider-aware incomplete-response recovery that preserves valid stable-ID records, retries unresolved IDs only through smaller subsets, continues queued work, and exposes privacy-safe recovery diagnostics and honest partial actions.
- Added a metadata-only translated-copy permission intent so one click continues after grant even if the popup closes, while callback/event races remain idempotent and denial, expiry, wrong origin, revocation, and navigation mismatch fail closed.
- Added explicit current-origin HTTP/HTTPS permission requests for translated copies, with denial guidance, redirect/revocation enforcement, final-DOM hydration reconciliation, and zero-call cached reuse.
- Fixed translated-copy tabs closing on handoff errors by binding storage before navigation, retaining the visible tab on every failure, and deleting central page-text data only after destination acknowledgment.
- Replaced the default segment-card comparison with a bounded sanitized full-page Original/Translation split, synchronized or independent scrolling, adjustable/resettable divider, swap, responsive stacking, themes, reduced motion, and BiDi isolation.
- Made page-change checks always show no-change, changes-found, updated, or retryable-error feedback while keeping scans provider-free.
- Added Milestone 1 page-owned translation sessions with instant zero-call original/translated switching, changed-only updates, explicit end-session cleanup, isolated translated-copy tabs, and a safe plain-text comparison page.
- Added bounded runtime-validated session handoff, saved reduced-motion runtime behavior, mixed-direction comparison treatment, and 2,206-segment session-reuse performance/request evidence.

### Program foundation and audit - 2026-07-18

- Added the product constitution/vision, post-MVP roadmap, current/platform architecture audit, risk/data-lifecycle policy, and workflow/memory governance.
- Added design-system, frontend verification, accessibility, BiDi, competitive, research, marketing, positioning, and product-owner action foundations.
- Added a bounded ordinary defensive security baseline with classified code-path findings and existing protections.
- Added a reproducible managed-Chromium mock performance harness and baseline for 25, 400, 1,000, and 2,200-node fixtures plus dynamic and mixed-direction content.
- Reconciled historical milestone/live-provider claims with the current verified mock-first state and defined the exact proposed durable-browser Milestone 1 gate.

### Universal provider local release candidate - 2026-07-15

- Added a safe provider registry, capability metadata, backend allowlisted model catalogs, optional filtered discovery cache, and extension provider/model selection.
- Added native Gemini Interactions, OpenAI Responses, Anthropic Messages, Cohere v2 Chat, DeepL, and deterministic mock adapters.
- Added one hardened OpenAI-compatible adapter with profiles for DeepSeek, Kimi/Moonshot, GLM/Z.AI, Qwen/Alibaba Model Studio, xAI/Grok, Mistral, MiniMax, and a backend-controlled custom endpoint.
- Added normalized provider/model and token-usage metadata, strict segment reconciliation, prompt-injection boundaries, protected-token checks, malformed-output retry limits, and safe error normalization.
- Added controlled provider tests, explicit live benchmark tooling and human-review worksheet, per-provider concurrency/timeouts/disable/quota controls, and provider-specific privacy disclosures.
- Fixed blank optional `.dev.vars` values causing API-wide Zod failures, added request IDs and privacy-safe schema diagnostics for configuration errors, and corrected provider-test HTTP 500 classification.
- Added normalized partial/stop reasons, exact popup explanations and recovery actions, queue/retry counts, allowlisted copyable diagnostics, bounded Retry-After handling, and continuation that never resends completed sections.

### Local MVP — 2026-07-15

- Created the pnpm/TypeScript monorepo, WXT React MV3 extension, Cloudflare Worker/Hono API, shared runtime schemas, translation core, provider adapters, and test fixtures.
- Added explicit page translation, progress, cancellation, stale-navigation protection, exact restoration, dynamic-content translation, and deterministic batching.
- Added selected-text translation with a Chrome context-menu action and isolated copyable result card.
- Added popup and options experiences for language preferences, privacy mode, sensitive-page protection, domain exclusions, dynamic content, cache policy, theme/reduced motion, and personal glossary terms.
- Added mock and DeepL providers. DeepL credentials remain server-side; upstream responses, token restoration, timeouts, and errors are validated without a live credential.
- Added validated translation, detection, languages, usage, and health routes with body/segment/character limits, development auth rules, per-client rate limits, session quotas, emergency disable, safe CORS, security headers, and redacted logging.
- Kept required production permissions to `activeTab`, `contextMenus`, `scripting`, and `storage`, with only the local API required host permission. Optional HTTP/HTTPS patterns support explicit per-origin translated-copy grants; the localhost fixture required grant exists only in E2E mode.
- Added 36 unit/integration tests and a managed-Chromium workflow covering translation, exclusions, dynamic content, cancellation, restoration, selected text, popup, and options.

### Milestone 0 — 2026-07-15

- Added repository operating rules and the product, architecture, security, privacy, threat, pipeline, testing, compatibility, performance, roadmap, milestone, acceptance, and verification documents.
- Selected WXT + React, Cloudflare Workers + Hono, a provider-neutral translation core, and DeepL as the provisional first real provider.

### Local release-candidate workflow - 2026-07-15

- Added loopback-only local mock/DeepL start-stop scripts and ignored release-candidate packaging with checksums.
- Added explicit local provider/version status, retry UX, metadata-only diagnostics export, and owner acceptance runbooks.
