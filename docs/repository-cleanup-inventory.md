# Milestone 1.5 repository cleanup inventory

Status: ACTIVE

Inventory date: 2026-07-18

Baseline: `1a1162962768c60f29b2848eafa8be76acdd919c`

## Purpose

This inventory classifies every tracked Markdown document before Milestone 1.5 structural changes. A move, consolidation, archive, or deletion is allowed only after reference checks confirm that canonical information and historical evidence remain available.

## Classification rules

- **Canonical/current**: an active source of truth or operational contract.
- **Active milestone specification**: approved scope and acceptance for work in progress.
- **Historical verification evidence**: dated evidence that must not be rewritten as current proof.
- **ADR**: an accepted architectural decision with durable rationale.
- **Draft**: useful planning or research material that is not an implementation authority.
- **Duplicate**: material whose authoritative content exists elsewhere.
- **Superseded**: replaced by a named canonical source.
- **Archive candidate**: valuable historical context that should move to a consistent historical location.
- **Safe deletion candidate**: redundant material whose useful instructions are preserved elsewhere.

## Root documents

| File                                       | Classification    | Status                  | Canonical role or planned treatment                                                 |
| ------------------------------------------ | ----------------- | ----------------------- | ----------------------------------------------------------------------------------- |
| `README.md`                                | Canonical/current | CURRENT                 | Repository entry point; link to `docs/INDEX.md` and current operating paths.        |
| `PRODUCT_CONSTITUTION.md`                  | Canonical/current | CURRENT                 | Highest product and engineering authority.                                          |
| `PRODUCT_VISION.md`                        | Canonical/current | CURRENT                 | Product direction and durable principles.                                           |
| `ROADMAP.md`                               | Canonical/current | CURRENT                 | Sole milestone order and extension General Availability gate.                       |
| `TASKS.md`                                 | Canonical/current | ACTIVE                  | Concise operational index; remove historical task-detail duplication.               |
| `AGENTS.md`                                | Canonical/current | CURRENT                 | Durable repository operating instructions only.                                     |
| Legacy root instruction compatibility file | Duplicate         | SAFE DELETION CANDIDATE | Remove after confirming `AGENTS.md` preserves the durable repository instructions.  |
| `CHANGELOG.md`                             | Canonical/current | CURRENT                 | Chronological product and repository change history.                                |
| `CONTRIBUTING.md`                          | Canonical/current | CURRENT                 | Human contribution entry point.                                                     |
| `SECURITY.md`                              | Canonical/current | CURRENT                 | Security reporting entry point; detailed model remains in `docs/security-model.md`. |
| `PRIVACY_ENGINEERING.md`                   | Canonical/current | CURRENT                 | Privacy entry point; detailed model remains in `docs/privacy-model.md`.             |

## Product, roadmap, and program documents

| File                                 | Classification                   | Status     | Canonical role or planned treatment                                                       |
| ------------------------------------ | -------------------------------- | ---------- | ----------------------------------------------------------------------------------------- |
| `docs/product-spec.md`               | Canonical/current                | CURRENT    | Current Lingo Page product behavior and scope.                                            |
| `docs/milestones.md`                 | Superseded                       | HISTORICAL | Preserve as the pre-M1.5 milestone plan; `ROADMAP.md` is authoritative.                   |
| `docs/future-platform-roadmap.md`    | Duplicate                        | SUPERSEDED | Consolidate durable future-platform boundaries into `ROADMAP.md` and `PRODUCT_VISION.md`. |
| `docs/current-state-audit.md`        | Historical verification evidence | HISTORICAL | Dated pre-Milestone 1 program audit.                                                      |
| `docs/current-architecture-audit.md` | Historical verification evidence | HISTORICAL | Dated architecture/lifecycle baseline; retain as evidence.                                |
| `docs/risk-register.md`              | Canonical/current                | CURRENT    | Active cross-program risks and mitigations.                                               |
| `docs/project-memory.md`             | Canonical/current                | ACTIVE     | Concise orientation only; reconcile stale branch/status claims.                           |
| `docs/repository-and-environment.md` | Historical verification evidence | HISTORICAL | Initial repository/environment assessment.                                                |

## Architecture, API, and provider documents

