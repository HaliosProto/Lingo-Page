# Bidirectional-text safety

## Why this is safety-critical

Mixed Persian/Arabic/Hebrew and Latin text can reorder URLs, numbers, punctuation, identifiers, and controls in ways that change meaning or cause a user to copy the wrong value. Direction is therefore part of translation correctness, not cosmetic localization.

## Current state and risks

- Popup and Options roots use `dir="auto"`; independent full-page comparison panes establish source/target direction and each text unit uses plaintext isolation, while host-page translated Text nodes still inherit the page element context.
- Logical CSS and Milestone 1 fixtures cover Persian/English, Arabic numerals, Hebrew URLs, table cells, a list, and a button; the complete form/clipboard/browser matrix remains unfinished.
- Provider output is inserted as plain text, preserving XSS safety. The extension does not alter unrelated host direction attributes.
- Exact text restoration is implemented; direction-related DOM attributes are not currently added, so restore does not need to unwind them.
- Comparison rendering preserves the exact logical string and independently covers LTR source/RTL translation and RTL source/LTR translation. Automated clipboard equality, selection-card direction, screen-reader order, and branded-browser differences remain unverified.

## Milestone 3 mixed-direction policy data

Translation briefs, glossary source/target values, active-policy summaries, and quality text use `dir="auto"` or content-bound direction. Logical CSS remains mandatory. URLs, emails, product/model codes, formulas, numbers, placeholders, and identifiers are protected and restored as exact plain text rather than reversed or normalized for display.

The compiler never changes string direction or places protected Latin tokens into privileged instructions. Persian/Arabic translation with Latin identifiers must preserve copied code points, while visual isolation remains a UI/host-text boundary responsibility. Managed fixtures cover RTL preferences, mixed glossary rows, protected technical identifiers, narrow layout, dark/light, and 200% zoom; clipboard equality and formal screen-reader order remain manual gates.

## BiDi Safety Engine contract

1. Determine direction per independent content unit from language metadata plus first-strong fallback; never infer security-sensitive semantics from appearance alone.
2. Keep UI chrome direction separate from source text and translated text.
3. Isolate unknown or opposite-direction runs with semantic containers (`bdi`/`dir="auto"`) or CSS `unicode-bidi: isolate`; avoid directional control characters in stored/copied text.
4. Use logical CSS properties and explicit alignment tokens.
5. Preserve the exact underlying string for copy, export, restore, IDs, URLs, email, file paths, product codes, model numbers, dates, currencies, percentages, hashtags, usernames, and phone numbers.
6. Do not mutate host-page structure solely to improve direction without a proven reversible strategy.

## Fixture matrix

Persian with English terms; Arabic with Arabic/Latin digits; Hebrew with URLs; parentheses/brackets and punctuation; currencies/percentages/dates; email/usernames/hashtags/phones; product/model codes; code/file paths; tables; buttons/forms; chat bubbles; subtitles; and image-overlay labels. Each runs in LTR and RTL page contexts with LTR and RTL UI chrome.

## Clipboard and accessibility

Copied text must equal the logical string without invisible directional controls added by the extension. Accessible names and reading order must match the visual control order; source and translation need explicit language/direction metadata where known. Screen-reader tests must include mixed numerals, links, and punctuation.

## Browser and visual verification

Run deterministic screenshots and DOM assertions in managed Chromium, then manual passes in supported branded Chrome and future Firefox/Safari targets. Compare visual order, caret/selection, copy/paste, truncation, focus outline, zoom, and high-contrast behavior.

## Release-blocking acceptance

No critical identifier is visually reordered ambiguously; source/translation containers isolate direction; logical copy is exact; keyboard/screen-reader order is coherent; all fixture categories pass at supported zoom/theme states; restore is exact; and browser-specific deviations are documented with safe fallbacks.

## Milestone 1 implementation status

Popup content and both comparison documents use content-boundary direction; comparison text uses `unicode-bidi: plaintext` and logical layout without changing stored strings or host ancestors. Managed Chromium covers English to Persian, Persian to English, Arabic with Arabic numerals, Hebrew with a URL, technical model numbers, Persian digits, lists, table cells, buttons, original/translated switching, copy-tab application, light/dark themes, 200% zoom, and narrow stacked comparison. Clipboard equality, screen-reader order, 400% zoom, high contrast, broader forms, and branded Chrome remain manual release evidence.

Milestone 2 recovery messages use `dir="auto"` and never transform stored strings. Reconstruction restores the existing translated text and current DOM originals byte-for-byte, so mixed-direction identifiers, URLs, numbers, tables, and lists follow the established M1 BiDi boundaries. The existing managed Chromium BiDi matrix remains passing; no new string-reversal or physical-direction CSS was added.
