# Local owner acceptance checklist

Run `pnpm local:test`, load `artifacts/translation-extension-local-rc/extension` as an unpacked extension, and keep the API at `http://127.0.0.1:8787` running.

- [ ] Popup shows `LOCAL`, a version, and `Mock mode - local backend`.
- [ ] An ordinary HTTP(S) page reports ready and translates only eligible visible text.
- [ ] Links, images, controls, forms, layout, and page behavior remain intact.
- [ ] Restore returns the original text exactly.
- [ ] Checking for new or changed content always shows no-change, changes-found, updated, or retryable-error feedback and makes no translation request until Update/Refresh is chosen.
- [ ] Open translated copy explains the site-access need, requests only the current HTTP(S) origin from the click, and never requests all-site access; grant, denial, already-granted, redirect, and revocation behavior is correct.
- [ ] On a site without a prior grant, one **Open translated copy** click plus one approval opens exactly one destination even if the popup closes; denial opens none and is not immediately prompted again.
- [ ] One translated-copy tab remains open on success and reuse failure; after bounded hydration its final ready DOM, summary, cached matches, original fallbacks, zero-provider-call reuse, and independence from the source are correct.
- [ ] Comparison defaults to a 50/50 full-page Original/Translation split; linked/unlinked scrolling, divider keyboard/pointer control, Reset, Swap, narrow layout, themes, reduced motion, and 200% zoom remain usable.
- [ ] Cancel stops work without applying stale or partial unsafe replacements.
- [ ] On the Lionel Messi Wikipedia article with the configured Gemini model, an incomplete batch automatically preserves valid records, retries unresolved IDs in smaller groups, continues the later queue, and finishes or reports a minimal honest unresolved set without repeated user retry clicks.
- [ ] Recovery progress reports translated, remaining, retrying, failed, and queued counts; final exhaustion offers Retry unresolved sections, Change provider, and Keep partial translation.
- [ ] Dynamic content is translated when enabled and remains untouched when disabled.
- [ ] Selected text produces an isolated copyable result card.
- [ ] Persian/RTL output preserves readable direction and layout.
- [ ] Sensitive-page protection, domain exclusions, and privacy mode block or warn as documented.
- [ ] Password, payment, security, editable, code, script, style, hidden, and extension-owned content is excluded.
- [ ] Glossary terms are applied; clearing cache removes local translated-text entries.
- [ ] Light, dark, system, reduced-motion, and keyboard workflows behave as expected.
- [ ] Options shows backend/provider status and downloads privacy-safe diagnostics.
- [ ] Diagnostics contain no page text, URLs, tokens, cookies, or authorization headers.
- [ ] Stopping the backend produces a clear unavailable state; restarting permits retry.
- [ ] `pnpm verify` and `pnpm test:e2e` pass; managed Chromium and branded Chrome results are recorded separately.
- [ ] Source, Git history, production bundle, source maps, logs, env files, and staged RC contain no provider key.
- [ ] Reload a completed and partial translated page; confirm confident text is restored, changed/uncertain text remains original, and the network shows zero reconstruction provider calls.
- [ ] Suspend/restart the extension worker where Chrome tooling permits; confirm popup state reconstructs and no duplicate tab or provider attempt appears.
- [ ] Exercise SPA navigation, root hydration, infinite-scroll/mutation bursts, offline/reconnect, Retry-After, cancellation, expiry, tab close, and privacy-mode cleanup.
- [ ] Confirm required permissions are limited to `activeTab`, `alarms`, `contextMenus`, `scripting`, `sessions`, and `storage`; there is no required `<all_urls>`; recovery storage contains no raw source text, HTML, title, full URL, form value, credential, or provider body.

## Milestone 2 browser-restart acceptance retest

Load the unpacked production extension from `D:\Chat GPT Projects\Translation Extension + App - M2\apps\extension\.output\chrome-mv3`. Use a normal non-sensitive HTTP(S) page and approve only that current origin when Translate explains restart recovery. For each test record Chrome version, extension commit, build path, time, whether the backend was running, provider-call count/delta, result, visible status, and any console error.

### Test A — Same-tab reload

1. Translate the page.
2. Press Ctrl+R.
3. Confirm cached translated state restores and Original/Translated switching works.
4. Confirm no new full translation or provider request starts.

### Test B — Browser restart with Continue where you left off

1. Translate the page and do not click End session.
2. Close Chrome completely with the translated tab open.
3. Reopen Chrome with Continue where you left off.
4. Confirm the restored page recovers cached translations, changed/uncertain sections remain original, and provider-call delta is zero.

### Test C — Recently closed tab

1. Translate the page and do not click End session.
2. Close the tab.
3. Restore it promptly with Ctrl+Shift+T.
4. Confirm a new tab ID can own the recovered session, Original/Translated switching works, and provider-call delta is zero.

### Test D — Manual History safety

1. Keep one translated page/session active.
2. Open the same URL manually from History, a pasted address, or a normal second tab.
3. Confirm the new tab remains original and does not steal or inherit the active translation.

### Test E — Competing candidates

1. Create two otherwise compatible restore candidates for one orphaned session.
2. Confirm at most one can claim it; if Chrome evidence is ambiguous, both must remain original.

The previous branded-Chrome restart/Ctrl+Shift+T result at `fa2135b` is **FAIL**. Do not mark branded-Chrome acceptance passed until the owner completes and reports Tests A-E on the corrected commit.

Record any failure with the exact step, expected result, actual result, browser/channel, extension version, and the diagnostics file if safe to share. Do not attach page text, full URLs, cookies, form values, or secrets.

## Milestone 3 translation-intelligence checks

- [ ] Default policy translates naturally without configuration and reports one translation call per clean batch and zero review calls.
- [ ] Options saves a bounded translation brief and formal/casual/technical preferences; the popup summarizes a non-default active policy.
- [ ] Global and exact-site glossary entries apply only where relevant; preserve-exact values, URLs, emails, numbers, product/model codes, formulas, and identifiers remain byte-correct.
- [ ] A prompt-injection fixture is translated as content and cannot change target language, IDs, schema, recipient, or output behavior.
- [ ] Malformed/partial structured output preserves valid siblings and retries unresolved IDs only.
- [ ] A deterministic warning identifies the flagged section; automatic review makes at most one selected-ID call; on-demand review reviews flagged IDs only; reviewer failure preserves the original safe result.
- [ ] Same-policy cache reuse works; changing target, formality, brief, relevant glossary, or context requires retranslation; theme/reduced-motion changes do not.
- [ ] Translation brief, glossary, disclosure, quality warning, and review controls work by keyboard at 200% zoom in light/dark, RTL/LTR, mixed-direction, reduced-motion, and 390-pixel popup/600-pixel Options layouts.
- [ ] Popup, Options, source page, service worker, API output, network, and storage contain no raw provider body, secret, form value, full URL, or unexpected page-text log.

Live-provider smoke checks are optional and require explicit authorization, backend-only credentials, synthetic text, and a report that records provider/model/date/mode/call counts/schema/recovery/human observations without raw private page content.
