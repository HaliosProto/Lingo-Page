# Documentation index

Status: CURRENT

Last reconciled: 2026-08-03

## Source-of-truth hierarchy

When documents disagree, use this order and reconcile the lower source:

1. `PRODUCT_CONSTITUTION.md`
2. `PRODUCT_VISION.md`
3. `ROADMAP.md`
4. Approved milestone specifications
5. ADRs and architecture contracts
6. Beads issue and dependency state
7. Implementation and automated tests
8. Milestone verification reports
9. `docs/project-memory.md` and concise Beads memories
10. Historical and archived material

Each requirement or decision has one canonical home. Operational indexes and historical reports link to that home instead of copying it.

## Canonical document map

| Canonical document                                          | Purpose                                                                  | Status  | Owner / source of truth                | Related milestone | Replaces or constrains                 | Historical evidence                         |
| ----------------------------------------------------------- | ------------------------------------------------------------------------ | ------- | -------------------------------------- | ----------------- | -------------------------------------- | ------------------------------------------- |
| `PRODUCT_CONSTITUTION.md`                                   | Durable product, data-rights, engineering, and decision constraints      | CURRENT | Product owner                          | All               | All lower-level policy                 | ADRs and milestone reports                  |
| `PRODUCT_VISION.md`                                         | Product direction and family boundaries                                  | CURRENT | Product owner                          | All               | Product-family prose elsewhere         | `docs/current-state-audit.md`               |
| `ROADMAP.md`                                                | Sole milestone order and extension-GA gate                               | CURRENT | Product owner                          | M1-M12            | Archived pre-M1.5 roadmaps             | Changelog and milestone reports             |
| `TASKS.md`                                                  | Concise current operational index                                        | ACTIVE  | Current milestone owner                | M3                | Historical task dumps                  | Beads closure evidence                      |
| `docs/product-spec.md`                                      | Current browser-extension product behavior                               | CURRENT | Product specification                  | M1-M8             | Feature summaries elsewhere            | MVP and milestone reports                   |
| `docs/architecture.md`                                      | Implemented system boundaries and state ownership                        | CURRENT | Architecture contract                  | M1-M8             | Audit descriptions when they conflict  | Architecture audits and ADRs                |
| `docs/api-contracts.md`                                     | Cross-boundary messages and API behavior                                 | CURRENT | Runtime schemas and API implementation | M1-M8             | Duplicated message prose               | Integration tests                           |
| `docs/provider-architecture.md`                             | Provider registry, allowlists, credentials, retries, and response policy | CURRENT | Backend/provider implementation        | M1-M8             | Provider notes elsewhere               | Provider verification report                |
| `docs/security-model.md`                                    | Security controls and trust boundaries                                   | CURRENT | Security model                         | All               | Security summaries elsewhere           | Security baseline and scans                 |
| `docs/privacy-model.md`                                     | Data lifecycle, recipients, persistence, and deletion                    | CURRENT | Privacy model                          | All               | Privacy summaries elsewhere            | Verification reports                        |
| `docs/threat-model.md`                                      | Threats, mitigations, and residual risks                                 | CURRENT | Threat model                           | All               | Ad hoc threat lists                    | Security baseline                           |
| `docs/accessibility.md`                                     | Accessibility requirements and evidence gaps                             | CURRENT | Frontend acceptance                    | M1-M8             | UI accessibility summaries             | Browser evidence                            |
| `docs/bidi-safety.md`                                       | RTL/LTR and mixed-direction safety                                       | CURRENT | Frontend/DOM acceptance                | M1-M8             | Directionality summaries               | Browser evidence                            |
| `docs/testing-strategy.md`                                  | Test layers and fixture policy                                           | CURRENT | Repository commands and tests          | All               | Test prose elsewhere                   | Verification reports                        |
| `docs/verification-matrix.md`                               | Required evidence by behavior/milestone                                  | CURRENT | Acceptance process                     | All               | Informal checklists                    | Milestone reports                           |
| `docs/milestones/milestone-1-5-verification-report.md`      | M1.5 repository, frontend, and verification evidence                     | CURRENT | M1.5 acceptance process                | M1.5              | Informal completion claims             | Commands, browser evidence, and limitations |
| `docs/milestones/milestone-2-specification.md`              | Accepted lifecycle, resilience, privacy, and performance contract        | CURRENT | Product-owner M2 brief                 | M2                | Broad roadmap prose                    | M2 baseline and verification report         |
| `docs/milestones/milestone-2-verification-report.md`        | M2 implementation and acceptance evidence                                | ACTIVE  | M2 acceptance process                  | M2                | Informal completion claims             | Commands, browser evidence, and limitations |
| `docs/decisions/0016-restored-tab-session-reattachment.md`  | Restored-tab identity, permission, atomic claim, and cleanup decision    | CURRENT | Architecture decision                  | M2                | ADR 0011 exact-tab restart limit       | M2 restart acceptance evidence              |
| `docs/milestones/milestone-3-specification.md`              | Accepted structured translation intelligence contract                    | CURRENT | Product-owner M3 brief                 | M3                | Broad roadmap prose                    | M3 verification report                      |
| `docs/milestones/milestone-3-verification-report.md`        | M3 implementation and acceptance evidence                                | ACTIVE  | M3 acceptance process                  | M3                | Informal completion claims             | Commands, browser evidence, and limitations |
| `docs/decisions/0017-structured-translation-policy.md`      | Versioned policy, defaults, precedence, and migration decision           | CURRENT | Architecture decision                  | M3                | Scattered tone/formality fields        | Policy/schema tests                         |
| `docs/decisions/0018-canonical-prompt-compiler.md`          | Canonical prompt and untrusted-data separation decision                  | CURRENT | Architecture decision                  | M3                | Adapter-owned prompt semantics         | Compiler/injection tests                    |
| `docs/decisions/0019-provider-neutral-structured-output.md` | Provider-neutral response and local validation decision                  | CURRENT | Architecture decision                  | M3                | Provider-specific response assumptions | Structured-output tests                     |
| `docs/decisions/0020-bounded-terminology-memory.md`         | Page-session terminology and glossary isolation decision                 | CURRENT | Architecture decision                  | M3                | Unbounded or remote learning           | Terminology/glossary tests                  |
| `docs/decisions/0021-selective-quality-review.md`           | Deterministic checks and bounded selective review decision               | CURRENT | Architecture decision                  | M3                | Unconditional double-pass review       | Provider-call tests                         |
| `docs/decisions/0022-policy-aware-cache-identity.md`        | Semantic policy/context cache and recovery identity decision             | CURRENT | Architecture decision                  | M3                | Narrow tone/formality cache key        | Cache-identity tests                        |
| `docs/known-limitations.md`                                 | Current unverified or unsupported behavior                               | CURRENT | Latest verified state                  | Current           | Stale limitation claims                | Dated reports                               |
| `docs/project-memory.md`                                    | Concise orientation and links only                                       | ACTIVE  | Canonical sources above                | Current           | Duplicated specifications              | Beads memories                              |

