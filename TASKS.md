# Program status

Status: REVIEW

Last reconciled: 2026-07-28

`TASKS.md` is an operational index, not a task-history archive. Detailed work, dependencies, ownership, and acceptance evidence live in Beads; durable scope lives in specifications and `ROADMAP.md`.

## Current milestone

M2 — Reliability, lifecycle resilience, and performance.

- Beads epic: `translation-1mp.3`
- Branch: `milestone/02-reliability-lifecycle-performance`
- Starting commit: `d7b28468744e3c7111d3d8a33e524c554b511c31`
- Specification: `docs/milestones/milestone-2-specification.md`
- Baseline: `docs/milestones/milestone-2-reliability-baseline.md`
- Verification: `docs/milestones/milestone-2-verification-report.md`

## Previous accepted milestones

M1 acceptance fixes were merged to `main` in PR #2 at `1a11629`. M1.5 was squash-merged in PR #3 at `6b0d6fe`; later Beads/process updates brought `main` to `d7b2846`.

- Specification: `docs/milestones/milestone-1-specification.md`
- Verification: `docs/milestones/milestone-1-verification-report.md`
- Architecture decisions: ADR 0007, ADR 0009, and ADR 0010

Branded-Chrome, formal accessibility/RTL, and owner acceptance gaps remain tracked in Beads and `docs/known-limitations.md`; they are not silently treated as current evidence.

## Next milestone dependency

M3 remains planned and must not begin until M2 is reviewed and accepted. The exact dependency is the accepted M2 specification plus complete lifecycle, security, performance, and release-candidate evidence.

See `ROADMAP.md`, `docs/acceptance-criteria.md`, and `docs/verification-matrix.md`.

## Active blockers and owner decisions

- Review M2 evidence and the milestone branch; do not merge automatically.
- Retest the corrected browser-restart build with branded-Chrome Tests A-E. The `fa2135b` restart/Ctrl+Shift+T result remains FAIL until owner evidence replaces it.
- Formal branded-browser accessibility, BiDi, zoom, motion, and owner acceptance remain separate release evidence.
- Live provider calls, payment-provider selection, accounts, deployment, publication, pricing, legal entity/jurisdiction decisions, and public resources require explicit approval.

## Current evidence links

- Current limitations: `docs/known-limitations.md`
- Acceptance criteria: `docs/acceptance-criteria.md`
- Verification matrix: `docs/verification-matrix.md`
- Local operator/UAT: `docs/local-development.md`, `docs/user-acceptance-testing.md`, `docs/user-acceptance-checklist.md`
- Security/privacy: `docs/security-model.md`, `docs/threat-model.md`, `docs/privacy-model.md`
- Beads workflow: run `bd prime`, then `bd show translation-1mp.3`
