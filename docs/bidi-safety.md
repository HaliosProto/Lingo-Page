# Bidirectional-text safety

## Why this is safety-critical

Mixed Persian/Arabic/Hebrew and Latin text can reorder URLs, numbers, punctuation, identifiers, and controls in ways that change meaning or cause a user to copy the wrong value. Direction is therefore part of translation correctness, not cosmetic localization.

## Current state and risks

- Popup and Options roots use `dir="auto"`; independent comparison source/translation paragraphs now establish their own direction, while host-page translated Text nodes still inherit the page element context.
- Logical CSS and Milestone 1 fixtures cover Persian/English, Arabic numerals, Hebrew URLs, table cells, a list, and a button; the complete form/clipboard/browser matrix remains unfinished.
- Provider output is inserted as plain text, preserving XSS safety. The extension does not alter unrelated host direction attributes.
- Exact text restoration is implemented; direction-related DOM attributes are not currently added, so restore does not need to unwind them.
- Comparison copy uses the exact logical string, but automated clipboard equality, table cells, selection-card direction, screen-reader order, and branded-browser differences remain unverified.

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

Popup content and comparison pairs use content-boundary `dir="auto"`; comparison text uses `unicode-bidi: plaintext` and logical layout without changing stored/copied strings or host ancestors. Managed Chromium covers English to Persian, Persian to English, Arabic with Arabic numerals, Hebrew with a URL, technical model numbers, Persian digits, a list, table cells, a button, original/translated switching, copy-tab application, dark theme, and narrow comparison. Clipboard equality, screen-reader order, zoom, high contrast, broader forms, and branded Chrome remain manual release evidence.
