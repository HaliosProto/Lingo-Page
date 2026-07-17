# Accessibility plan

## Current protections

React surfaces use semantic controls and accessible labels; status content exists; shared CSS provides visible focus; layouts are compact/responsive; `dir="auto"` is present; OS `prefers-reduced-motion` is handled.

## Confirmed implementation gap

The saved `reducedMotion` setting is validated, stored, and shown in Options, but no verified runtime class/attribute applies it to popup, Options, or the page-owned result. Only the operating-system media query currently has evidence. This is a Milestone 1 defect, not a Milestone 0 code change.

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
