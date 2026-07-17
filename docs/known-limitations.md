# Known limitations

This local release candidate is intentionally bounded. These are known limitations, not promises for the public product.

- Mock mode is the verified default. It is deterministic and visibly marked; it does not measure real provider quality.
- Real providers are backend-only and require separate accounts, keys, default models, and model allowlists. No live real-provider call has been made in this workspace; protocol conformance is covered with mocked boundaries.
- Compatible APIs change over time. Base URLs were verified on 2026-07-15, but provider model behavior and JSON-mode support still require owner-run smoke tests before reliance.
- Model discovery is optional, explicit, cached, and allowlist-filtered. It does not automatically enable newly listed models or determine translation quality.
- There is no production identity, account, durable quota, billing, or multi-user authorization model yet. Local development auth is intentionally limited to the loopback helper; staging and production require authentication.
- Automated browser coverage uses the managed Chromium runtime. Branded Chrome must be tested manually and is reported separately.
- Translation is conservative: browser-internal pages, the Web Store, excluded domains, sensitive pages in privacy mode, passwords, payment/security fields, editable controls, code, scripts, styles, hidden content, numeric-only strings, URLs, and extension-owned UI are excluded.
- Only eligible visible text nodes in the top-level page are handled. Shadow DOM, canvas-rendered text, images, cross-origin frames, and iframe contents are not translated by this MVP.
- The local API quota and rate counters are process-local and reset when the worker restarts. They are not an enforcement boundary for production.
- The custom compatible provider restricts configuration to backend-controlled HTTPS public or loopback URLs, but it is an advanced local feature and is not a general-purpose proxy.
- Page-owned sessions support repeated views, changed-only updates, copy isolation, and comparison while the content script remains alive. Full service-worker/browser restart, sleep/wake, reload reconstruction, and complex SPA navigation persistence are intentionally deferred.
- The diagnostics export is intentionally limited to operational metadata and counts. It is not a crash dump or a full browser trace.
- Deployment, store publication, public hosting, provider-key provisioning, and branded-Chrome approval are out of scope for this milestone and require explicit owner approval.
- Eligibility now rejects inherited/variant editability and hidden ancestors, and request context excludes descendant text; broad real-site and shadow-DOM coverage remains incomplete.
- Provider response bodies are not independently size-bounded and the provider timeout scope currently ends before JSON body consumption; validate and harden in a narrow task.
- Production dependency advisories could not be refreshed while external registry access was prohibited; prior clean audits are dated historical evidence.
- Managed Chromium screenshots cover completed, retained-original, reapplied, partial, changed, copied, dark, and narrow comparison states. Interactive browser inspection was unavailable in this session; branded-Chrome console/network, screen-reader, zoom/contrast, and owner acceptance remain unverified.
- Saved reduced motion now applies in popup, Options, and comparison surfaces and is covered in managed Chromium; OS-level and branded-Chrome visual confirmation remain manual.
- Chromium heap snapshots are not leak proof. The very-large final-original snapshot remained elevated without forced collection; repeatable GC-aware lifecycle profiling remains a dedicated follow-up.
- Comparison handoff is single-use. Reload before retrieval, service-worker failure during handoff, mismatched navigation, oversized sessions, or invalid data fail closed instead of reconstructing the session.
