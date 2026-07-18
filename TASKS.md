# Program status

Status: REVIEW

Last reconciled: 2026-07-18

`TASKS.md` is an operational index, not a task-history archive. Detailed work, dependencies, ownership, and acceptance evidence live in Beads; durable scope lives in specifications and `ROADMAP.md`.

## Current milestone

M1.5 — Repository cleanup, extension-first roadmap, and frontend foundation.

- Beads issue: `translation-2np`
- Branch: `chore/repository-cleanup-roadmap-and-extension-ux`
- Starting commit: `1a1162962768c60f29b2848eafa8be76acdd919c`
- Pull request: [draft PR #3](https://github.com/HaliosProto/Translation-Extension/pull/3)
- Specification: the accepted Milestone 1.5 task and Beads acceptance criteria
- Inventory: `docs/repository-cleanup-inventory.md`
- Canonical documentation map: `docs/INDEX.md`
- Verification: `docs/milestones/milestone-1-5-verification-report.md`

## Previous accepted milestone

M1 acceptance fixes were merged to `main` in PR #2 at `1a11629`.

- Specification: `docs/milestones/milestone-1-specification.md`
- Verification: `docs/milestones/milestone-1-verification-report.md`
- Architecture decisions: ADR 0007, ADR 0009, and ADR 0010

Branded-Chrome, formal accessibility/RTL, and owner acceptance gaps remain tracked in Beads and `docs/known-limitations.md`; they are not silently treated as current evidence.

## Next approved milestone

M2 — Reliability, lifecycle resilience, and performance — is the next roadmap milestone but is blocked until M1.5 is reviewed and accepted. No M2 implementation has begun.

See `ROADMAP.md`, `docs/acceptance-criteria.md`, and `docs/verification-matrix.md`.

## Active blockers and owner decisions

- Review and accept the M1.5 branch and draft pull request; do not merge automatically.
- Formal branded-browser accessibility, BiDi, zoom, motion, and owner acceptance remain separate release evidence.
- Live provider calls, payment-provider selection, accounts, deployment, publication, pricing, legal entity/jurisdiction decisions, and public resources require explicit approval.

## Current evidence links

- Current limitations: `docs/known-limitations.md`
- Acceptance criteria: `docs/acceptance-criteria.md`
- Verification matrix: `docs/verification-matrix.md`
- Local operator/UAT: `docs/local-development.md`, `docs/user-acceptance-testing.md`, `docs/user-acceptance-checklist.md`
- Security/privacy: `docs/security-model.md`, `docs/threat-model.md`, `docs/privacy-model.md`
- Beads workflow: run `bd prime`, then `bd show translation-2np`
