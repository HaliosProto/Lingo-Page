# Universal provider local release-candidate verification

Date: 2026-07-15

## Delivered

- Safe provider registry for mock, Gemini, OpenAI, Anthropic Claude, DeepL, DeepSeek, Kimi/Moonshot, GLM/Z.AI, Qwen/Alibaba Model Studio, xAI/Grok, Mistral, MiniMax, Cohere, and a restricted custom compatible provider.
- Native adapters: deterministic mock, Gemini Interactions (`store=false`), OpenAI Responses (`store=false`), Anthropic Messages, DeepL Translate, and Cohere v2 Chat.
- One hardened OpenAI chat-compatible adapter profiles DeepSeek, Kimi, GLM, Qwen, xAI, Mistral, MiniMax, and custom compatible endpoints.
- Backend model allowlists, optional filtered/cached discovery, provider/model selection, controlled connection tests, explicit live benchmark tooling, human-review worksheet, no silent cross-provider fallback, and provider-specific privacy disclosure.
- Provider-independent request/body/segment/character/output-token limits, timeouts, one-retry maximum for safe malformed compatible output, per-provider concurrency, process-local daily provider quotas, and emergency disable.

## Automated verification

| Command/check                               | Result                                                                                                                                     |
| ------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------ |
| `pnpm verify` (also rerun by release build) | Pass: formatting, ESLint, strict TypeScript, tests, production extension, backend dry-run                                                  |
| `pnpm test:unit`                            | Pass: 59 tests across 6 files                                                                                                              |
| `pnpm test:integration`                     | Pass: 13 API tests                                                                                                                         |
| `pnpm test:e2e`                             | Pass: 1 managed-Chromium end-to-end scenario                                                                                               |
| `pnpm audit`                                | Pass: no known vulnerabilities after patched transitive overrides                                                                          |
| `pnpm security:scan`                        | Pass: no forbidden provider credential/header/origin patterns in extension boundaries; no configured secret values were present to compare |
| `pnpm local:providers`                      | Pass: loopback backend started in configured-provider mode                                                                                 |
| `pnpm provider:test -- mock`                | Pass: normalized mock/model status, 1 ms observed                                                                                          |
| `GET /v1/providers` runtime check           | Pass: 14 definitions, Mock ready, 13 honestly unconfigured                                                                                 |
| `pnpm build:release-candidate`              | Pass: candidate rebuilt, checksummed, and security-scanned                                                                                 |

Provider-contract coverage includes native and compatible request construction, registration/configuration/disable state, model allowlist enforcement, strict and best-effort structured output, malformed/fenced JSON, stale/missing/duplicate/unknown IDs, partial output, placeholder and page-authored internal-token preservation, glossary behavior, prompt-injection strings as data, markup rejection, authentication/rate/outage normalization, timeout/cancellation, retry bounds, token usage, discovery filtering, custom URL restrictions, and secret-safe errors. Every upstream provider boundary was mocked.

Managed Chromium verified whole-page mock translation, progress path, cancellation, exact restoration, dynamic content, selected-text result, popup, and Options. Cache, glossary, exclusions, settings, sensitive-page handling, and RTL behavior are covered by unit/integration logic and the existing owner runbook; branded Chrome manual acceptance remains owner-run and is not claimed here.

## Security and bundle audit

- Production manifest remains limited to `activeTab`, `contextMenus`, `scripting`, `storage`, and the loopback application API host. No provider origin or `<all_urls>` permission is present.
- Provider keys, authorization schemes, upstream origins, custom backend URL configuration, and provider SDKs are absent from extension source and production/RC bundles.
- Real secret values were not configured in this workspace. The scan can privately compare non-empty values from ignored `apps/api/.dev.vars` when the owner runs it later; values are never displayed.
- API logging records request ID and error class only. Tests verify upstream bodies and caller page text are not echoed.
- Release-candidate backend contains provider origins and environment-variable names by design; it contains no real credential or private custom endpoint.

## Live-provider status

No paid or external provider API was called. Mock is the only runtime-tested provider. Every real provider awaits an owner-supplied key, default model, allowlist, provider-specific terms/region review, and an explicit local smoke test. Live benchmark execution was not run.

## Artifact and browser handoff

Unpacked extension: `artifacts/translation-extension-local-rc/extension`

If this folder is already loaded in Chrome, use **Reload** on `chrome://extensions`; use **Load unpacked** only if it is not currently loaded or Chrome lost the existing registration. Keep the loopback backend running with `pnpm local:mock` or `pnpm local:providers` during owner testing.

Nothing was pushed, deployed, published, or exposed publicly.
