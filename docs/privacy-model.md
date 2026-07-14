# Privacy model

## Default posture

Translation is an explicit user action. The extension does not silently translate pages, monitor browsing history, collect page text for analytics, or read password/payment-security values. The user sees a clear notice that eligible page text will be sent to the application backend and the configured remote translation service.

## Data categories

| Data                | Default handling                                                    | Retention intent                                                                             |
| ------------------- | ------------------------------------------------------------------- | -------------------------------------------------------------------------------------------- |
| Page text segments  | Sent only for an active request; held in memory for mapping/restore | Discard after session/request unless the user opts into a future translation-memory feature. |
| Page hostname/title | Used for popup context and policy checks; minimize storage          | Do not retain as browsing history.                                                           |
| Settings            | Local extension storage                                             | Until user clears or uninstalls.                                                             |
| Auth session        | Short-lived/revocable app session                                   | Until logout, expiry, revocation, or deletion.                                               |
| Usage metadata      | Character/segment counts, status, duration, categories              | Account/billing retention policy to be defined before accounts.                              |
| Diagnostics         | User-generated, redacted export                                     | Local only unless user explicitly shares it.                                                 |

## Sensitive-page protection

Use a warning/blocking layer based on conservative hostname/path signals and page cues for banking, healthcare, authentication, password managers, payments, email, messaging, internal dashboards, and private admin interfaces. This is advisory and imperfect; the UI must never claim detection is complete. The user can choose a stricter block mode in settings.

## Privacy controls

- Remote translation notice before first use and accessible status thereafter.
- Privacy mode: block remote translation on warning-class pages.
- Domain exclusions with clear precedence and an undo path.
- Clear in-session data and settings controls.
- No persistent raw-text cache by default.
- Future cache modes explicitly labeled: none, local-only, account-synced, organization-managed.
- Diagnostic export deliberately redacts text, tokens, cookies, form contents, query parameters, and authorization headers.

## Provider disclosure

The settings page must identify the application backend and the active translation provider category. Provider retention and processing terms must be reviewed and linked before a real provider is enabled. The extension must not imply that remote translation is local or end-to-end encrypted.

## Privacy review questions before public release

- What exact data does each provider retain and for how long?
- Is account text used for provider training, and can that be disabled contractually/configurationally?
- Which regions process data and can users select a region?
- How are deletion requests propagated to usage and diagnostic stores?
- Is the store privacy disclosure consistent with actual permissions and network behavior?
