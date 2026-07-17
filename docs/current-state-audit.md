# Current-state audit

Audit date: 2026-07-18 (reconciled post-MVP program baseline)

## Result

The repository contains a substantial local translation MVP and release-candidate workflow. “Complete” applies only to the implemented credential-independent local scope: lifecycle durability, broad performance, formal accessibility/BiDi, production identity/quotas, live-provider qualification, owner acceptance, deployment, and publication remain open. The authoritative forward program is `ROADMAP.md`.

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

## 2026-07-18 program audit additions

- The 24-stage lifecycle and state-survival gaps are documented in `docs/current-architecture-audit.md`.
- Managed Chromium now has a reproducible deterministic performance baseline through 2,200 synthetic nodes; branded visual/lifecycle evidence remains open.
- The ordinary defensive baseline found one confirmed context-construction code path and several plausible hardening gaps; none was treated as an exploited or confirmed high-severity vulnerability.
- Current governing status remains: mock is the verified default and no live real-provider call is presently reproducible from this workspace without external credentials/approval. Dated historical claims are not current evidence.
- Spec Kit CLI integration is pending missing official tools/network approval; the repository workflow itself is active.
