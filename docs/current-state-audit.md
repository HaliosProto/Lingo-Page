# Current-state audit

Audit date: 2026-07-15

## Executive summary

The project began as a documentation-only Milestone 0 baseline and now contains an in-progress Milestone 1 monorepo foundation. Git is initialized with one clean documentation baseline commit (`05a4637`). The workspace has no real provider secrets or local environment files. The current implementation is a shell: translation routes are deliberately unimplemented, the content script only answers a validated ping, and the popup accurately disables page translation.

The architecture is directionally correct and retained, but the implementation must be completed before any MVP claim. The immediate quality gate has lint and strict TypeScript passing; the first API integration test exposed that response security headers were not retained by Hono middleware. That defect has been corrected and is being reverified.

## Findings

| Classification       | Finding                                                                                                                                                                | Resolution                                                                                                               |
| -------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------ |
| Correct and retained | WXT + React + MV3, Cloudflare Workers + Hono, pnpm workspaces, Zod validation, provider-independent core, and text-node mutation are appropriate.                      | Retain.                                                                                                                  |
| Correct and retained | Provider credentials are backend-only and client configuration contains only the API origin.                                                                           | Retain and verify in source/bundle scans.                                                                                |
| Correct and retained | Git history starts with the completed Milestone 0 documentation baseline.                                                                                              | Preserve; do not rewrite.                                                                                                |
| Clarification needed | Earlier documents describe Milestone 1 stopping points, while the latest ownership brief authorizes continuous implementation through the local MVP.                   | Treat the latest brief as the execution authority and update living documents to actual final state.                     |
| Important omission   | No complete page translation session, cancellation, restoration, dynamic-content, selected-text, settings/privacy/cache/glossary, or real provider adapter exists yet. | Implement and test.                                                                                                      |
| Important omission   | API translation, detection, usage, development authentication, quotas, rate limits, and provider validation are placeholders.                                          | Implement secure mock-mode paths and a credential-gated real adapter.                                                    |
| Security concern     | The API shell initially rebuilt the response after `next()`, causing security/request-ID headers to be dropped under Hono tests.                                       | Set headers on the Hono context before route execution and verify on every response.                                     |
| Security concern     | Development CORS permits Chrome-extension origins by scheme. This is not authentication.                                                                               | Keep development-only, require a development bearer token for translation, and use exact extension IDs in production.    |
| Privacy concern      | Translation content must never be sent before explicit activation; existing shell does not send text.                                                                  | Preserve and add browser network assertions.                                                                             |
| Implementation risk  | MV3 service-worker memory is ephemeral.                                                                                                                                | Keep authoritative page-session data in the content script; persist only non-sensitive settings and coarse tab status.   |
| Implementation risk  | WXT runtime content-script injection must be tested against generated output paths and restricted pages.                                                               | Cover with Playwright and manifest inspection.                                                                           |
| Testing gap          | Current fixtures cover only the shell.                                                                                                                                 | Add deterministic DOM, dynamic, SPA, RTL, selection, cancellation, restore, API-failure, and large-page fixtures/tests.  |
| Testing gap          | Browser verification has not yet succeeded.                                                                                                                            | Use installed Chrome through Playwright persistent context; document any remaining manual-only checks.                   |
| Deferred decision    | Live provider verification depends on an externally supplied backend credential.                                                                                       | Implement and test the adapter contract with mocked upstream responses; run live smoke test only if a credential exists. |

## Environment

- Git repository: initialized, branch `main`, baseline commit `05a4637`.
- Node.js: project supports Node 24.14 or newer; direct shell reports a compatible Node 24 runtime.
- pnpm: 11.7.0 with a lockfile and approved native build dependencies.
- Chrome: installed at `C:\Program Files\Google\Chrome\Application\chrome.exe`.
- Wrangler/WXT/Playwright: installed as project-local dependencies.
- Secrets: no `.env`, `.env.local`, `.dev.vars`, private-key, or provider-key files found outside ignored dependencies.

## Corrective priorities

1. Finish the green foundation gate and commit it.
2. Replace shell translation contracts with session-aware request/response schemas.
3. Implement deterministic translation core, DOM engine, page sessions, cancellation, restoration, and dynamic updates.
4. Implement protected backend translation/detection/usage routes and a DeepL adapter behind mock mode.
5. Implement selected text, settings, privacy controls, caching, and glossary.
6. Complete browser, performance, security, secret, and bundle verification before final documentation.
