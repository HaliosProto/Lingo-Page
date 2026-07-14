# Browser compatibility plan

## Initial support

Chrome/Chromium Manifest V3 is the only release target for the MVP. The extension must handle normal HTTP(S) pages and clearly reject browser-internal pages, Web Store pages, settings, inaccessible frames, unsupported viewers, and other restricted contexts.

Managed Playwright Chromium passes the local MVP workflow. Installed branded Chrome 150 is available for manual unpacked loading, but its command-line behavior did not load the unpacked extension during automation; this is documented as a manual release check rather than represented as automated evidence.

## Compatibility layers

- Use WXT/browser-polyfill conventions for APIs.
- Keep browser API calls behind a small adapter in `apps/extension`.
- Keep translation-core DOM APIs standards-based and free of Chrome types.
- Keep message schemas browser-neutral.
- Avoid reliance on a single browser's shadow-DOM or iframe behavior for core translation.
- Record browser version, manifest version, and compatibility category in diagnostics, not page content.

## Future targets

Firefox and Safari require separate permission, service-worker, content-script, storage, packaging, and review validation. The roadmap must not assume Chrome MV3 behavior is identical across those browsers. Desktop/mobile features use the same translation-core and API contracts but require platform-specific capture/accessibility/input boundaries.

Sources: [Chrome content scripts](https://developer.chrome.com/docs/extensions/develop/concepts/content-scripts), [Chrome message passing](https://developer.chrome.com/docs/extensions/develop/concepts/messaging), [Chrome activeTab](https://developer.chrome.com/docs/extensions/develop/concepts/activeTab), [MDN WebExtension content scripts](https://developer.mozilla.org/en-US/docs/Mozilla/Add-ons/WebExtensions/Content_scripts).
