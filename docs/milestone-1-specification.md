# Milestone 1 specification: durable translation sessions

- Status: Implemented and locally verified; branch review pending.
- Approved: 2026-07-18 by the product-owner Milestone 1 brief.
- Branch: `milestone/01-durable-translation-sessions`
- Beads epic: `translation-1mp.2`

## Objective

Showing the original page must never discard reusable translation work. A user can switch between original and translated text repeatedly without a translation request, update only new or modified eligible text, open an independently controlled translated copy, inspect a safe plain-text comparison, and explicitly end the session when they intend to discard it.

## Session contract

The top-frame page shell owns the authoritative in-memory session, exact originals, translations, live Text-node bindings, status, display mode, change summary, and observer. Display mode (`original`, `translated`, or mixed partial) is independent from lifecycle (`translating`, `partial`, `complete`, `stale`, `ended`, or invalidated). The service worker routes validated messages and retains only privacy-safe progress metadata during normal translation.

Session bundles are versioned, runtime validated, capped at 2,500 segments and 2 MB, and created only after an explicit copy/comparison action. They never enter a URL, webpage execution context, diagnostic report, log, or long-term history.

## View and lifecycle semantics

- **Original / Translated** rewrites only owned Text nodes from retained values and makes zero API/provider requests.
- Partial and cancelled sessions remain switchable when completed translations exist; untranslated sections remain original.
- **Update changed sections** scans first, reuses unchanged translations, removes disconnected mappings, translates only confident new/modified records, and leaves uncertain duplicates original.
- **Refresh translation** is an advanced, confirmed quota-using action. Whole-page refresh retains the previous translation if the replacement fails.
- **End translation session** is separately confirmed, restores safe originals, cancels pending work, stops observers/timers, and clears only that page-shell session.

## Matching rules

Records combine normalized source fingerprints, bounded structural context, existing node/element identity, and navigation identity. Stable parent-element rebinding classifies a replaced Text node as modified. Connected nodes whose structural context moves are reordered and reused. Duplicate candidates that cannot be disambiguated are uncertain and never receive an old translation. Navigation mismatch invalidates reuse.

## Translated copy

The service worker exports a bounded source bundle, opens the exact source URL, waits for the new top-level page, clones the session identity, and imports only confident matches. Matched content causes no translation call; unmatched/uncertain content stays original. Copies own independent sessions, so ending the source does not affect them.

## Comparison foundation

A dedicated extension page receives a single-use 128-bit token in the fragment. The bundle is held temporarily in `chrome.storage.session`, is available only to the owning comparison tab, and is removed after retrieval or tab cleanup. The page renders sanitized React text nodes only, never source HTML or scripts. It provides aligned original/translation pairs, states, keyboard navigation, copy controls, safe source navigation, responsive columns, theme/reduced-motion support, and `dir="auto"` at content boundaries.

## Privacy and security

- Normal sessions remain page-memory-only; no history or cloud store was added.
- Copy/comparison transfer is explicit, bounded, validated, same-navigation constrained, top-frame scoped, and isolated per tab.
- Provider keys/endpoints remain backend-only. Permissions remain `activeTab`, `contextMenus`, `scripting`, and `storage`; no broad host access was added.
- Translated output uses `nodeValue`/`textContent`; no untrusted HTML is inserted.
- Eligibility rejects inherited/variant editability and hidden ancestors; provider context no longer includes excluded descendant text.

## Acceptance evidence

Automated coverage must prove repeated full and partial switches, zero requests during switches, cancellation/continuation, exact originals, new/modified/removed/reordered/uncertain matching, changed-only requests, copy matching/isolation, comparison safety/keyboard/layout, saved reduced motion, mixed-direction identifiers, and explicit cleanup. The 2,206-segment fixture must record switch, copy, comparison, request, long-task, and directional heap evidence.

## Explicitly deferred

Full service-worker/browser restart persistence, sleep/wake recovery, viewport-first scheduling, adaptive concurrency/batching, SPA/infinite-scroll certification, long-term history, advanced bilingual workspace/side panel, editing, synchronized scrolling, accounts/sync, deployment, publication, billing, and live-provider calls remain outside Milestone 1.
