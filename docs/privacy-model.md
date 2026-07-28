# Privacy model

## Default posture

Translation is an explicit user action. The extension does not silently translate pages, monitor browsing history, collect page text for analytics, or read password/payment-security values. The user sees a clear notice that eligible page text will be sent to the application backend and the configured remote translation service.

## Data categories

| Data                | Default handling                                                    | Retention intent                                                                                                    |
| ------------------- | ------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------- |
| Page text segments  | Sent only for an active request; held in memory for mapping/restore | Memory cache for the worker lifetime; optional local cache is off by default, capped at 200 entries, and clearable. |
| Page hostname/title | Used for popup context and policy checks; minimize storage          | Do not retain as browsing history.                                                                                  |
| Settings            | Local extension storage                                             | Until user clears or uninstalls.                                                                                    |
| Auth session        | Short-lived/revocable app session                                   | Until logout, expiry, revocation, or deletion.                                                                      |
| Usage metadata      | Character/segment counts, status, duration, categories              | Account/billing retention policy to be defined before accounts.                                                     |
| Diagnostics         | User-generated, redacted export                                     | Local only unless user explicitly shares it.                                                                        |

## Sensitive-page protection

Use a warning/blocking layer based on conservative hostname/path signals and page cues for banking, healthcare, authentication, password managers, payments, email, messaging, internal dashboards, and private admin interfaces. This is advisory and imperfect; the UI must never claim detection is complete. The user can choose a stricter block mode in settings.

## Privacy controls

- Translation status and backend/provider category in the popup before use.
- Privacy mode: block translation on warning-class pages and disable persistent translated-text caching.
- Domain exclusions with clear precedence and an undo path.
- Clear translated-text cache control; browser storage can be fully removed by uninstalling the extension.
- No persistent raw-text cache by default.
- Future cache modes explicitly labeled: none, local-only, account-synced, organization-managed.
- Diagnostic export deliberately redacts text, tokens, cookies, form contents, query parameters, and authorization headers.
- The local diagnostics export is metadata-only: provider category, availability, settings booleans, and cache/glossary counts.
- Expandable translation-failure diagnostics are also metadata-only: normalized code/category, provider display name, HTTP status, request ID, requested/valid/missing/duplicate/unknown/empty counts, parse/truncation/finish status, batch/split/attempt sizes, input/token/response-size estimates, and bounded retry history. Copying diagnostics cannot include page text, translated text, keys, headers, cookies, tokens, provider bodies, stacks, or URLs.
- Backend configuration-validation logs never include environment values. They contain only request ID, schema name, issue path, expected format/type, received value category, and a value-redacted validation message.

## Provider disclosure

The settings page identifies the active provider/model, application backend, data recipient, configuration state, and a concise provider-specific notice. Provider retention and processing terms must be reviewed before a real provider is enabled. The extension must not imply that remote translation is local or end-to-end encrypted.

Provider recipients supported by this candidate are Google Gemini, OpenAI, Anthropic, DeepL, DeepSeek, Moonshot AI, Z.AI, Alibaba Cloud Model Studio, xAI, Mistral AI, MiniMax, Cohere, and an explicitly backend-configured compatible endpoint. The deterministic mock has no external recipient. Only configured providers selected by the user are sent page text; there is no silent cross-provider fallback.

Gemini Interactions and OpenAI Responses requests explicitly disable provider-side response storage with `store=false`. Other adapters use independent single requests and the application does not create provider conversation state. These implementation choices are not claims about provider retention, abuse monitoring, legal obligations, training, or subprocessors. Qwen's configured official regional endpoint is disclosed by provider category without exposing the private backend configuration.

## Privacy review questions before public release

- What exact data does each provider retain and for how long?
- Is account text used for provider training, and can that be disabled contractually/configurationally?
- Which regions process data and can users select a region?
- How are deletion requests propagated to usage and diagnostic stores?
- Is the store privacy disclosure consistent with actual permissions and network behavior?

## Milestone 1 session lifecycle

Normal original/translated text stays in the source or cloned page shell and is cleared by explicit End session, navigation invalidation, tab close, or content-script loss. Showing Original or Translation and checking for changes never transmit text. Updating changed sections transmits only confident new/modified eligible sections.

A translated-copy action first explains that site access is needed and, only from the user's open-copy gesture, requests the current HTTP(S) origin. The optional manifest patterns are not automatically granted, and the extension never requests permanent access to every site at once. Denial transmits no additional text, creates no destination, and leaves the source session unchanged.

Before a grant, a separate pending-action record contains only a random intent ID, source tab/session IDs, exact origin pattern, SHA-256 navigation identity, provider/model identity, timestamps, state, and optional destination tab/failure code. It never contains a full URL, query, original text, translated text, or handoff bundle. After a grant, the action creates a bounded temporary tab-bound `chrome.storage.session` handoff. The destination page cannot read that isolated storage, the URL carries no bundle or token, and central page-text data is removed after final translated-DOM acknowledgment or safe failure cleanup. Access is rechecked against the final URL before injection. A comparison action creates a separate bounded owning-tab bundle; its URL carries only a random single-use token. Its structural snapshot excludes forms, editable content, hidden content, input values, source scripts, event handlers, and arbitrary styles. Safe image loads and links may contact their resolved HTTP(S) origins with referrer suppression only when represented in the captured reading structure. No history, analytics, account record, cloud session store, or automatic broad grant was added.

Milestone 2 active-session recovery is local-only, off in privacy mode, and limited to 30 minutes. The record contains session, normalized-origin hash, navigation hash, translation identity, claim state, fingerprints, status, and completed translated values but excludes raw source/original text, HTML, titles, full URLs, inputs, hidden content, cookies, and provider payloads. Reloads remain exact-tab bound. Browser-restart recovery requests only the current origin from the Translate gesture and can transfer an orphaned record only to one Chrome-restored, strongly compatible candidate. Denial disables automatic restart recovery without preventing the current translation. Reconstruction performs no provider call and therefore introduces no new recipient.
