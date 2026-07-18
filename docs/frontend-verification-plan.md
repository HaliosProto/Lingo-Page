# Milestone 1.5 frontend runtime audit and verification

Status: CURRENT - managed-Chromium sign-off recorded

Audit date: 2026-07-18

Runtime: managed Playwright Chromium with the locally built WXT Manifest V3 extension and deterministic mock API. This is not branded-Chrome or formal assistive-technology evidence.

## QA inventory

| Surface            | Controls and transitions                                                                                                                                                               | Required states/evidence                                                                                                                                                                           |
| ------------------ | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Popup              | Settings; provider/model/source/target; Translate/Cancel/Continue/Restore; Original/Translated; change scan/update; translated copy; comparison; refresh/end; failure recovery/details | No session, translating, adaptive recovery, partial, completed, original/translated, no-change/changed/updated, permission explanation/denial, copy ready, provider/backend error, restricted page |
| Options            | Provider test; language/theme; motion/privacy/cache/sensitive/dynamic/selection toggles; exclusions; glossary add/edit/preserve/remove; save/clear/export                              | Loading/available, empty glossary, saved status, disabled cache, light/dark, narrow layout, keyboard focus                                                                                         |
| Comparison         | Linked/unlinked scroll; swap; reset; source; translated copy; close; pointer/keyboard divider; pane scrolling                                                                          | Loading/error, partial/complete, light/dark, RTL/LTR/mixed, dense/scrolled, 390 px, 200% zoom, reduced motion                                                                                      |
| Selected-text card | Copy and dismiss plus direction isolation                                                                                                                                              | LTR/RTL/mixed result and no host-page style disruption                                                                                                                                             |

Exploratory scenarios: deny exact-origin permission then retry through the ordinary manual guidance; inspect long mixed-direction content at narrow layout and 200% zoom.

## Baseline findings from running extension

The pre-change managed run passed three browser scenarios and produced `artifacts/milestone-1-visual-baseline/` screenshots.

### Strengths preserved

- Clear explicit Translate action, progress counts, exact-original restoration, and partial continuation.
- Original/Translated pressed-state mode switch and zero-call session reuse.
- Change-scan, update, translated-copy, and comparison recovery controls remain available.
- Technical details are already disclosed on demand and normalized.
- Comparison preserves semantic page structure, supports split/stacked layouts, and has substantial BiDi/motion/keyboard coverage.

### Evidence-backed problems

- In the 360 px completed/partial screenshots, session destinations, page-change action, optional permission prose, advanced actions, recovery, two notices, provider status, privacy notice, and footer compete in one visually similar column.
- Primary/secondary/destructive styling is implemented through screen-specific classes, while comparison has an independent button treatment; equivalent actions do not share a documented semantic hierarchy.
- Permission explanation appears as low-emphasis prose rather than a recognizable request context.
- The two informational notices use large cards with similar weight to the active session and recovery state.
- Tokens cover only a small color/radius set, leaving typography, spacing, surfaces, borders, focus, status surfaces, shadows, and control sizing implicit.
- Options has sensible grouping but no shared empty, field/help, or action hierarchy component.

No baseline screenshot showed horizontal overflow, clipped controls, overlapping labels, or broken mixed-direction content. The audit therefore favors foundation/consolidation over a behavioral redesign.

## Implemented response

- Added semantic light/dark tokens and shared typed primitives in `packages/ui`.
- Applied a consistent action hierarchy to popup, Options, and comparison.
- Reduced popup padding/rhythm while preserving 360 px width and all controls.
- Made comparison the primary session destination, separated translated-copy permission context, and kept refresh/end under disclosure.
- Converted notices/failure styling to semantic status treatment and fixed the popup privacy text token.
- Added shared form-field, empty-state, progress, segmented, permission, disclosure, and reduced-motion behavior.
- Expanded E2E assertions/screenshots for initial focus/fit, hierarchy, permission denial, provider outage, restricted page, Options, 200% comparison, and post-change overflow.

## Sign-off matrix

| Claim                                  | Functional check                                                                         | Visual/fit check                                                                            | Result                  |
| -------------------------------------- | ---------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- | ----------------------- |
| Clear compact popup hierarchy          | Roles/text/classes and full session/recovery flows                                       | 360 px no-session/complete/partial/changes/error/restricted screenshots; horizontal metrics | PASS - managed Chromium |
| Permission is explicit and recoverable | Exact-origin grant, isolated simulated denial/manual guidance, copy-ready acknowledgment | Permission denied and copy-ready screenshots                                                | PASS - managed Chromium |
| Shared semantic actions                | Variant assertions on popup/options/comparison                                           | Light/dark screenshots and close inspection                                                 | PASS - managed Chromium |
| Comparison remains capable             | Linked/unlinked, swap/reset, divider, copy, close, zero-call checks                      | Default/scrolled/dark/RTL/390/200% screenshots and overflow metrics                         | PASS - managed Chromium |
| Accessibility/BiDi do not regress      | Keyboard Tab/focus, pressed state, labels/live regions, direction assertions             | Visible focus, RTL/LTR/mixed, reduced motion, 200% inspection                               | PASS - managed Chromium |

## Final managed-browser evidence

`pnpm test:e2e` passed five scenarios on 2026-07-18. The suite functionally covered no-session, translating, incomplete-response recovery, partial/cancel/continue, complete, original/translated, no-change/changed/updated, exact-origin permission grant, isolated denial guidance, translated-copy readiness, comparison, provider outage/retry, restricted page, selection, saved reduced motion, keyboard focus, 390 px comparison, and 200% comparison.

The ignored `artifacts/milestone-1-visual-baseline/` evidence includes no-session, in-progress, complete, partial, change-result, provider-error, denial, copy-ready, restricted, dark/reduced-motion Options, default/dark/narrow/200% comparison, and RTL/LTR/mixed-direction captures. Visual inspection found no cropped controls, overlap, horizontal document overflow, color-only state, or broken direction ordering. Long popup states remain vertically scrollable by design.

## Explicit non-claims

- No formal screen-reader, contrast/high-contrast, 400% zoom, OS-level motion, branded-Chrome, or owner acceptance is claimed by managed Chromium.
- Screenshots are ignored evidence artifacts and are not product assets.
