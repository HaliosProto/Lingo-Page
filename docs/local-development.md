# Local development and operator runbook

## Prerequisites

- Node.js 24.14 or newer.
- pnpm 11.7.x.
- Chrome or Chromium.

## Local release-candidate workflow

```text
pnpm install
pnpm local:test
```

`pnpm local:test` verifies and builds the production extension, starts a hidden loopback-only API at `http://127.0.0.1:8787`, and reports the unpacked extension directory. The default provider is mock; the popup and Options page label this explicitly. Stop it with `pnpm local:stop`.

Shortcuts:

```text
pnpm local:start     # start mock backend without rebuilding
pnpm local:mock      # same as local:start
pnpm local:deepl     # optional backend-only DeepL mode
pnpm build:release-candidate
pnpm local:stop
```

The mock prefixes each result with the target language code so DOM behavior is visible and deterministic. Backend stdout/stderr are written to ignored `.local/api.stdout.log` and `.local/api.stderr.log`; secrets and page text must not be added to those files.

To build production artifacts:

```text
pnpm build:release-candidate
```

Load `artifacts/translation-extension-local-rc/extension` from `chrome://extensions` using **Load unpacked**. Keep the local API running. Pin the extension, open an ordinary HTTP(S) page, open Lingo Page, choose a target, and select **Translate page**. The artifact also contains `version.json` and checksums.

## Environment

`.env.example` lists client-safe and backend-only values. Wrangler local secrets belong in ignored `apps/api/.dev.vars` or the platform secret store, never in WXT-prefixed variables.

For optional local DeepL testing:

1. Copy `apps/api/.dev.vars.example` to `apps/api/.dev.vars`.
2. Put the key only in the `DEEPL_API_KEY` value in that ignored file; do not paste it into chat, the extension, or a command line.
3. Run `pnpm local:deepl`. The helper binds Wrangler to `127.0.0.1` and does not print the key.
4. Confirm the Options page says `DeepL via local backend`. This path is unverified until an owner supplies and tests a key locally.

The loopback-only development path does not need an extension bearer token. Staging and production still require server-side authentication. The extension never embeds a development bearer token.

## Verification

```text
pnpm verify
pnpm test:e2e
```

`pnpm verify` runs formatting, lint, strict types, unit/integration tests, and production builds. `pnpm test:e2e` creates `.output/chrome-mv3-e2e`, whose extra host permission is limited to `http://127.0.0.1:4173/*`. Managed Chromium coverage and branded Chrome coverage are reported separately.

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
