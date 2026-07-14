# Local development and operator runbook

## Prerequisites

- Node.js 24.14 or newer.
- pnpm 11.7.x.
- Chrome or Chromium.

## Install and run

```text
pnpm install
pnpm dev:api
pnpm dev:extension
```

The API defaults to `http://localhost:8787`, `TRANSLATION_PROVIDER=mock`, and translation enabled. The mock prefixes each result with the target language code so DOM behavior is visible and deterministic.

To build production artifacts:

```text
pnpm build
```

Load `apps/extension/.output/chrome-mv3` from `chrome://extensions` using **Load unpacked**. Keep the local API running. Pin the extension, open an ordinary HTTP(S) page, open Lingo Page (or press Alt+Shift+L), choose a target, and select **Translate page**.

## Environment

`.env.example` lists client-safe and backend-only values. Wrangler local secrets belong in ignored `apps/api/.dev.vars` or the platform secret store, never in WXT-prefixed variables.

For a direct authenticated DeepL API smoke test:

1. Set `TRANSLATION_PROVIDER=deepl`, `DEEPL_API_KEY`, and a random `DEV_AUTH_TOKEN` in backend-only local secrets.
2. Start the API.
3. Send a bounded `POST /v1/translate` request with `Authorization: Bearer <DEV_AUTH_TOKEN>`.
4. Confirm the response IDs/session match and inspect logs for request metadata only, never text or credentials.

The extension intentionally does not embed a development bearer token. A real provider becomes an extension end-to-end path only after production identity/session work.

## Verification

```text
pnpm verify
pnpm test:e2e
```

`pnpm verify` runs formatting, lint, strict types, unit/integration tests, and production builds. `pnpm test:e2e` creates `.output/chrome-mv3-e2e`, whose extra host permission is limited to `http://127.0.0.1:4173/*`. Run `pnpm build` afterward when inspecting the production manifest.

## Manual Chrome checklist

1. Build and load the production directory unpacked.
2. Confirm the manifest shows no access to all sites.
3. Translate and restore a normal article; verify links/forms/controls still work.
4. Cancel a translation and navigate during another translation; verify no stale text is applied.
5. Add/select dynamic text and verify context-menu translation/copy.
6. Check popup, page, and service-worker consoles for errors.
7. Check DevTools Network: extension traffic must target only the configured application API.
8. Search the loaded bundle for the provider key and bearer token; neither may exist.

## Troubleshooting

- **Local service unavailable:** verify `/v1/health` at port 8787 and `WXT_API_BASE_URL`.
- **Page cannot be translated:** browser-internal/Web Store pages, excluded domains, and privacy-mode sensitive pages are deliberately blocked.
- **No text changes:** code, form fields, hidden nodes, numeric-only text, URLs, identifiers, and `translate=no` regions are intentionally excluded.
- **Settings rejected:** glossary source terms cannot be blank and language/domain values are bounded by runtime schemas.
