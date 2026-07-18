# Accessibility plan

## Current protections

React surfaces use semantic controls and accessible labels; status content exists; shared CSS provides visible focus; layouts are compact/responsive; `dir="auto"` is present; OS `prefers-reduced-motion` is handled.

## Milestone 1 implementation status

The saved `reducedMotion` setting now applies a runtime attribute to popup, Options, and comparison surfaces while the operating-system media query remains active. Managed Chromium verifies persistence and runtime application. Session controls use buttons, pressed-state segmented controls, status regions, retry actions, confirmation, visible focus, and progressive disclosure. The full-page comparison has skip links to both labeled panes, a pressed-state synchronized-scroll control with live status, logical toolbar order, keyboard and pointer divider control, reset/swap actions, and a stacked narrow fallback. Managed Chromium verifies 200% comparison zoom without horizontal document overflow. Formal screen-reader, 400% zoom, contrast/high-contrast, OS-level visual motion, and branded-Chrome evidence remain open.

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
