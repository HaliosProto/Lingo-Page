# AGENTS.md

## Project mission

This repository will become a privacy-first translation platform. The first deliverable is a Chrome Manifest V3 extension that translates eligible visible webpage text in place through a secure application backend.

The extension must preserve the page DOM, styling, links, controls, images, formatting, and behavior. It must keep original text recoverable and must never replace `document.body.innerHTML` or inject provider-returned HTML or JavaScript.

## Current status

Milestone 0 (discovery, specification, and architecture) is complete as documentation only. The workspace began empty: no source files, package manifests, tests, or Git repository metadata were present. Feature implementation must begin only in Milestone 1 after the Milestone 0 report is accepted.

## Working rules

- Work on exactly one milestone at a time.
- Follow `docs/spec-driven-workflow.md`: discover, specify, design, plan, accept, implement, verify, record, and stop for review.
- Read the relevant existing code and living documents before editing.
- Do not claim browser verification unless Chrome was actually used.
- Do not claim a milestone complete because code exists. Completion requires the checks in `docs/verification-matrix.md`.
- Keep page content and provider responses untrusted at every boundary.
- Treat translated output as plain text. Do not insert unsanitized HTML.
- Never place provider secrets in extension source, bundles, source maps, storage, logs, or client configuration.
- Do not log raw page text, full URLs, cookies, form values, authorization headers, or tokens by default.
- Do not add broad host permissions when `activeTab` and `scripting` are sufficient.
- Do not translate passwords, payment/security fields, editable fields, scripts, styles, code, hidden text, or extension-owned UI.
- Do not add payments, public accounts, or future platforms before their milestone.
- Prefer small, reversible, well-tested changes.

## Required quality gates

For every milestone, run the applicable formatter, linter, strict TypeScript check, unit tests, integration tests, production build, runtime checks, and browser scenarios. Update documentation and task status before producing the milestone report. Record unverified checks honestly.

## Expected package boundaries

```text
apps/extension       WXT/React MV3 client
apps/api             Cloudflare Worker API
packages/shared-types
packages/shared-validation
packages/translation-core
packages/translation-providers
packages/shared-config
packages/ui
packages/testing
```

The translation core must not import provider SDKs, Chrome APIs, React, or backend runtime code. The provider package owns provider-specific payloads, prompts if applicable, credentials, retries, and response parsing. The extension owns DOM discovery and mutation but not provider credentials.

## Development defaults

- Package manager: pnpm workspaces.
- Language: TypeScript with strict mode.
- Extension: WXT + React + Chrome Manifest V3.
- API: Cloudflare Workers + Hono, locally runnable with Wrangler.
- Runtime validation: Zod or an equivalent schema package, centralized in `packages/shared-validation`.
- Testing: Vitest for pure logic and Playwright for browser tests.
- First real provider candidate: DeepL adapter, selected for purpose-built translation controls, glossary support, and formality controls. It is not used during the deterministic mock milestone.
- Authentication: explicit development-only auth mode before production session authentication is implemented.

## Security-sensitive changes

Changes involving permissions, message schemas, authentication, API routes, provider adapters, secret handling, storage, page text collection, or logging require updates to the relevant security/privacy/threat documents and a secret scan. Keep `.env`, `.env.*` except `.env.example`, build outputs, and test artifacts out of version control.

## References

- Product and scope: `docs/product-spec.md`
- Architecture: `docs/architecture.md`
- Security: `docs/security-model.md`, `docs/threat-model.md`
- Privacy: `docs/privacy-model.md`
- DOM flow: `docs/translation-pipeline.md`
- Work order: `TASKS.md`, `docs/milestones.md`
- Verification: `docs/testing-strategy.md`, `docs/verification-matrix.md`
