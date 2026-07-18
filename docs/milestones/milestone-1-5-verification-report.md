# Milestone 1.5 verification report

Status: CURRENT - implementation verified; owner review pending

Date: 2026-07-18

Branch: `chore/repository-cleanup-roadmap-and-extension-ux`

Starting commit: `1a1162962768c60f29b2848eafa8be76acdd919c`

Review: [draft PR #3](https://github.com/HaliosProto/Translation-Extension/pull/3)

## Scope verified

- Repository inventory, canonical-document hierarchy, historical preservation, old-path reconciliation, and concise task/instruction/memory boundaries.
- Extension-first M1-M12 roadmap, hard M8 General Availability gate, and explicit block on desktop/mobile implementation.
- Provider-neutral billing/entitlement/usage architecture with backend authority and no payment-provider configuration.
- Shared UI tokens/primitives and consistent popup, Options, and comparison action/status hierarchy.
- Managed-browser state, responsive, keyboard, directionality, reduced-motion, permission, recovery, and provider-error coverage.
- Repository formatting, lint, types, tests, builds, security, package inspection, documentation links, dependency cycles, Beads, and Git hygiene.

## Verification evidence

| Check                          | Result                                                                                                                                                                 |
| ------------------------------ | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| `pnpm verify`                  | Passed: Prettier, ESLint, strict package/API/extension types, 166 unit tests, 21 API integration tests, production extension build, and Worker dry run.                |
| `pnpm test:e2e`                | Passed: five managed-Chromium scenarios covering the extension shell, incomplete-response recovery, provider outage, translated-copy hydration, and permission denial. |
| `pnpm test:e2e:performance`    | Passed: one managed-Chromium large-page baseline through 2,206 eligible segments with zero provider calls during copy/comparison reuse.                                |
| `pnpm security:scan`           | Passed: extension boundaries and configured secret values checked without display.                                                                                     |
| `pnpm build:release-candidate` | Passed: full gate, production package, permission/manifest/bundle/source-map/secret inspection, checksums, and ignored local artifacts.                                |
| `pnpm docs:check`              | Passed: local Markdown targets in 74 files.                                                                                                                            |
| `pnpm deps:cycles`             | Passed: no cycles across nine workspace packages.                                                                                                                      |
| `bd lint`                      | Passed: no issue template warnings.                                                                                                                                    |
| Git checks                     | Passed: old active paths absent, diff checks clean, `.dev.vars` and local/generated/build/test artifacts ignored and untracked, main unchanged.                        |

The repository now enforces LF for text and CRLF only for `.bat`/`.cmd`. No bulk renormalization was committed: the 44 formatter-reported paths had zero content diff, zero whitespace-insensitive diff, zero word-level diff, and matching clean-filter hashes. The only related semantic fix imports `node:process` in the two repository validation scripts.

## Managed browser evidence

The ignored `artifacts/milestone-1-visual-baseline/` captures include no-session, translating, complete, partial/cancelled, original/translated, no-change/changed/updated, permission denied, translated-copy ready, provider error, restricted page, dark/reduced-motion Options, default/dark/narrow/200% comparison, and RTL/LTR/mixed-direction states.

Visual inspection and numeric assertions found no cropped controls, overlapping labels, horizontal document overflow, color-only state, broken BiDi ordering, or inconsistent semantic action styling. Long popup states remain vertically scrollable by design.

## Failures encountered and resolved

- PowerShell blocked the global package-manager shim; an ignored local wrapper selected the already cached pinned version and was never staged.
- Sandbox process spawning blocked Vitest/Vite and managed Chromium; the same commands passed outside the sandbox.
- A pre-existing local API process locked runtime dependencies during repair; only the affected API subtree was stopped and restored.
- Permission-denial simulation polluted the original browser context; denial and real grant/hydration were separated into independent contexts.
- New repository scripts initially relied on an implicit Node global; explicit `node:process` imports resolved ESLint without changing validation behavior.

## Not verified

- Branded Chrome unpacked-extension acceptance.
- Formal screen-reader, contrast/high-contrast, 400% zoom, or OS-level reduced-motion confirmation.
- Live real-provider behavior or quality; no paid/provider call was made.
- Production identity, durable quotas, deployment, store submission, billing implementation, or payment-provider behavior.

These remain current limitations or future milestone gates. They are not represented as completed evidence.

## Scope confirmation

- `main` was not modified directly.
- The branch was not merged.
- M2, desktop, mobile, Vision/audio/meetings, and Studio implementation did not begin.
