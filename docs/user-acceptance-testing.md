# Local release-candidate user acceptance testing

This runbook is for the product owner. It tests the local mock workflow first and provides an optional, separately marked multi-provider path. It does not deploy, publish, upload, or create public resources.

## 1. Start and load the candidate

1. Open PowerShell in the repository and confirm `node --version` and `pnpm --version` meet the documented prerequisites.
2. Run `pnpm install`.
3. Run `pnpm local:test`. Expected: verification/build output completes, then the hidden backend reports `http://127.0.0.1:8787`, the mock provider, and the extension artifact directory.
4. Open `chrome://extensions`, enable Developer mode, choose **Load unpacked**, and select `artifacts/translation-extension-local-rc/extension`.
5. Pin Lingo Page. Open an ordinary HTTP(S) page containing headings, paragraphs, links, lists, an image, buttons, and a form. Do not use a banking, health, mailbox, payment, password-manager, or private admin page.
6. Open the popup. Expected: the header contains `LOCAL` and a version; Provider is `Mock`, Model is `mock-deterministic`, the connection row says `Mock - local backend`, and the page is ready or explains why it is unsupported.

If the backend does not become ready, stop and inspect `.local/api.stdout.log` and `.local/api.stderr.log`. Do not paste those files into chat before checking that they contain no sensitive data.

## 2. Core translation and recovery

7. Keep source on automatic detection and choose a target language. Click **Translate page**. Expected: progress moves through discovery/translation and eligible text changes to deterministic mock output; the page structure and styling remain intact.
8. Click links, focus controls, select text, and interact with the page. Expected: links, controls, images, formatting, and behavior still work. Provider output must appear as plain text, never injected markup.
9. Select **Original** in the View control. Expected: original eligible text returns exactly, the session and counts remain available, and no translation request occurs. Select **Translated** and repeat several times; expected: retained output reapplies instantly with no provider request.
10. Start a translation on a page with enough text to observe progress, then click **Cancel translation** after some sections finish. Expected: the popup states exactly how many sections were translated and how many remain; completed sections stay reusable in both views; **Continue remaining sections** processes only pending work.
11. While a translation is running, navigate or reload the tab. Expected: text from the previous navigation is not applied to the new page. A fresh translation may be started manually.
12. Add a visible paragraph through the page’s own UI or a dynamic test page while dynamic translation is enabled. Expected: newly eligible text is eventually translated. Disable **Translate dynamic content**, save, and repeat; expected: the new text stays original.

### Milestone 1 durable-session supplement

- Add and modify visible text through a safe synthetic page, then choose **Check for page changes**. Expected: new, modified, removed, reordered, and uncertain counts are clear; uncertain text stays original. **Update changed sections** sends only confident new or modified text.
- Choose **Open translated copy**. Expected: the same URL opens in another tab, confidently matched translations appear without provider requests, unmatched text remains original, and ending the source session does not change the copy.
- Choose **Open comparison**. Expected: aligned source/translation text appears in an extension page, keyboard Previous/Next works, copy controls copy only plain text, narrow and dark layouts remain readable, and source scripts/markup are not executed.
- Expand advanced actions and choose **Refresh translation**. Expected: a quota/cost confirmation appears before a full refresh. Cancel it once, then confirm on the deterministic mock page and verify the previous translation remains safe if replacement fails.
- Choose **End translation session** and cancel the confirmation. Expected: the session remains. Confirm the action on a second attempt; expected: exact originals return, the page session is removed, and global settings plus other tabs remain unchanged.

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
21. Stop the backend with `pnpm local:stop`, reopen the popup, and attempt a translation. Expected: the popup explains that the local service stopped responding, preserves completed counts, and offers **Retry connection**, **Continue after reconnecting**, and restore. Expand **Technical details** and copy diagnostics; expected: normalized code/count/request metadata only, with no page text, URL, key, token, cookie, header, stack, or provider body.
22. Run `pnpm local:mock` to restart the backend. Expected: the provider status returns to mock and a retry can translate again.
23. Open Options and verify the provider/model card reports Mock, its local data recipient, connection state, and privacy notice. Click **Download privacy-safe diagnostics**. Expected: a JSON file is downloaded with provider/model IDs, version, backend status, boolean settings, and counts only; it contains no endpoint, key, text, or URL.
24. Use keyboard navigation through popup controls and Options. Expected: focus is visible, controls have labels, and no action requires a mouse.

## 6. Optional real-provider path

25. If the owner has approved a local key test, copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars` and enter only the chosen provider's key, default model, and model allowlist. Never paste the key into chat, the extension, source, Git, a command line, screenshot, or diagnostic export.
26. Run `pnpm local:providers`. Expected: the helper reports the same loopback URL without printing any key. Options lists Mock plus only safely configured/enabled providers; every unconfigured provider is absent from selection and reported as unconfigured by `GET /v1/providers`.

- Request `GET http://127.0.0.1:8787/v1/health`. Expected: HTTP 200, the chosen provider is configured, and both the JSON body and `X-Request-ID` header contain a request ID.
- Request `GET http://127.0.0.1:8787/v1/providers`. Expected: HTTP 200 and the chosen provider is enabled/ready with only its allowlisted model metadata. No key or private custom endpoint is present.

27. Select the provider/model in Options and save. Verify its data recipient and privacy notice. Choose **Test selected provider**. Expected: the controlled tiny test reports normalized success/latency or a safe authentication/rate/quota/unavailable error without an upstream body.
28. Translate one non-sensitive test sentence. Record only success/failure, latency, provider/model IDs, normalized response category, and diagnostics metadata. No real provider is considered live-verified until the owner performs this step.
29. Stop the backend, remove the key/default/allowlist from `.dev.vars`, restart, and confirm the provider is no longer selectable. Run `pnpm local:mock` and confirm Mock remains visibly labeled.
30. Confirm `git status --short`, source, Git history, production bundle/source maps, ignored logs, diagnostics, and release-candidate artifacts contain no provider secret, authorization header, raw page content, upstream error body, or private custom endpoint.

- Confirm `.dev.vars.example` still contains blank placeholders only; real values belong exclusively in ignored `.dev.vars`.

## 7. Provider failure and routing safety

31. Set a selected provider to disabled with `DISABLED_PROVIDERS`, restart, and confirm translation fails clearly or the provider is no longer selectable. It must not silently use another provider.
32. Configure an invalid/non-allowlisted model in extension storage only through a synthetic test. Expected: the backend rejects it; it never forwards the invented model upstream.
33. In mocked tests, verify malformed JSON, Markdown fences, missing/duplicate/unknown IDs, refusal/truncation, lost placeholders, markup insertion, excessive expansion, and partial batches fail safely.
34. Run `pnpm provider:benchmark -- <provider-id> --confirm-live` only when the owner explicitly accepts external transmission and cost. Review qualitative output separately with `docs/provider-benchmark-human-review.md`; automated checks must not be described as objective quality.

## Evidence and issue reporting

For every failed step record: step number, expected result, actual result, OS, managed Chromium or branded Chrome, browser version, extension version, provider mode, and timestamp. Attach screenshots of UI state, not page content. Include `.local` log excerpts only after redaction. The diagnostics export is safe to review but should still be shared intentionally.

Known boundaries are listed in `docs/known-limitations.md`. Approval of this checklist is required before any deployment, public hosting, store submission, provider provisioning, or production identity work.