## Document families

- Product and roadmap: `PRODUCT_CONSTITUTION.md`, `PRODUCT_VISION.md`, `ROADMAP.md`, `docs/product-spec.md`.
- Architecture and decisions: `docs/architecture.md`, `docs/api-contracts.md`, `docs/translation-pipeline.md`, `docs/provider-architecture.md`, `docs/decisions/`.
- Design and inclusion: `docs/design-strategy.md`, `docs/design-system-plan.md`, `docs/frontend-verification-plan.md`, `docs/accessibility.md`, `docs/bidi-safety.md`.
- Security and privacy: `SECURITY.md`, `PRIVACY_ENGINEERING.md`, `docs/security-model.md`, `docs/threat-model.md`, `docs/privacy-model.md`, `docs/data-retention.md`.
- Billing and entitlements: `docs/billing/architecture.md` (provider-neutral M6-M8 draft; not implementation authority).
- Testing and operations: `docs/testing-strategy.md`, `docs/verification-matrix.md`, `docs/performance-targets.md`, `docs/local-development.md`, and user-acceptance documents.
- Research and market planning: `docs/research-registry.md`, the experiment template, competitive, provider, marketing, and positioning documents. Drafts do not authorize implementation.
- Milestone specifications and evidence: `docs/milestones/`.
- Historical evidence: `docs/archive/`.

## Status labels

- **CURRENT**: active source of truth.
- **ACTIVE**: current milestone or owner action.
- **DRAFT**: proposed or research material without implementation authority.
- **HISTORICAL**: dated evidence retained without being current proof.
- **SUPERSEDED**: replaced by a named canonical document.
- **ARCHIVED**: historical material moved out of the active document set.

The pre-change file-by-file classification and cleanup safety record is in `docs/repository-cleanup-inventory.md`.
