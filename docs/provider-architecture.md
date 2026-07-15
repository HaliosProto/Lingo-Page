# Universal translation-provider architecture

Protocol defaults were verified against official provider documentation on 2026-07-15. Model names are intentionally not hard-coded; every real provider needs a backend default model and allowlist.

| Provider ID                | Adapter/protocol                 | Backend origin                                             | Structured-output posture                       | Model discovery    |
| -------------------------- | -------------------------------- | ---------------------------------------------------------- | ----------------------------------------------- | ------------------ |
| `mock`                     | Native deterministic mock        | Local only                                                 | Deterministic internal object                   | No                 |
| `gemini`                   | Native Gemini Interactions       | `generativelanguage.googleapis.com/v1/interactions`        | JSON schema; `store=false`                      | Allowlist-filtered |
| `openai`                   | Native OpenAI Responses          | `api.openai.com/v1/responses`                              | Strict JSON schema; `store=false`               | Allowlist-filtered |
| `anthropic`                | Native Anthropic Messages        | `api.anthropic.com/v1/messages`                            | Native `output_config.format` JSON schema       | Allowlist-filtered |
| `deepl`                    | Native DeepL Translate           | DeepL Free/Pro `/v2/translate`                             | Provider-native ordered JSON response           | No model catalog   |
| `deepseek`                 | Hardened chat-compatible profile | `api.deepseek.com/chat/completions`                        | JSON object plus local validation               | Allowlist-filtered |
| `kimi`                     | Hardened chat-compatible profile | `api.moonshot.ai/v1/chat/completions`                      | JSON schema plus local validation               | Allowlist-filtered |
| `glm`                      | Hardened chat-compatible profile | `api.z.ai/api/paas/v4/chat/completions`                    | JSON object plus local validation               | Configured catalog |
| `qwen`                     | Hardened chat-compatible profile | Configured official DashScope regional compatible endpoint | JSON object plus local validation               | Configured catalog |
| `xai`                      | Hardened chat-compatible profile | `api.x.ai/v1/chat/completions`                             | JSON object plus local validation               | Allowlist-filtered |
| `mistral`                  | Hardened chat-compatible profile | `api.mistral.ai/v1/chat/completions`                       | JSON object plus local validation               | Allowlist-filtered |
| `minimax`                  | Hardened chat-compatible profile | `api.minimax.io/v1/chat/completions`                       | JSON object plus local validation               | Allowlist-filtered |
| `cohere`                   | Native Cohere v2 Chat            | `api.cohere.com/v2/chat`                                   | Native JSON schema plus local validation        | Configured catalog |
| `custom-openai-compatible` | Hardened chat-compatible profile | Backend-configured HTTPS or loopback origin                | Backend-declared JSON schema/object/prompt-only | Configured catalog |

Official references used for the protocol review include [OpenAI Responses](https://developers.openai.com/api/reference/resources/responses/methods/create), [Gemini Interactions](https://ai.google.dev/gemini-api/docs/interactions-overview), [Anthropic Messages](https://platform.claude.com/docs/en/api/messages/create), [DeepL Translate](https://developers.deepl.com/api-reference/translate), [DeepSeek](https://api-docs.deepseek.com/), [Kimi/Moonshot](https://platform.kimi.ai/docs/api/chat), [Z.AI HTTP API](https://docs.z.ai/guides/develop/http/introduction), [Alibaba Model Studio base URLs](https://help.aliyun.com/en/model-studio/base-url), [Mistral Chat](https://docs.mistral.ai/api), [MiniMax OpenAI compatibility](https://platform.minimax.io/docs/api-reference/models/openai/list-models), [Cohere v2 Chat](https://docs.cohere.com/v2/reference/chat), and [xAI Chat Completions](https://docs.x.ai/developers/model-capabilities/legacy/chat-completions).

## Registry and routing

`GET /v1/providers` returns only safe metadata: stable IDs, display names, configuration/enabled state, allowlisted models, capabilities, data recipient, and privacy notice. It never returns keys, base URLs, headers, raw environment values, or upstream errors. `GET /v1/providers/:providerId/models` returns the configured allowlist. An explicit `?refresh=true` may call a documented model-list endpoint, caches the result, and still returns only allowlisted models.

Routing order is request provider/model, then the saved extension preference carried in the request, then `TRANSLATION_DEFAULT_PROVIDER`. Development/test may select the local mock only when no explicit provider was requested and the backend default is unavailable. A selected provider failure never causes cross-provider fallback.

The custom compatible provider is backend-only. Its URL cannot be supplied by extension messages; it must use HTTPS unless it is explicit loopback, cannot contain credentials/query/fragment data, and cannot target private/link-local IPv4 or `.local` hosts.

## Normalized result and validation

All adapters return request/session/provider/model identity, exact segment IDs, plain translated text, optional detected language, character usage, and token usage when reported. LLM prompts place page segments in a serialized untrusted-data payload. Output is rejected for malformed JSON, Markdown fences, refusal/truncation, stale IDs, missing/duplicate/unknown IDs, protected-token changes, empty text, suspicious markup, excessive expansion, or partial sets.

Best-effort compatible profiles may retry one malformed response. Authentication, billing/quota, policy, invalid request, and provider selection failures are never retried or routed elsewhere. Native strict-schema adapters and DeepL do not perform an application retry.

## Cost and emergency controls

Controls are provider-independent: request bytes, segments, input/output characters, output tokens, per-provider concurrency, timeout, one-retry maximum, per-minute requests, per-session characters, optional daily provider character quotas, and `DISABLED_PROVIDERS`. Pricing is not hard-coded.

`PROVIDER_CHARACTER_QUOTAS` uses comma-separated `provider-id:characters` entries. Counters are process-local for this personal local candidate and are not production enforcement.

## Privacy metadata

Every registry entry identifies the data recipient and whether page text leaves the local backend. Gemini and OpenAI requests explicitly set `store=false`. Other implementations use single stateless requests without application conversation state; this is not a claim about provider retention. Qwen region is selected through one of the three allowlisted official DashScope regional base URLs. Provider terms, retention, training, and geographic processing must be reviewed by the owner before public use.
