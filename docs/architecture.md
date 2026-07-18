# Architecture

Status: provisional baseline from Milestone 0

## Decisions

- Extension framework: WXT + React + TypeScript, targeting Chrome MV3 first.
- API runtime: Cloudflare Workers + Hono.
- Workspace: pnpm monorepo.
- Validation: shared Zod-style runtime schemas; types are inferred from schemas where practical.
- Testing: Vitest and Playwright with local fixtures.
- Provider boundary: a registry-backed `TranslationProvider` interface with native and hardened OpenAI-compatible adapters. See `docs/provider-architecture.md`.
- Authentication: loopback-only local development path initially; staging/production require short-lived revocable application sessions before public release.

Detailed rationale is in `docs/decisions/`.

## System context

```mermaid
flowchart LR
  U[User] --> P[Popup / Options]
  P --> SW[MV3 Service Worker]
  SW --> CS[Content Script]
  CS --> DOM[Untrusted Page DOM]
  SW --> API[Application API]
  API --> V[Provider Adapter]
  V --> TP[Translation Provider]
  API --> O[Privacy-safe Operational Metrics]
```

The page is untrusted. The content script may read and mutate only the DOM needed for an explicit translation request. The service worker owns extension orchestration, tab/session identity, cancellation, backend requests, and extension storage. The API owns authentication, quotas, limits, provider credentials, provider calls, and operational logging.

## Package boundaries

```text
/
  apps/
    extension/             WXT entrypoints, popup/options, worker, content engine bridge
    api/                   Worker routes, auth, quotas, provider orchestration
  packages/
    shared-types/          Public domain types and discriminated unions
    shared-validation/    Runtime schemas and safe parsers
    translation-core/     DOM-independent segmentation, batching, cache, response mapping
    translation-providers/ Registry, prompt/output boundary, native and compatible adapters
    shared-config/        Environment and feature-flag validation
    ui/                   Accessible design tokens and reusable React primitives
    testing/              Fixtures, factories, fake clocks, browser helpers
  docs/
```

Rules: core has no browser/provider/UI imports; providers have no DOM/UI imports; API has no direct DOM access; UI has no secrets; extension code never imports provider SDKs.

## Extension runtime design

- Popup uses `chrome.runtime.sendMessage` to ask the service worker for tab state and to start/cancel/restore.
- The service worker validates sender, tab ID, frame ID, navigation identity, request ID, and payload schema before acting.
- The content script receives a command only after the service worker confirms the active tab and supported URL. It reports progress and structured errors.
- The DOM engine stores originals in an in-memory session keyed by page session and node identity. A future persistence layer must remain opt-in and privacy-reviewed.
- Dynamic content is handled by a debounced observer after the primary translation session; extension mutations are marked and ignored.

## API runtime design

Hono provides small route composition and Web-standard request/response handling. Middleware order: request ID, CORS allowlist, method/content-type checks, auth, rate limits, payload validation, route handler, normalized error response, privacy-safe logging. Provider calls use `fetch` with an abort timeout and only a narrow allowlisted upstream URL.

## Storage model

Normal translation sessions remain memory-only in the top-frame page shell. The shell owns exact originals/translations, live bindings, lifecycle, display mode, explicit change-scan result, and changed-state reconciliation; the service worker owns routing, request cancellation, and privacy-safe progress. Explicit translated-copy actions put a bounded cloned bundle in `chrome.storage.session`, bind it to one visible tab before navigation, and delete the central page-text copy only after destination acknowledgment or failure cleanup. The destination keeps its independent validated session in its own page-shell memory. Explicit comparison actions use a single-use owning-tab token and a temporary bundle containing a bounded allowlisted structural snapshot; the extension reconstructs two inert read-only trees and deletes transfer storage after retrieval or tab cleanup. Future account data and translation memory remain separate and require explicit approval.

See `docs/milestones/milestone-1-specification.md`, ADR 0007, ADR 0009, and ADR 0010 for the session, acknowledged copy handoff, sanitized comparison, bounds, and rollback contracts.

The local release-candidate workflow builds an unpacked production extension, starts the API on `127.0.0.1`, and lets the extension select only backend-enabled provider/model IDs. Credentials, endpoints, capability policy, and model allowlists remain backend-owned. The extension can export metadata-only diagnostics without page text or URLs.

## Data-flow sequence

```mermaid
sequenceDiagram
  participant User
  participant Popup
  participant Worker
  participant Page as Content script
  participant API
  participant Provider
  User->>Popup: Click Translate Page
  Popup->>Worker: Start(tabId, navigationId, target)
  Worker->>Page: Discover / detect
  Page-->>Worker: Validated segments + page metadata
  Worker->>API: Authenticated structured request
  API->>Provider: Provider-specific request
  Provider-->>API: Provider response
  API-->>Worker: Validated translations
  Worker->>Page: Apply(requestId, translations)
  Page-->>Worker: Progress / completion
  Worker-->>Popup: State updates
```

## API-key boundary

The extension bundle may contain only `WXT_API_BASE_URL`. Provider keys and server administrator keys are backend secrets. The API accepts stable provider/model IDs only after registry and allowlist validation; it never accepts an upstream endpoint. Secret scanning covers source, history where practical, bundles, source maps, logs, and configuration.
