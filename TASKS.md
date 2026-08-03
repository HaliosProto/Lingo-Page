# Program status

Status: REVIEW

Last reconciled: 2026-08-03

`TASKS.md` is an operational index, not a task-history archive. Detailed work, dependencies, ownership, and acceptance evidence live in Beads; durable scope lives in specifications and `ROADMAP.md`.

## Current milestone

M3 — Structured translation intelligence, context, terminology, and quality assurance.

- Beads epic: `Lingo-Page-68x`
- Branch: `003-milestone-3`
- Starting commit: `235b86c306255aba33ff1cc5f3988c8e7d7cc748`
- Specification: `docs/milestones/milestone-3-specification.md`
- Verification: `docs/milestones/milestone-3-verification-report.md`
- Beads state: epic `Lingo-Page-68x` and tasks `.1` through `.8` are closed with implementation, verification, documentation, and handoff evidence.
- Verified implementation/documentation commit: `f074264689e8a4345a54a8192b8b5ee9e9a49029`; the branch is pushed and remains unmerged.
- Pull-request handoff: complete body at `tmp/milestone-3-pr-description.md`; use the GitHub compare page for `main...003-milestone-3`. No PR was opened because GitHub CLI/integration was unavailable.

## Previous accepted milestones

M1 acceptance fixes were merged to `main` in PR #2 at `1a11629`. M1.5 was squash-merged in PR #3 at `6b0d6fe`. M2 was merged in PR #4 at `235b86c`.

- M1 specification and evidence: `docs/milestones/milestone-1-specification.md`, `docs/milestones/milestone-1-verification-report.md`
- M1.5 evidence: `docs/milestones/milestone-1-5-verification-report.md`
- M2 specification and evidence: `docs/milestones/milestone-2-specification.md`, `docs/milestones/milestone-2-verification-report.md`

Historical branded-Chrome, formal accessibility/RTL, physical lifecycle, and owner-acceptance gaps remain tracked in `docs/known-limitations.md`; they are not silently treated as current evidence.

## Next milestone dependency

M4 must not begin until M3 policy, prompt, structured output, context, terminology, quality review, cache identity, UI, security/privacy, managed-browser, performance, and release-candidate evidence is accepted.

See `ROADMAP.md`, `docs/acceptance-criteria.md`, and `docs/verification-matrix.md`.

## Active blockers and owner decisions

- Owner review and acceptance remain required. Review the measured large-page regression, six development-tool audit advisories, managed-browser screenshots, release candidate, and complete PR handoff before merge.
- Retest the corrected M2 browser-restart build with branded-Chrome Tests A–E. Historical branded-Chrome gaps remain explicit and are not M3 automated evidence.
- Formal branded-browser accessibility, BiDi, zoom, motion, and owner acceptance remain separate release evidence.
- Live provider calls, accounts, cloud sync, billing, deployment, publication, pricing, legal decisions, and public resources require separate explicit approval.

## Current evidence links

- Current limitations: `docs/known-limitations.md`
- Acceptance criteria: `docs/acceptance-criteria.md`
- Verification matrix: `docs/verification-matrix.md`
- Local operator/UAT: `docs/local-development.md`, `docs/user-acceptance-testing.md`, `docs/user-acceptance-checklist.md`
- Security/privacy: `docs/security-model.md`, `docs/threat-model.md`, `docs/privacy-model.md`
- Beads workflow: run `bd prime`, then `bd show Lingo-Page-68x`
