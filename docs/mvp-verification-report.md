# Local MVP verification report

Date: 2026-07-15

## Automated evidence

| Check           | Result | Evidence                                                                                                                           |
| --------------- | ------ | ---------------------------------------------------------------------------------------------------------------------------------- |
| Formatting      | Pass   | `pnpm format:check`                                                                                                                |
| Lint            | Pass   | `pnpm lint`                                                                                                                        |
| Strict types    | Pass   | `pnpm typecheck` across shared packages, API, and extension                                                                        |
| Unit tests      | Pass   | 28 tests across configuration, validation, translation core, and provider adapters                                                 |
| API integration | Pass   | 8 tests for health, languages, translation, malformed input, detection, auth, errors, and CORS                                     |
| Browser E2E     | Pass   | Managed Chromium: page translation, exclusions, form safety, dynamic text, cancellation, restore, selection result, popup, options |
| Extension build | Pass   | WXT Chrome MV3 production build                                                                                                    |
| API build       | Pass   | Wrangler deploy dry-run                                                                                                            |

## Security and privacy evidence

- Production manifest permissions: `activeTab`, `contextMenus`, `scripting`, `storage`.
- Production host permission: `http://localhost:8787/*` only.
- No `<all_urls>`, remote executable code, provider hostname, or provider credential in the extension manifest.
- API errors do not echo invalid request content; logs record request ID and error category only.
- DeepL tests verify the key is placed only in the server-side Authorization header and protected page tokens are not sent verbatim.
- Persistent cache is opt-in, local, capped, clearable, and disabled by privacy mode.

## Defects found and corrected

- Hono response security headers were initially lost after middleware continuation; headers are now set before route execution and integration-tested.
- WXT’s first content-script registration produced `<all_urls>`; it was replaced by `activeTab` programmatic injection.
- Repeated injection could register duplicate listeners; the page shell now has an idempotent global sentinel.
- Global URL/email regular expressions retained state after an early return; state is reset and regression-tested.
- Privacy mode originally disabled persistence but did not block warning-class pages; support classification now blocks them.
- Headless Chrome cannot synthesize an `activeTab` toolbar grant reliably; E2E uses a separate build mode limited to the local fixture origin, while the production manifest stays minimal.
- A shared top-level backend environment schema initially left backend config symbol names in the extension bundle; backend configuration now has a server-only package export and the repeated bundle scan is clean.

## Unverified/deferred

- Live DeepL smoke test: blocked only by absent external credential; no credential was requested or invented.
- Branded Chrome manual console/network pass: manual steps provided; managed Playwright Chromium passed.
- Store publication, deployment, production accounts/quotas, accessibility certification, and broad performance profiling are outside the local MVP.
