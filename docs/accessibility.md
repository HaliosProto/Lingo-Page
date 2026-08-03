# Accessibility plan

## Current protections

React surfaces use semantic controls and accessible labels; status content exists; shared CSS provides visible focus; layouts are compact/responsive; `dir="auto"` is present; OS `prefers-reduced-motion` is handled.

## Milestone 1 implementation status

The saved `reducedMotion` setting now applies a runtime attribute to popup, Options, and comparison surfaces while the operating-system media query remains active. Managed Chromium verifies persistence and runtime application. Session controls use buttons, pressed-state segmented controls, status regions, retry actions, confirmation, visible focus, and progressive disclosure. The full-page comparison has skip links to both labeled panes, a pressed-state synchronized-scroll control with live status, logical toolbar order, keyboard and pointer divider control, reset/swap actions, and a stacked narrow fallback. Managed Chromium verifies 200% comparison zoom without horizontal document overflow. Formal screen-reader, 400% zoom, contrast/high-contrast, OS-level visual motion, and branded-Chrome evidence remain open.

## Milestone 3 preference and quality controls

Translation brief, style, content, audience, quality, review, and glossary-scope controls use semantic labels, native selects/textarea/details, visible focus, logical DOM order, bounded live status, and plain-language provider-usage disclosure. The brief and glossary inputs use `dir="auto"`; policy and quality summaries do not expose internal JSON or prompts. The Options grid collapses at 600 pixels, the popup remains 360 pixels, and existing OS/saved reduced-motion handling covers the new controls.

Managed Chromium must cover keyboard-only disclosure/edit/save/review, 200% zoom, 390-pixel popup, light/dark, long strings, RTL/mixed-direction values, validation feedback, and predictable focus after save. Formal screen-reader, contrast, high-contrast, and branded-browser claims remain manual until exact evidence exists.

## Release-blocking criteria

- Complete keyboard operation and logical focus order on every surface/state.
- Accurate accessible names, descriptions, error association, and status announcements.
- No loss of content/function at 200% and 400% zoom/reflow.
- Contrast and focus indication meet the selected WCAG target; color is never the only status cue.
- OS and saved reduced-motion paths independently eliminate nonessential motion.
- LTR/RTL/mixed content remains readable and has predictable reading order.
- At least one representative screen-reader pass is recorded for the supported branded browser/OS combination.
- Disabled, loading, partial, error, and recovery states are distinguishable and actionable.

## Test ownership

Automated checks catch semantic and regression failures. Keyboard, zoom, contrast, screen reader, wording comprehension, and direction require manual evidence. Any exception needs a documented user impact, workaround, owner, and target milestone.

Milestone 2 recovery status is a semantic `aria-live="polite"` region with plain-language headings and exact remaining counts. Existing session controls remain keyboard-operable and do not move focus when the popup refreshes. Managed Chromium covers the compact popup and existing 200% zoom/reduced-motion regressions; formal screen-reader, high-contrast, and branded-Chrome evidence remains manual.
