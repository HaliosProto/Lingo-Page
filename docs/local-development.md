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
pnpm local:start     # start one backend using apps/api/.dev.vars
pnpm local:providers # same configured-provider backend
pnpm local:mock      # force deterministic mock mode
pnpm local:deepl     # force optional backend-only DeepL mode
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

## Configure providers locally

Each real provider requires its own API account and key. Configure only providers you want to use:

1. Copy `apps/api/.dev.vars.example` to ignored `apps/api/.dev.vars`.
2. Enter each key and that provider's default model/allowed-model list in this file only. Never put a real value in `.dev.vars.example`, and never paste a key into chat, source, a command line, extension settings, screenshots, or diagnostics.
3. Keep `TRANSLATION_DEFAULT_PROVIDER=mock` until you intentionally choose another default. `ENABLED_PROVIDERS=auto` enables mock and safely configured providers; `DISABLED_PROVIDERS` is the emergency off switch.
4. Run `pnpm local:providers`. Open Options, choose one of the backend-enabled providers and one allowlisted model, save, then optionally choose **Test selected provider**. The test sends only the fixed text `Hello.`.
5. To test from the terminal, run `pnpm provider:test -- gemini` (substitute any provider ID). Missing keys fail without displaying them.
6. Run `pnpm local:mock` and select Mock to return to deterministic local behavior.
7. To remove a provider, stop the backend, remove its key/default model from `.dev.vars`, restart, and confirm it is no longer selectable. Delete `.dev.vars` if no real providers should remain.

A Gemini-only configuration uses this shape; replace angle-bracket placeholders locally and do not commit the file:

```text
TRANSLATION_DEFAULT_PROVIDER=gemini
ENABLED_PROVIDERS=gemini
GEMINI_API_KEY=<local-secret>
GEMINI_DEFAULT_MODEL=<allowlisted-model-id>
GEMINI_ALLOWED_MODELS=<allowlisted-model-id>[,<second-allowlisted-model-id>]
```

Comma-separated model IDs are trimmed and deduplicated. Optional template entries may remain blank; blank optional secrets, model fields, model lists, `DEV_AUTH_TOKEN`, `CUSTOM_OPENAI_BASE_URL`, and `QWEN_BASE_URL` are treated as unset, with documented defaults applied where relevant.

The custom compatible provider additionally requires `CUSTOM_OPENAI_BASE_URL`, a default model, and an explicit model allowlist. The URL remains backend-only and is restricted to HTTPS public origins or loopback. Qwen's regional base URL must be one of the documented values in the example file.

Live benchmarking is separate and explicit:

```text
pnpm provider:benchmark -- openai --confirm-live
```

This sends the non-sensitive benchmark corpus to the selected provider and may incur cost. Normal tests, builds, verification, and browser E2E never call paid APIs. Use `docs/provider-benchmark-human-review.md` for qualitative comparison.

To confirm keys are not in the extension, build the candidate and search `artifacts/translation-extension-local-rc/extension` for the literal local key using a private local tool. Do not print matching content. Also verify the manifest contains only the loopback backend host and no provider origin.

The loopback-only development path does not need an extension bearer token. Staging and production still require server-side authentication. The extension never embeds a development bearer token.

## Verification

```text
pnpm verify
pnpm test:e2e
```

`pnpm verify` runs formatting, lint, strict types, unit/integration tests, and production builds. `pnpm test:e2e` creates `.output/chrome-mv3-e2e`, whose required extra fixture host permission is limited to `http://127.0.0.1:4173/*`. Both production and E2E manifests declare optional HTTP/HTTPS patterns for translated-copy requests; those declarations grant nothing by themselves, and the runtime asks only for the current origin from the explicit button gesture. Managed Chromium coverage and branded Chrome coverage are reported separately.

## Manual Chrome checklist

1. Build and load the production directory unpacked.
2. Confirm required permissions show no all-site access. The optional site-access declaration may list HTTP and HTTPS, but no site is granted until **Open translated copy** requests the current origin.
3. Translate and restore a normal article; verify links/forms/controls still work.
4. Cancel a translation and navigate during another translation; verify no stale text is applied.
5. Add/select dynamic text and verify context-menu translation/copy.
6. Check popup, page, and service-worker consoles for errors.
7. Check DevTools Network: extension traffic must target only the configured application API.
8. Translate a safe page, choose **Open translated copy**, and confirm Chrome asks only for that origin. Deny once and confirm the source is unchanged and the same popup does not prompt again; then grant on a later explicit attempt and confirm the final copy is translated before its ready status.
9. Search the loaded bundle for the provider key and bearer token; neither may exist.

## Troubleshooting

- **Local service unavailable:** verify `/v1/health` at port 8787 and `WXT_API_BASE_URL`.
- **Backend configuration error:** `/v1/health` returns a structured `INTERNAL_ERROR` with an `X-Request-ID`. Local API logs identify only the schema, issue path, expected format/type, received value category, and validation message; they do not print the rejected value. Correct the named entry in ignored `.dev.vars` and restart.
- **Provider-test failure:** `BACKEND_UNAVAILABLE` means no HTTP response was received. An HTTP backend failure retains its structured backend code, while a non-JSON failure is reported as `BACKEND_HTTP_<status>`.
- **Page cannot be translated:** browser-internal/Web Store pages, excluded domains, and privacy-mode sensitive pages are deliberately blocked.
- **No text changes:** code, form fields, hidden nodes, numeric-only text, URLs, identifiers, and `translate=no` regions are intentionally excluded.
- **Settings rejected:** glossary source terms cannot be blank and language/domain values are bounded by runtime schemas.
