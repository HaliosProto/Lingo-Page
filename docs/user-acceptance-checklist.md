# Local owner acceptance checklist

Run `pnpm local:test`, load `artifacts/translation-extension-local-rc/extension` as an unpacked extension, and keep the API at `http://127.0.0.1:8787` running.

- [ ] Popup shows `LOCAL`, a version, and `Mock mode - local backend`.
- [ ] An ordinary HTTP(S) page reports ready and translates only eligible visible text.
- [ ] Links, images, controls, forms, layout, and page behavior remain intact.
- [ ] Restore returns the original text exactly.
- [ ] Checking for new or changed content always shows no-change, changes-found, updated, or retryable-error feedback and makes no translation request until Update/Refresh is chosen.
- [ ] Open translated copy explains the site-access need, requests only the current HTTP(S) origin from the click, and never requests all-site access; grant, denial, already-granted, redirect, and revocation behavior is correct.
- [ ] One translated-copy tab remains open on success and reuse failure; after bounded hydration its final ready DOM, summary, cached matches, original fallbacks, zero-provider-call reuse, and independence from the source are correct.
- [ ] Comparison defaults to a 50/50 full-page Original/Translation split; linked/unlinked scrolling, divider keyboard/pointer control, Reset, Swap, narrow layout, themes, reduced motion, and 200% zoom remain usable.
- [ ] Cancel stops work without applying stale or partial unsafe replacements.
- [ ] Progress reports discovery and translation state; failure shows a retry action.
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

Record any failure with the exact step, expected result, actual result, browser/channel, extension version, and the diagnostics file if safe to share. Do not attach page text, full URLs, cookies, form values, or secrets.
