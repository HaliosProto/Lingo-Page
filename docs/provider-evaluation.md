# Translation provider evaluation

Evaluation date: 2026-07-15. This is a qualitative architecture comparison, not a performance benchmark or purchasing recommendation. Prices, quotas, regional availability, and terms must be rechecked before Milestone 3.

| Provider | Quality/context | Languages | Glossary/formality | Privacy/control | Reliability/integration | Fit |
| --- | --- | --- | --- | --- | --- | --- |
| DeepL API | Strong purpose-built text translation and document-oriented roadmap; supports formatting controls | Broad but not as broad as Google/Azure; confirm MVP language list | Glossaries and formality controls are first-class API concepts | Clear server-side key model; review current retention/region terms | Simple HTTP integration and predictable text response; quota/limits need adapter handling | Best first adapter candidate for quality and controlled behavior. |
| Google Cloud Translation Advanced | Strong NMT/translation LLM options, regional endpoints, batch/document support | 100+ languages documented | Glossaries, custom/adaptive options, document translation | IAM service accounts and regional endpoints; no API key for Advanced | Mature but more cloud/IAM setup and configuration surface | Strong second provider and future document path. |
| Azure Translator | Broad language/dialect support, custom translator, document translation | Broad and includes auto-detection | Dynamic dictionary, glossary, custom translation; formality requires validation | Azure identity/region controls; review retention and data residency | REST integration; Azure resource setup and request/version details add overhead | Strong enterprise/document candidate. |
| OpenAI API | Excellent contextual adaptation and flexible language coverage | Broad but quality/availability depends on model and prompt | Prompt-based terminology/style; not a dedicated glossary system for this use | Server-side key; provider data controls and regional availability must be reviewed | Structured output can be useful but requires stronger prompt-injection/output controls | Optional later adapter for high-context cases, not the first baseline. |

## Recommendation

Use a deterministic mock provider in Milestone 2. For Milestone 3, implement a DeepL adapter first, subject to a fixture benchmark against Google Cloud Translation Advanced and Azure Translator. DeepL is selected provisionally because the first product is plain webpage text, not documents; its API exposes translation-oriented formatting, glossary, and formality controls without forcing the core to understand an LLM prompt. Keep Google and Azure in the provider interface for breadth, regional/enterprise needs, and future document workflows.

## Adapter rules

Provider-specific authentication, endpoints, request shaping, retries, error parsing, language mapping, glossary mapping, model/configuration, and structured-response validation live inside the adapter. The core sees only the shared request/response model.

Sources: [DeepL Translate Text API](https://developers.deepl.com/api-reference/translate), [Google Cloud Translation API overview](https://docs.cloud.google.com/translate/docs/api-overview), [Azure Translator overview](https://learn.microsoft.com/en-us/azure/ai-services/translator/overview), [OpenAI API documentation](https://platform.openai.com/docs/overview).
