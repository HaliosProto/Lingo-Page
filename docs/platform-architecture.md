# Platform architecture

## Direction

The current extension is the first client of a reusable translation platform. Reuse is achieved through stable domain contracts and narrowly owned adapters, not through a single universal runtime.

```text
Browser / future clients
  -> client-owned capture, consent, presentation, and restore
  -> shared request, language, segment, progress, and error contracts
  -> application API: identity, policy, quotas, routing, jobs, observability
  -> provider adapters: credentials, immutable endpoints, payloads, validation
  -> optional future domain services: session store, TM/glossary, evaluation, analytics
```

## Preserve now

- Pure shared types, validation, configuration, translation core, and UI tokens.
- Backend-only credentials, provider/model allowlists, and no silent fallback.
- Client-specific DOM and Chrome logic inside `apps/extension`.
- API/provider boundaries that can later sit behind durable identity and jobs.

## Candidate evolutions (not selected yet)

| Area                     | Candidate                                                                       | Evidence needed before decision                                                             |
| ------------------------ | ------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Browser variants         | WXT targets plus browser adapters and manifest variants                         | Firefox/Safari permission, lifecycle, packaging, and store prototypes                       |
| Durable browser sessions | Versioned local session journal with page identity and text-minimizing records  | Threat model, storage quota, migration, stale-DOM, deletion, and recovery prototype         |
| Backend jobs             | Durable job/usage records behind authenticated API                              | Identity selection, consistency model, regional/retention needs, cost tests                 |
| Desktop                  | Tauri, native shells, or Electron around shared contracts                       | Accessibility/capture APIs, bundle/security footprint, offline model needs                  |
| Mobile                   | Native or cross-platform client with platform share/accessibility boundaries    | iOS/Android capability and store-policy prototypes                                          |
| Design system            | CSS tokens plus framework-neutral contracts; isolated component workbench later | Component inventory and visual-regression need; avoid dependency until M1 scope approves it |
| Analytics                | Event contract with local aggregation and explicit remote consent               | Metrics purpose, minimization, retention, deletion, opt-out, and privacy review             |

## Backend evolution gates

Production identity, durable quotas, jobs, history, billing, and organization data require versioned storage schemas, migrations, retention/deletion rules, tenant isolation, concurrency tests, recovery/rollback, and privacy disclosures. The current process-local maps must never be represented as production enforcement.

## Data classification

- **Content:** page text, translations, glossary/TM entries, audio, images, documents. Default transient; persistence requires explicit purpose and consent.
- **Identity:** account/session/organization records. Future, short-lived where possible, revocable and deletable.
- **Operational metadata:** bounded counts, durations, status classes, versions, and request IDs. No content or full URLs.
- **Research/evaluation:** synthetic or explicitly licensed/consented data only, isolated from production by default.

## Platform acceptance rule

No candidate becomes architecture merely because it appears in the roadmap. It requires an approved specification, ADR, threat/privacy review, measurable acceptance criteria, and rollback strategy.