| File                                      | Classification                   | Status     | Canonical role or planned treatment                             |
| ----------------------------------------- | -------------------------------- | ---------- | --------------------------------------------------------------- |
| `docs/architecture.md`                    | Canonical/current                | CURRENT    | Current implemented system architecture.                        |
| `docs/platform-architecture.md`           | Draft                            | DRAFT      | Future cross-client boundary plan; subordinate to `ROADMAP.md`. |
| `docs/api-contracts.md`                   | Canonical/current                | CURRENT    | Current API/message contracts.                                  |
| `docs/translation-pipeline.md`            | Canonical/current                | CURRENT    | Current translation lifecycle contract.                         |
| `docs/provider-architecture.md`           | Canonical/current                | CURRENT    | Provider boundary, registry, and request policy.                |
| `docs/provider-evaluation.md`             | Draft                            | DRAFT      | Provider selection research; no live-provider approval.         |
| `docs/provider-benchmark-human-review.md` | Draft                            | DRAFT      | Human-review worksheet for explicitly approved benchmarks.      |
| `docs/backend-evaluation.md`              | Historical verification evidence | HISTORICAL | Rationale supporting ADR 0002.                                  |
| `docs/framework-evaluation.md`            | Historical verification evidence | HISTORICAL | Rationale supporting ADR 0001.                                  |

## Design, accessibility, and BiDi documents

| File                                 | Classification    | Status  | Canonical role or planned treatment                            |
| ------------------------------------ | ----------------- | ------- | -------------------------------------------------------------- |
| `docs/design-strategy.md`            | Canonical/current | CURRENT | Product interaction principles and UX direction.               |
| `docs/design-system-plan.md`         | Draft             | ACTIVE  | Convert from plan to implemented frontend-foundation contract. |
| `docs/frontend-verification-plan.md` | Draft             | ACTIVE  | Convert into the Milestone 1.5 runtime audit/evidence record.  |
| `docs/accessibility.md`              | Canonical/current | CURRENT | Accessibility contract and honest evidence gaps.               |
| `docs/bidi-safety.md`                | Canonical/current | CURRENT | RTL/LTR and mixed-direction safety contract.                   |

## Security and privacy documents

| File                        | Classification                   | Status     | Canonical role or planned treatment                      |
| --------------------------- | -------------------------------- | ---------- | -------------------------------------------------------- |
| `docs/security-model.md`    | Canonical/current                | CURRENT    | Security controls and trust boundaries.                  |
| `docs/threat-model.md`      | Canonical/current                | CURRENT    | Threats, mitigations, and residual risk.                 |
| `docs/privacy-model.md`     | Canonical/current                | CURRENT    | Data lifecycle and recipient policy.                     |
| `docs/data-retention.md`    | Canonical/current                | CURRENT    | Retention, deletion, and future intelligence boundaries. |
| `docs/security-baseline.md` | Historical verification evidence | HISTORICAL | Dated defensive-review baseline.                         |
| `docs/known-limitations.md` | Canonical/current                | CURRENT    | Current verified limitations and release gaps.           |

## Testing, verification, and operations documents

| File                                             | Classification                   | Status     | Canonical role or planned treatment                         |
| ------------------------------------------------ | -------------------------------- | ---------- | ----------------------------------------------------------- |
| `docs/acceptance-criteria.md`                    | Canonical/current                | CURRENT    | Milestone acceptance requirements.                          |
| `docs/verification-matrix.md`                    | Canonical/current                | CURRENT    | Required evidence by behavior and milestone.                |
| `docs/testing-strategy.md`                       | Canonical/current                | CURRENT    | Test layers, fixtures, and command policy.                  |
| `docs/performance-targets.md`                    | Canonical/current                | CURRENT    | Performance budgets and measurement rules.                  |
| `docs/browser-compatibility.md`                  | Canonical/current                | CURRENT    | Browser support and verification policy.                    |
| `docs/local-development.md`                      | Canonical/current                | CURRENT    | Local operator and release-candidate runbook.               |
| `docs/user-acceptance-testing.md`                | Canonical/current                | CURRENT    | Manual owner acceptance procedure.                          |
| `docs/user-acceptance-checklist.md`              | Canonical/current                | ACTIVE     | Outstanding owner acceptance checklist.                     |
| `docs/user-action-checklist.md`                  | Canonical/current                | ACTIVE     | Product-owner decisions and external actions.               |
| `docs/mvp-verification-report.md`                | Historical verification evidence | HISTORICAL | Local MVP evidence; archive consistently.                   |
| `docs/universal-provider-verification-report.md` | Historical verification evidence | HISTORICAL | Provider architecture verification; archive consistently.   |
| `docs/milestone-0-verification-report.md`        | Historical verification evidence | HISTORICAL | Milestone 0 closure evidence; move with milestone records.  |
| `docs/milestone-1-specification.md`              | Active milestone specification   | CURRENT    | Accepted Milestone 1 contract; move with milestone records. |
| `docs/milestone-1-verification-report.md`        | Historical verification evidence | HISTORICAL | Milestone 1 closure evidence; move with milestone records.  |
| `docs/v2-performance-baseline.md`                | Historical verification evidence | HISTORICAL | Dated browser performance/lifecycle evidence.               |

