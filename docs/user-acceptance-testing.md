# Local release-candidate user acceptance testing

This runbook is for the product owner. It tests the local mock workflow first and provides an optional, separately marked DeepL path. It does not deploy, publish, upload, or create public resources.

## 1. Start and load the candidate

1. Open PowerShell in the repository and confirm `node --version` and `pnpm --version` meet the documented prerequisites.
2. Run `pnpm install`.
3. Run `pnpm local:test`. Expected: verification/build output completes, then the hidden backend reports `http://127.0.0.1:8787`, the mock provider, and the extension artifact directory.
4. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `artifacts/translation-extension-local-rc/extension`.
5. Pin Lingo Page. Open an ordinary HTTP(S) page containing headings, paragraphs, links, lists, an image, buttons, and a form. Do not use a banking, health, mailbox, payment, password-manager, or private admin page.
6. Open the popup. Expected: the header contains `LOCAL` and a version; the connection row says `Mock mode - local backend`; the page is ready or explains why it is unsupported.

If the backend does not become ready, stop and inspect `.local/api.stdout.log` and `.local/api.stderr.log`. Do not paste those files into chat before checking that they contain no sensitive data.

## 2. Core translation and recovery

7. Keep source on automatic detection and choose a target language. Click **Translate page**. Expected: progress moves through discovery/translation and eligible text changes to deterministic mock output; the page structure and styling remain intact.
8. Click links, focus controls, select text, and interact with the page. Expected: links, controls, images, formatting, and behavior still work. Provider output must appear as plain text, never injected markup.
9. Click **Restore original page**. Expected: original eligible text returns exactly and the page remains usable.
10. Start a translation on a page with enough text to observe progress, then click **Cancel translation**. Expected: progress becomes cancelled or partial, no stale session applies later, and restore remains available.
11. While a translation is running, navigate or reload the tab. Expected: text from the previous navigation is not applied to the new page. A fresh translation may be started manually.
12. Add a visible paragraph through the page’s own UI or a dynamic test page while dynamic translation is enabled. Expected: newly eligible text is eventually translated. Disable **Translate dynamic content**, save, and repeat; expected: the new text stays original.

## 3. Selection, language, and glossary

13. Select a short sentence, open the context menu, and choose **Translate selected text**. Expected: an extension-owned isolated result card appears with copyable text; the source page DOM is not replaced.
14. Choose Persian as the target and translate a page. Expected: output remains readable in RTL context and the original layout is not rebuilt.
15. In Options, add a glossary entry such as `Hello` to a preferred term, save, and translate text containing that term. Expected: the configured term is preserved/applied according to its settings. Remove it afterward if it should not remain in the owner profile.

## 4. Privacy and exclusions

16. In Options, add the test hostname to **Excluded domains**, save, reload that domain, and open the popup. Expected: the popup explains that the domain is excluded and translation cannot start. Remove the exclusion afterward.
17. Enable privacy mode and open a synthetic or clearly non-sensitive test URL whose path contains `login`, `account`, `health`, `mail`, or `payment`. Expected: the popup warns or blocks according to the current page classification. Do not test with real private data.
18. On a safe test page, inspect password, payment/security, editable, code, script, style, hidden, numeric-only, URL-like, and extension-owned regions. Expected: these remain original and are not sent for translation.
19. Enable persistent cache on a safe test page, translate, use **Clear translation cache**, and export diagnostics. Expected: translated text is cleared; diagnostics report counts/status only and contain no text or URLs.

## 5. UX, recovery, and diagnostics

20. Use Options to switch light, dark, and system themes and toggle reduced motion. Expected: the setting is visible immediately or after save, with readable contrast and no required animation.
21. Stop the backend with `pnpm local:stop`, reopen the popup, and click **Retry** after attempting a translation. Expected: an unavailable state is clear and no translation is applied.
22. Run `pnpm local:mock` to restart the backend. Expected: the provider status returns to mock and a retry can translate again.
23. Open Options and verify the Local backend card reports the provider category. Click **Download privacy-safe diagnostics**. Expected: a JSON file is downloaded with version, backend status/provider, boolean settings, and counts only.
24. Use keyboard navigation through popup controls and Options. Expected: focus is visible, controls have labels, and no action requires a mouse.

## 6. Optional DeepL path

25. If the owner has approved a local key test, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and enter the key only in `DEEPL_API_KEY`. Never paste the key into chat, the extension, source, Git, or a command line.
26. Run `pnpm local:deepl`. Expected: the helper reports the same loopback URL without printing the key; Options says `DeepL via local backend`.
27. Translate one non-sensitive test sentence. Record only success/failure, latency, provider response category, and diagnostics metadata. This live-provider result remains unverified until the owner performs it.
28. Remove the local key file after testing if it is no longer needed. Confirm `git status --short`, source/bundle searches, and logs show no secret.

## Evidence and issue reporting

For every failed step record: step number, expected result, actual result, OS, managed Chromium or branded Chrome, browser version, extension version, provider mode, and timestamp. Attach screenshots of UI state, not page content. Include `.local` log excerpts only after redaction. The diagnostics export is safe to review but should still be shared intentionally.

Known boundaries are listed in `docs/known-limitations.md`. Approval of this checklist is required before any deployment, public hosting, store submission, provider provisioning, or production identity work.
