# Known limitations

This local release candidate is intentionally bounded. These are known limitations, not promises for the public product.

- Mock mode is the verified default. It is deterministic and visibly marked; it does not measure real provider quality.
- DeepL is an optional backend-only adapter. It requires a local `DEEPL_API_KEY`, has not been live-verified in this workspace, and is not available to the extension except through the loopback API.
- There is no production identity, account, durable quota, billing, or multi-user authorization model yet. Local development auth is intentionally limited to the loopback helper; staging and production require authentication.
- Automated browser coverage uses the managed Chromium runtime. Branded Chrome must be tested manually and is reported separately.
- Translation is conservative: browser-internal pages, the Web Store, excluded domains, sensitive pages in privacy mode, passwords, payment/security fields, editable controls, code, scripts, styles, hidden content, numeric-only strings, URLs, and extension-owned UI are excluded.
- Only eligible visible text nodes in the top-level page are handled. Shadow DOM, canvas-rendered text, images, cross-origin frames, and iframe contents are not translated by this MVP.
- The local API quota and rate counters are process-local and reset when the worker restarts. They are not an enforcement boundary for production.
- Navigation/session safety is implemented, but route changes in complex single-page applications can require a fresh user action. Dynamic observation is bounded and may leave newly added content untranslated when a page is unusually busy.
- The diagnostics export is intentionally limited to operational metadata and counts. It is not a crash dump or a full browser trace.
- Deployment, store publication, public hosting, provider-key provisioning, and branded-Chrome approval are out of scope for this milestone and require explicit owner approval.
