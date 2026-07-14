# Product specification

Status: Milestone 0 baseline

## Product goal

Translate eligible, user-visible webpage text directly inside the current page while preserving DOM structure, layout, links, controls, images, formatting, and functionality. The user can restore the original text instantly or cancel an active translation.

## Primary user journey

1. User installs the extension.
2. User opens it on a webpage.
3. The popup reports whether the current page is supported and explains that translation sends selected page text to the application backend.
4. The extension detects the source language or accepts an override.
5. User selects a target language or uses the saved default.
6. User explicitly starts page translation.
7. The content engine discovers eligible text nodes, prioritizes visible content, batches segments, and translates them through the backend.
8. Translations are written back as plain text into the original nodes while originals remain recoverable.
9. Popup and in-page status report progress, cancellation, partial failure, and completion.
10. User can restore the original page or translate again into another target language.

## MVP scope

### In scope

- Chrome Manifest V3 extension.
- Popup, settings/options page, service worker, and content script.
- Explicit user action before remote translation.
- Source language detection with manual override.
- Target language selection and saved default.
- In-place translation of eligible text nodes.
- Mock provider before any real provider integration.
- Secure backend route contract and development authentication.
- Cancellation, restore, retry, and clear error states.
- Session-only deduplication/cache design.
- Privacy warning, sensitive-page protection warning layer, domain exclusions, and clear-data controls.
- Light/dark themes, RTL layout, reduced motion, keyboard navigation, screen-reader labels.

### Out of scope until later milestones

- Payments and subscriptions.
- Public account system and production authentication.
- Selected-text, bilingual, hover-original, and composer translation.
- Documents, OCR, screen translation, desktop, mobile, local models, team workflows, and enterprise administration.
- Silent background translation or global keystroke monitoring.

## Functional requirements

### Extension UI

The popup must show a safe hostname/page title, support status, detected source language, source override, target language, translation state, progress, cancel/restore/retry actions, settings, and privacy status. User-facing strings must come from locale message catalogs.

### Eligibility

By default, exclude scripts, styles, code/preformatted content, hidden text, URLs, email addresses, file paths, technical identifiers, password/payment/security inputs, editable fields, extension-owned UI, and content marked non-translatable. Do not claim unsupported pages were translated.

### DOM safety

The engine must traverse incrementally, preserve whitespace behavior, assign stable segment IDs, deduplicate repeated strings, batch within limits, validate responses, insert text only, preserve originals, restore safely, support cancellation, avoid loops, and isolate its own state from page mutations.

### Backend

The API validates every request and response, enforces request/character/segment limits, rate limits by user and IP, applies timeouts and safe retries, normalizes errors, generates request IDs, exposes health/language/usage routes, and never logs raw page content by default. The provider key exists only in backend secrets.

## Non-functional requirements

- Privacy-first: no page translation without deliberate action; no raw page-content logging; no persistent content cache by default.
- Security-first: least-privilege permissions, validated messages, no remote executable code, no `eval`, HTTPS in production.
- Reliability: restore must be safe after partial failure, cancellation, dynamic mutations, tab reload, service-worker restart, and navigation.
- Performance: stay within the targets in `docs/performance-targets.md`.
- Accessibility: keyboard operation, visible focus, semantic controls, labels, contrast, zoom, RTL, and reduced motion.
- Portability: browser-specific code isolated behind adapters so Firefox/Safari can be addressed later.
- Observability: operational metadata only, with deliberate redacted diagnostic export.

## Success criteria

The Chrome MVP can translate a representative local article and real webpage through the backend architecture, restore the page, cancel in progress, handle a dynamic insertion and SPA navigation, pass automated checks, and provide honest unsupported/error states. See `docs/acceptance-criteria.md` and `docs/verification-matrix.md`.
