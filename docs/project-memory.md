# Project memory index

Status: CURRENT

Last reconciled: 2026-08-03

## Durable orientation

- Product: Lingo Page, the privacy-first browser translation client.
- Canonical authority: `PRODUCT_CONSTITUTION.md`, `PRODUCT_VISION.md`, `ROADMAP.md`, approved milestone specifications, ADRs/contracts, then Beads execution state.
- Current milestone: M3 structured translation intelligence, context, terminology, and quality assurance.
- Current branch: `003-milestone-3`, based on `235b86c306255aba33ff1cc5f3988c8e7d7cc748` (`main` after accepted M2).
- Verified implementation/documentation commit: `f074264689e8a4345a54a8192b8b5ee9e9a49029`; any later branch-tip commit is record-only closure metadata.
- Milestone state: implementation and automated verification are complete; the branch is pushed and remains unmerged pending owner review and acceptance.
- Architecture: validated `TranslationPolicy` -> bounded context/terminology -> versioned structured request -> canonical compiler/capability path -> validated structured response -> deterministic checks -> at most one selective review -> plain-text DOM application.
- Prompt boundary: privileged system/product invariants are separate from bounded untrusted page, context, glossary, terminology, and user-brief data.
- Quality path: deterministic mock and structured fixtures prove one translation call and zero review calls for clean batches; suspicious or selected records may use one review call for at most 50 IDs, with non-destructive failure.
- Current verification: repository/static/build, 271 unit tests, 21 API tests, eight managed-Chromium scenarios, 2,500-segment performance E2E, security scan, and release-candidate packaging pass.
- Current limitations: the 2,206-segment benchmark regressed from the M2 baseline; dependency audit reports six high development-tool advisories; branded Chrome, formal accessibility, physical lifecycle, and live providers remain unverified.
- Pull-request state: branch `003-milestone-3` is pushed; a complete body is prepared at `tmp/milestone-3-pr-description.md` and the GitHub compare page is ready, but no PR was opened because GitHub CLI/integration was unavailable.
- Next milestone: M4 is blocked until M3 owner review, acceptance, and merge.
- Hard product gate: desktop/mobile implementation remains blocked until M8 extension General Availability acceptance.
- Verified provider baseline: deterministic mock. Live calls require explicit approval, backend-only secrets, synthetic text, and cost/terms review.

## Where state belongs

- Durable product and architecture decisions: repository specifications and ADRs.
- Issues, dependencies, ownership, and acceptance evidence: Beads.
- Dated verification: milestone or archive reports.
- This file and Beads memories: concise status and links only.

Do not store secrets, keys, tokens, raw page/user text, private endpoints, provider bodies, logs, full source files, ignored environment contents, or copied specifications in project memory.

## Owner gates

External recipients, paid calls, accounts, public resources, deployment/publication, purchases, repository visibility, legal/compliance claims, pricing, production retention, branding, irreversible platform decisions, and material risk acceptance require explicit product-owner approval.
