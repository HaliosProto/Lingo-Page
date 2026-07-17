# Frontend verification plan

## Automated matrix

Use managed Chromium with synthetic fixtures for popup, Options, and page-owned UI. Cover 320/360/400 px popup widths where the browser permits, Options at 480/600/680/1024 px, 100/200/400% zoom, light/dark/system themes, English/Persian/Arabic/Hebrew mixed copy, long labels, keyboard-only operation, reduced motion, and all product states defined in `docs/design-strategy.md`.

Record screenshots only after fonts, viewport, theme, data, animation, and time-dependent values are deterministic. A screenshot pass supplements semantic assertions; it does not replace them.

## Accessibility checks

- DOM/role/name/state assertions and automated rule checks.
- Tab/Shift+Tab order, visible focus, Enter/Space/Escape behavior, focus restoration, and no keyboard trap.
- Live status/error announcements without repeated or overly verbose output.
- Contrast and non-color cues in light/dark/forced-colors where practical.
- Reflow and content visibility at 200% and 400% zoom.
- OS reduced motion and saved reduced-motion preference as distinct scenarios.

## Direction and localization checks

Exercise UI chrome direction separately from user/provider content direction. Use `dir="auto"`/`bdi` or isolated content containers for unknown text; assert logical layout, punctuation/number ordering, truncation, copy output, and exact restore on mixed-script fixtures.

## Runtime evidence levels

1. Static: types, lint, markup/CSS inspection.
2. Managed browser: deterministic Playwright behavior and screenshots.
3. Branded Chrome: unpacked production manifest, popup/options/page shell, console/network/service-worker inspection.
4. Assistive technology and native-device review: product-owner environment or specialist review.

Current Milestone 0 limitation: level 2 behavioral E2E is available, but interactive visual capture and level 3 branded-Chrome acceptance were not available in this session. They remain release-blocking evidence, not inferred passes.
