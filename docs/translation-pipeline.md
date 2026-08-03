# Translation pipeline

## Principles

The pipeline translates text nodes, not page markup. It is incremental, cancelable, bounded, reversible, and provider-independent.

## Stages

1. **Capability check** — reject browser-internal, extension, Web Store, settings, unsupported PDF/DRM, and inaccessible contexts. Report the reason.
2. **Session creation** — bind a session to tab ID, frame ID, URL identity, navigation identity, target/source language, and abort signal.
3. **Traversal** — walk the DOM in chunks; use visibility heuristics and document order. Never traverse `script`, `style`, `noscript`, `template`, `svg` text by default, code/pre, editable/security fields, extension-owned roots, or excluded regions.
4. **Eligibility** — ignore hidden or empty nodes, technical tokens, URLs/emails/file paths, and nodes with explicit non-translation markers. Preserve visible whitespace and meaningful punctuation.
5. **Segmentation** — assign stable opaque IDs; retain node references and original text; capture bounded context/role metadata without sending full surrounding page content unless needed.
6. **Normalization** — normalize only for grouping/deduplication. Store exact original text and leading/trailing whitespace separately so application can preserve it.
7. **Protection** — replace URLs, emails, placeholders, numbers, and configured glossary-preserve tokens with opaque placeholders for provider transport; validate exact token preservation on return.
8. **Deduplication** — group equal text by a cache key containing source/target, original text, context, selected provider and model, glossary version, formality/tone. Map one translation to many segment IDs.
9. **Batching** — enforce segment, character, estimated input/output-token, provider/language, and segment-distribution limits. A page session retains its own safe batch target and reduces it after an incomplete response; the 2,500-segment safety ceiling is not a fixed batch size.
10. **Backend request** — send structured segments plus stable provider/model IDs only through the service worker to the application API. The API revalidates both against its registry; no endpoint or credential crosses this boundary.
11. **Response validation** — verify request/session identity and each stable segment ID independently. Classify complete, valid-partial, truncated/malformed, missing, duplicate, unknown, empty, and invalid-structured output. Preserve only valid plain-text records; leave every invalid or absent ID unresolved.
12. **Apply** — write translated text with `Text.nodeValue`/equivalent text-node operations. Do not change element structure. Track applied state and original text.
13. **Layout adaptation** — first allow natural wrapping; then update scoped `lang`/`dir` metadata when safe; detect clipping/overflow; avoid global styles; track and reverse every change.
14. **Observe** — debounce mutations, ignore extension-owned mutations, translate new eligible content only when the session remains valid, and cap work per observer cycle.
15. **Adaptive recovery/continue** — automatically retry unresolved IDs, halve only failing subsets down to individual segments, and continue the untouched queue after recovery. Split depth, attempts per segment, total attempts, duration, `Retry-After`, and cancellation are bounded. Non-retryable authentication, quota, refusal, configuration, and model failures stop without splitting. Progress exposes translated, queued, waiting, retrying, failed, attempt, and privacy-safe classification counts. Manual continuation still selects only connected records without a translated value.
16. **Restore/cancel** — cancellation aborts pending work but preserves already translated sections and reports exact counts. Restore only nodes belonging to the active session and only when their current value is still the extension's translated value; otherwise leave page-authored changes untouched and report partial restoration.
17. **Cleanup** — disconnect observers, abort requests, clear temporary mappings and content, and keep only non-sensitive status needed by the popup.

## Response invariants

- Every requested segment is either translated, explicitly skipped, or reported failed.
- No unknown segment ID is applied.
- No translated output is interpreted as markup.
- Protected tokens are preserved exactly or the segment is rejected.
- A stale navigation/session response cannot mutate the current page.
- A failed or cancelled batch cannot reset completed progress, and continuation cannot apply a completed segment twice.
- Partial recovery cannot overwrite a previously accepted translation, resend a completed ID, or block later queued batches because one segment remains unresolved.

## Dynamic pages

Use a debounced `MutationObserver` plus route-change signals where available. The observer is not a global monitor: it runs only for an active translation session, ignores extension-marked nodes, applies a work budget, and stops on cancellation/navigation.

## Unsupported content

Canvas-rendered text, image-only text, inaccessible cross-origin frames, browser UI pages, DRM-protected content, and unsupported extension/PDF viewers are reported as unsupported or partially supported. The product must not present an empty or partial result as complete.

## Structured translation intelligence

Before batching, the page shell resolves a versioned provider-neutral policy with natural defaults and the documented precedence. It derives only bounded visible page title, hostname/origin, heading path, adjacent eligible text, element role, and page-session terminology. Hidden, editable, password/payment/security, code/pre, excluded, extension-owned, and `translate=no` content is not context.

The provider package compiles stable privileged sections and a separate untrusted JSON payload. Page text, context, glossary values, terminology memory, dialect, and custom brief cannot alter IDs, target language, recipient, schema, limits, or security rules. Protected values are replaced before transfer and must return exactly once.

Response schema version 1 preserves independently valid records and leaves invalid/missing IDs unresolved for adaptive recovery. After structural validation, deterministic number, URL, email, code/product/formula/identifier, glossary, identical-output, truncation/expansion, markup/control, and language-carryover checks run. Clean batches stop after one call. Automatic review receives suspicious IDs once; on-demand review receives only currently flagged IDs. Corrections are revalidated/rechecked, while review failure preserves the original safe value.

Cache identity includes policy, context, glossary, provider/model, prompt-template, and output-contract identity. UI-only theme/motion changes do not invalidate translations. Review calls bypass translation cache. Policy/context incompatibility requires explicit retranslation and never creates an automatic lifecycle provider call.

## Lifecycle and mutation pipeline

Reload recovery hashes the current fragment-free navigation, rediscovers eligible text, and matches the bounded recovery record by source fingerprint, structural fingerprint, and element role. Exact originals always come from the current DOM. A browser-restored replacement first proves current-origin access, Chrome restoration evidence, record/tab uniqueness, and an atomic claim; it increments the navigation generation before the same DOM reconciliation. Unmatched, changed, or ambiguous content remains original and is reported; reconstruction never creates a provider attempt.

The mutation observer queues at most 256 unique roots for the active navigation generation. It processes at most 48 roots or 8 ms per slice and yields 16 ms before additional work. Compatible root replacement rebinds unique matches; route generation changes discard queued roots and reject late provider results. The 2,500-section ceiling remains a hard safety limit and deferred eligible sections are surfaced in progress.