## Research, market, and workflow documents

| File                                   | Classification    | Status  | Canonical role or planned treatment                    |
| -------------------------------------- | ----------------- | ------- | ------------------------------------------------------ |
| `docs/research-registry.md`            | Canonical/current | CURRENT | Research questions, evidence, and decision status.     |
| `docs/research-experiment-template.md` | Canonical/current | CURRENT | Approved experiment template.                          |
| `docs/competitive-parity.md`           | Draft             | DRAFT   | Competitive research program; not a feature authority. |
| `docs/marketing-strategy.md`           | Draft             | DRAFT   | Marketing plan; subordinate to product evidence.       |
| `docs/positioning-and-messaging.md`    | Draft             | DRAFT   | Messaging hypotheses; no unsupported launch claims.    |
| `docs/spec-driven-workflow.md`         | Canonical/current | CURRENT | Specification and acceptance workflow.                 |
| `docs/tooling-and-workflow.md`         | Canonical/current | CURRENT | Repository tools, Beads, and execution boundaries.     |

## Architecture decisions

| Files                                                                                                           | Classification | Status  | Canonical role or planned treatment                              |
| --------------------------------------------------------------------------------------------------------------- | -------------- | ------- | ---------------------------------------------------------------- |
| `docs/decisions/0001-extension-framework.md` through `0004-dom-preservation.md`                                 | ADR            | CURRENT | Accepted framework, backend, provider, and DOM-safety decisions. |
| `docs/decisions/0005-program-workflow.md` through `0008-design-analytics-routing-research.md`                   | ADR            | CURRENT | Accepted program-boundary and research decisions.                |
| `docs/decisions/0009-copy-and-comparison-session-handoff.md` and `0010-sanitized-full-page-split-comparison.md` | ADR            | CURRENT | Accepted Milestone 1 copy/comparison security architecture.      |

## Non-document repository material

| Area                                               | Classification                  | Treatment                                                                                              |
| -------------------------------------------------- | ------------------------------- | ------------------------------------------------------------------------------------------------------ |
| `.beads/` and local Dolt state                     | Generated task state            | Preserve issues, dependencies, status, evidence, and canonical links; do not duplicate specifications. |
| Local Beads workflow integration                   | Local workflow integration      | Preserve the project-local Beads workflow; keep generated setup from owning `AGENTS.md`.               |
| `.local/` and other local tool configuration       | Local development configuration | Keep untracked/ignored; never publish local caches or wrappers.                                        |
| `.output/`, `.wxt/`, `artifacts/`, `test-results/` | Generated                       | Keep ignored; regenerate from canonical commands.                                                      |
| `apps/api/.dev.vars`                               | Ignored secret configuration    | Keep ignored and untracked; never move, print, or bundle.                                              |

## Reference-check result before reorganization

- `origin/main` and local `main` both point to `1a11629`, which contains PR #2 Milestone 1 acceptance fixes.
- The worktree was clean before this inventory.
- `apps/api/.dev.vars` is ignored and untracked.
- The initial managed-Chromium baseline passed three E2E scenarios and produced ignored visual evidence.
- No tracked temporary build, test-result, release-artifact, `.dev.vars`, or log file was found.
- Historical milestone/specification paths have repository-wide references and must be updated atomically if moved.

## Applied cleanup outcome

- Added `docs/INDEX.md` as the canonical map and documented the authority hierarchy without duplicating specifications.
- Moved Milestone 0/1 records into `docs/milestones/` and older MVP/provider/performance/roadmap evidence into `docs/archive/`; Git history is preserved as renames.
- Consolidated the durable future-platform sequence and extension-first gate into `ROADMAP.md`, then removed the fully superseded `docs/future-platform-roadmap.md`.
- Retained `CLAUDE.md` only as a short compatibility pointer to `AGENTS.md`; it no longer carries a second operating-policy copy.
- Refactored `TASKS.md`, `AGENTS.md`, and `docs/project-memory.md` around their distinct operational, durable-instruction, and concise-orientation roles.
- Updated active references in repository documents and added repeatable Markdown-link and workspace-cycle checks.
- Preserved every ADR, security/privacy baseline, threat model, verification report, changelog record, research decision, and release-evidence document.
