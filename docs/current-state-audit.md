# Current-state audit

Audit date: 2026-07-15

## Result

The repository now contains a complete local translation MVP and a reproducible local release-candidate workflow. The extension, local API, deterministic provider, secure real-provider adapter, settings, selected-text flow, diagnostics UX, tests, and owner documentation are implemented. Production deployment and public distribution were not authorized and were not performed.

## Verified implementation

| Area             | Current state                                                                                                                                                                      |
| ---------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Workspace        | pnpm 11 monorepo, strict TypeScript, pinned lockfile, ESLint, Prettier, Vitest, Playwright, WXT, and Wrangler.                                                                     |
| Extension access | MV3 with `activeTab`, `contextMenus`, `scripting`, and `storage`; no `<all_urls>`; local API is the only production-build host permission.                                         |
| DOM safety       | Eligible text nodes only; code/forms/hidden/notranslate/extension UI excluded; translated output assigned as text; exact originals retained in the page session.                   |
| Session safety   | Cryptographic request/session IDs, validated messages, tab-scoped injection, cancellation, navigation identity, response reconciliation, and stale-session rejection.              |
| Dynamic pages    | Debounced MutationObserver, self-mutation guards, new-node translation, and restoration of tracked originals.                                                                      |
| Backend          | Health, languages, translation, detection, and usage routes; body/segment/character bounds; CORS/security headers; rate/quota controls; safe error normalization.                  |
| Providers        | Deterministic mock enabled locally; DeepL endpoint/key fixed server-side, token protection/restoration, timeout/abort, response validation, and mocked adapter tests.              |
| Privacy          | Explicit activation, no browsing-history collection, no persistent text cache by default, privacy-mode cache disable and sensitive-page block, exclusions, and clear-cache action. |
| UI               | Popup progress/start/cancel/restore, source/target settings, warning/error/connection states, options controls, glossary, and selection result/copy flow.                          |

## Verification summary

- Formatting, lint, strict typecheck, 28 unit tests, 8 API integration tests, production extension build, Worker dry-run build, and managed-Chromium E2E pass.
- Managed Chromium exercises explicit translation, excluded content, form-value safety, dynamic insertion, cancellation, exact restoration, selected-text overlay, popup connectivity, and options rendering.
- Generated production manifest and bundled JavaScript are included in the permission/secret audit. The fixture host permission appears only in `.output/chrome-mv3-e2e`.

## Remaining release work

- No real provider credential was available, so a live DeepL request is unverified. The adapter is covered with mocked upstream responses.
- Installed branded Chrome 150 did not honor command-line unpacked-extension loading during automation; managed Playwright Chromium passed. Manual branded-Chrome steps are in `docs/local-development.md`.
- Production identity, durable usage accounting, deployment, public privacy terms, store assets/review, broad performance profiling, and non-Chrome platforms remain future milestones.
- Owner acceptance of `docs/user-acceptance-checklist.md` is still pending. The local RC artifact is ignored and must not be uploaded or published.
