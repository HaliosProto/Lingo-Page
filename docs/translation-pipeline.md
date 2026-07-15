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
9. **Batching** — enforce local and backend limits; prioritize visible viewport content, then nearby content, then below-the-fold content. Bound concurrent batches.
10. **Backend request** — send structured segments plus stable provider/model IDs only through the service worker to the application API. The API revalidates both against its registry; no endpoint or credential crosses this boundary.
11. **Response validation** — verify request ID, exact IDs, uniqueness, output type/length, token preservation, and suspicious markup. Permit explicit partial responses only with a typed status.
12. **Apply** — write translated text with `Text.nodeValue`/equivalent text-node operations. Do not change element structure. Track applied state and original text.
13. **Layout adaptation** — first allow natural wrapping; then update scoped `lang`/`dir` metadata when safe; detect clipping/overflow; avoid global styles; track and reverse every change.
14. **Observe** — debounce mutations, ignore extension-owned mutations, translate new eligible content only when the session remains valid, and cap work per observer cycle.
15. **Pause/retry/continue** — normalize the failure source, retain completed node records, honor a bounded `Retry-After` delay for one automatic transient retry, and expose translated/queued/waiting/retrying/failed counts. After failure or cancellation, continuation batches only connected records without a translated value; completed sections are never resent.
16. **Restore/cancel** — cancellation aborts pending work but preserves already translated sections and reports exact counts. Restore only nodes belonging to the active session and only when their current value is still the extension's translated value; otherwise leave page-authored changes untouched and report partial restoration.
17. **Cleanup** — disconnect observers, abort requests, clear temporary mappings and content, and keep only non-sensitive status needed by the popup.

## Response invariants

- Every requested segment is either translated, explicitly skipped, or reported failed.
- No unknown segment ID is applied.
- No translated output is interpreted as markup.
- Protected tokens are preserved exactly or the segment is rejected.
- A stale navigation/session response cannot mutate the current page.
- A failed or cancelled batch cannot reset completed progress, and continuation cannot apply a completed segment twice.

## Dynamic pages

Use a debounced `MutationObserver` plus route-change signals where available. The observer is not a global monitor: it runs only for an active translation session, ignores extension-marked nodes, applies a work budget, and stops on cancellation/navigation.

## Unsupported content

Canvas-rendered text, image-only text, inaccessible cross-origin frames, browser UI pages, DRM-protected content, and unsupported extension/PDF viewers are reported as unsupported or partially supported. The product must not present an empty or partial result as complete.
