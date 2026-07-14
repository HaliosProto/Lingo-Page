# Translation Extension + App

Privacy-first in-page translation for Chrome, designed as the first surface of a broader translation platform.

## Repository status

Milestone 0 is complete. This repository currently contains the specification and architecture baseline; product code is intentionally not implemented yet.

Read these in order:

1. `AGENTS.md` for engineering rules.
2. `docs/spec-driven-workflow.md` for the development method.
3. `docs/product-spec.md` for product behavior and requirements.
4. `docs/architecture.md` for system boundaries and package design.
5. `TASKS.md` for the ordered implementation plan.
6. `docs/verification-matrix.md` for the definition of done.

## Planned architecture

```text
Chrome popup/options
        │ validated extension messages
        ▼
MV3 service worker ───────► application API ───────► translation provider
        │                         │
        ▼                         ▼
content-script DOM engine     quotas, limits, logs, secrets
```

The extension will call only the application API. Provider credentials remain server-side. Webpage text is treated as untrusted data and translated into text nodes only.

## Planned commands

These commands will be added during Milestone 1:

```text
pnpm install
pnpm dev:extension
pnpm dev:api
pnpm lint
pnpm typecheck
pnpm test
pnpm test:e2e
pnpm build
```

## Local configuration

Copy `.env.example` to the appropriate backend development environment. Never commit real secrets. Client configuration may contain only a non-secret API base URL.

## Milestone 0 verification

The workspace was inspected on 2026-07-15. It contains no existing source tree or package manager configuration. Node 24.18.0, pnpm 11.7.0, Git 2.53.0, ripgrep, and a Chrome executable at `C:\Program Files\Google\Chrome\Application\chrome.exe` are available. Browser verification is not part of Milestone 0 and no extension has been loaded.
