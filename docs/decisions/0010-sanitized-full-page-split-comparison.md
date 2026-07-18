# ADR 0010: Render comparison from a sanitized structural snapshot

- Status: Accepted.
- Date: 2026-07-18

## Context

The first Milestone 1 comparison rendered one card per translated segment. It was safe but did not meet the product requirement to compare recognizable original and translated page versions side by side. Embedding arbitrary public pages is unreliable because sites can prohibit framing, and it would expose live scripts, authentication state, forms, and unrelated navigation to an extension-owned surface.

## Decision

An explicit comparison action captures one bounded flattened structural snapshot from the active page's main reading region. The snapshot contains an allowlist of inert semantic elements, parent-before-child indexes, segment references, and a small allowlist of bounded attributes. It excludes scripts, styles, frames, objects, embeds, forms, inputs, editable regions, hidden content, extension UI, inline handlers, arbitrary CSS, and user-entered values. Links and images accept only resolved HTTP(S) URLs without embedded credentials; links open a normal tab with `noreferrer`, images use `no-referrer`, and captured buttons are disabled.

The versioned session bundle remains capped at 2,500 segments, 15,000 snapshot nodes, 40 levels of nesting, and 2 MB. Runtime validation requires an acyclic parent-before-child tree and exactly one text source per text node. A dedicated extension page reconstructs the same inert model twice with React element and text nodes: exact original text on the left and cached translation, falling back to original text, on the right. It never parses or inserts captured HTML.

The default desktop view is a compact toolbar over two full-height 50/50 panes. Proportional synchronized scrolling uses a single `requestAnimationFrame` and a recursion guard. Users can unlink scrolling, relink with deterministic realignment, drag or keyboard-adjust the divider, reset to 50/50, and swap sides. Narrow layouts stack two independently usable panes. Each pane owns direction metadata and isolates mixed-direction text.

## Consequences

The comparison preserves reading order and common headings, paragraphs, lists, tables, safe images, captions, and controls without executing source code or relying on cross-origin framing. It intentionally does not preserve arbitrary site CSS, interactive forms, authentication state, canvas/media, or pixel-perfect layout. Snapshot generation and comparison loading make no provider request. The temporary bundle is removed after its owning comparison tab retrieves it or closes.
