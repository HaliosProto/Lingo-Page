# Security model

## Security objectives

1. Keep provider credentials and administrative capabilities off the client.
2. Prevent untrusted webpage content from changing extension behavior or executing code.
3. Prevent cross-tab and cross-navigation translation state confusion.
4. Bound resource use and provider cost.
5. Keep translated output plain text and safe to place in the DOM.
6. Make privacy/security failures visible and recoverable.

## Trust boundaries

| Boundary                        | Untrusted input                               | Required controls                                                                    |
| ------------------------------- | --------------------------------------------- | ------------------------------------------------------------------------------------ |
| Page DOM → content script       | Text, attributes, node shape, mutation events | Eligibility checks, size bounds, no HTML interpretation, loop guards.                |
| Popup → service worker          | User-controlled UI messages                   | Runtime schema, allowed message types, active-tab identity check.                    |
| Content script → service worker | Segment data and progress                     | Runtime schema, sender/frame/tab checks, request/navigation binding, limits.         |
| Extension → API                 | Structured translation payload                | HTTPS, auth, schema, timeout, abort, request ID, no provider options from page.      |
| API → provider                  | Provider-specific payload                     | Allowlisted endpoint/model, server secret, timeout, safe retry, response validation. |
| Provider → API                  | External response                             | Strict schema, exact ID reconciliation, plain-text constraints, expansion checks.    |
| API logs/metrics                | Operational events                            | Redaction, aggregation, no raw text/URLs/tokens.                                     |

## Extension controls

- Manifest V3 service worker; no remotely hosted executable code.
- Start with `activeTab` and `scripting`; add no persistent `<all_urls>` permission unless a later requirement proves it necessary.
- Use isolated-world content scripts and avoid main-world injection.
- Validate every message at runtime. Never trust a TypeScript cast.
- Treat `sender.tab.id`, frame ID, URL identity, and navigation token as required context.
- Generate request/session IDs with non-secret randomness and reject duplicates/out-of-order responses.
- Use `textContent`/text-node replacement only; never `innerHTML` for provider output.
- Do not use `eval`, string timers, dynamic script injection, or remote code.
- Keep extension UI in an extension-owned root and mark it so the DOM engine excludes it.
- Clear session content on restore, cancellation completion, navigation, tab close, logout, and explicit clear-data action.

## API controls

- Production HTTPS only; strict CORS allowlist for the extension origin(s).
- Development auth is disabled only for the explicitly loopback-bound local helper; the UI labels the local build and provider mode. Staging and production require server-side authentication.
- Bearer tokens are short-lived/revocable in production; no admin token is issued to the extension.
- Validate content type, body size, segment count, segment length, total characters, language codes, mode, and supported options.
- Enforce per-user, per-IP, daily, monthly, and emergency global limits.
- Use an upstream allowlist and server-side provider configuration.
- Resolve provider and model through the backend registry; reject unknown, disabled, unconfigured, or non-allowlisted values without fallback.
- Keep custom compatible base URLs backend-only. Permit HTTPS public origins or explicit loopback only; reject credentials, query/fragment data, private/link-local IPv4, and `.local` destinations.
- Abort provider calls on timeout or user cancellation where supported.
- Retry only idempotent safe transient failures with bounded backoff.
- Return normalized error codes plus request IDs, not upstream secrets or raw provider payloads.
- Restrict operational error metadata to provider ID, counts, retry state/delay, HTTP status, request ID, and safe booleans. The extension schema strips all other fields before popup display or diagnostic copy.
- Create a request ID before parsing backend environment configuration so configuration failures still return a correlated structured error and `X-Request-ID` header.
- Normalize blank optional `.dev.vars` template entries to unset values. Malformed non-blank values fail closed; privacy-safe diagnostics include only schema name, issue path, expected format/type, received value category, and a value-redacted message.
- Redact authorization headers, secrets, page content, full URLs, and provider responses from logs.
- Diagnostics export contains only extension version, backend/provider status, boolean settings, and cache/glossary counts; it never includes page text, URLs, tokens, or secrets.
- Per-translation technical details use a separate allowlist and never include page text, raw provider bodies, keys, cookies, authorization headers, stacks, or sensitive URLs.
- Provider connection tests use one fixed tiny sentence and accept no caller-supplied text, URL, headers, model, or upstream parameters.
- Provider-test tooling distinguishes transport unavailability from received HTTP failures and never prints backend-configured model values on success.

## Multi-provider controls

- All page text remains untrusted data inside a fixed provider instruction. It cannot select providers/models, change IDs or output schema, reveal credentials, or initiate network requests.
- Native OpenAI, Gemini, Anthropic, Cohere, and DeepL adapters construct provider-specific payloads. Compatible providers share one reviewed adapter and immutable backend profile.
- Returned JSON is parsed and locally validated even when an upstream claims strict schema support. Markdown fences, refusals, truncation, partial batches, stale IDs, unknown/duplicate IDs, token loss, markup insertion, and excessive expansion are failures.
- Automatic cross-provider fallback is absent. Development-only default resolution may choose the clearly labeled mock only when no provider was explicitly requested.
- Emergency provider disable, allowlisted model catalogs, output-token limits, per-provider timeouts/concurrency, bounded malformed-output retry, and optional daily character quotas limit spend and blast radius.

## Output validation

For each response: request ID must match; translation IDs must be unique, expected, and complete or explicitly partial; output must be a string within configured bounds; markup/script-like output is rejected or treated as literal text; excessive expansion, empty output, malformed JSON, provider refusals, and unexpected fields are handled as typed failures.

## Release gates

Permission audit, dependency audit, secret scan, bundle scan, schema-fuzz tests, error-path tests, manual CSP review, browser console review, and privacy-document review are mandatory before store-readiness milestone completion.
