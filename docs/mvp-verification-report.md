# Local MVP verification report

Date: 2026-07-15

> Status reconciliation (2026-07-18): this historical report records a Gemini smoke result from its dated environment, but the current governing repository state cannot reproduce a live real-provider call without an external credential and explicit approval. Treat mock/mocked-boundary evidence as current; do not use the historical live row as present release evidence.

## Automated evidence

| Check                   | Result | Evidence                                                                                                                                                                                                     |
| ----------------------- | ------ | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| Formatting              | Pass   | `pnpm format:check`                                                                                                                                                                                          |
| Lint                    | Pass   | `pnpm lint`                                                                                                                                                                                                  |
| Strict types            | Pass   | `pnpm typecheck` across shared packages, API, and extension                                                                                                                                                  |
| Unit tests              | Pass   | 95 tests across configuration, validation, translation core, provider adapters, exact failure explanations, safe diagnostics, and provider-test classification                                               |
| API integration         | Pass   | 21 tests including Gemini-only health/registry, blank templates, malformed environment diagnostics, local/upstream HTTP classification, and existing API behavior                                            |
| Direct Wrangler runtime | Pass   | Existing ignored Gemini configuration: `/v1/health` and `/v1/providers` returned HTTP 200 with request IDs                                                                                                   |
| Local launcher runtime  | Pass   | `pnpm local:start` returned Gemini health HTTP 200; `pnpm local:mock` returned mock health HTTP 200                                                                                                          |
| Live Gemini smoke       | Pass   | Explicit controlled `pnpm provider:test -- gemini` reached the real adapter and returned normalized success                                                                                                  |
| Browser E2E             | Pass   | Managed Chromium: page translation, exact exclusion/cancellation explanations, 1,000-section partial preservation and continuation, form safety, dynamic text, restore, selection result, popup, and options |
| Extension build         | Pass   | WXT Chrome MV3 production build                                                                                                                                                                              |
| API build               | Pass   | Wrangler deploy dry-run                                                                                                                                                                                      |
| Dependency audit        | Pass   | No known production dependency vulnerabilities                                                                                                                                                               |
| Secret/bundle scan      | Pass   | Two extension roots scanned; one configured secret checked by value without display                                                                                                                          |

## Security and privacy evidence

- Production manifest permissions: `activeTab`, `contextMenus`, `scripting`, `storage`.
- Production host permission: `http://127.0.0.1:8787/*` only.
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
- A blank optional `CUSTOM_OPENAI_BASE_URL` from the checked-in template was represented by Wrangler as an empty string, while `apiEnvironmentSchema` accepted only a valid URL or `undefined`. Environment parsing failed before request context was set, so every route returned an unstructured 500 and logs lacked a request ID. Blank optional entries now normalize to unset values, malformed non-blank entries produce value-redacted schema diagnostics, and request IDs are assigned before parsing.
- The provider-test CLI parsed JSON inside its transport-error catch, so a non-JSON HTTP 500 was mislabeled `BACKEND_UNAVAILABLE`. HTTP responses now retain structured backend codes or receive a `BACKEND_HTTP_<status>` classification; only connection failures use `BACKEND_UNAVAILABLE`.
- Partial failures previously collapsed to a generic popup label and could not continue the same page session. Failures now use a normalized reason with allowlisted metadata, exact actions and retry timing; completed node records survive cancellation/failure and continuation selects only unresolved records.

## Unverified/deferred

- Live DeepL smoke test: blocked only by absent external credential; no credential was requested or invented.
- Other real providers remain unverified unless separately configured and explicitly tested. Gemini alone was live-tested for this report using the owner's ignored local configuration.
- Branded Chrome manual console/network pass: manual steps provided; managed Playwright Chromium passed.
- Store publication, deployment, production accounts/quotas, accessibility certification, and broad performance profiling are outside the local MVP.
- The local RC start/stop workflow, diagnostics export, and acceptance runbook are implemented for owner review; their final manual acceptance remains pending.
