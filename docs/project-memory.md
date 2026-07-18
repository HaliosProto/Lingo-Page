# Project memory index

Status: CURRENT

Last reconciled: 2026-07-18

## Durable orientation

- Product: Lingo Page, the privacy-first browser translation client.
- Canonical authority: `PRODUCT_CONSTITUTION.md`, `PRODUCT_VISION.md`, `ROADMAP.md`, approved milestone specifications, ADRs/contracts, then Beads execution state.
- Current milestone: M1.5 repository cleanup, extension-first roadmap, and frontend foundation (`translation-2np`).
- Current branch: `chore/repository-cleanup-roadmap-and-extension-ux`, based on `1a11629` after PR #2 merged.
- Current review: [draft PR #3](https://github.com/HaliosProto/Translation-Extension/pull/3); do not merge automatically.
- Current verification: automated/static, managed-Chromium, performance, security, documentation, packaging, and Git-hygiene evidence is recorded in `docs/milestones/milestone-1-5-verification-report.md`; owner review remains pending.
- Next milestone: M2 reliability/lifecycle/performance, blocked until M1.5 review and acceptance.
- Hard product gate: desktop/mobile implementation remains blocked until M8 extension General Availability acceptance.
- Verified provider baseline: deterministic mock. Live calls require explicit approval, backend-only secrets, synthetic text, and cost/terms review.
- Milestone 1 decisions: page-owned memory remains authoritative for active sessions; switching/scanning reuses it without provider calls; translated-copy and comparison handoffs are bounded, validated, acknowledged, and temporary.
- Current limitations: branded-browser, formal accessibility/BiDi, owner acceptance, production identity/quotas, deployment/publication, and real-provider evidence remain open in `docs/known-limitations.md` and Beads.

## Where state belongs

- Durable product and architecture decisions: repository specifications and ADRs.
- Issues, dependencies, ownership, and acceptance evidence: Beads.
- Dated verification: milestone or archive reports.
- This file and Beads memories: concise status and links only.

Do not store secrets, keys, tokens, raw page/user text, private endpoints, provider bodies, logs, full source files, ignored environment contents, or copied specifications in project memory.

## Owner gates

External recipients, paid calls, accounts, public resources, deployment/publication, purchases, repository visibility, legal/compliance claims, pricing, production retention, branding, irreversible platform decisions, and material risk acceptance require explicit product-owner approval.
