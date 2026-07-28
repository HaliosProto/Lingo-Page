# Project memory index

Status: CURRENT

Last reconciled: 2026-07-28

## Durable orientation

- Product: Lingo Page, the privacy-first browser translation client.
- Canonical authority: `PRODUCT_CONSTITUTION.md`, `PRODUCT_VISION.md`, `ROADMAP.md`, approved milestone specifications, ADRs/contracts, then Beads execution state.
- Current milestone: M2 reliability, lifecycle resilience, and large-page performance (`translation-1mp.3`).
- Current branch: `milestone/02-reliability-lifecycle-performance`, based on `d7b28468744e3c7111d3d8a33e524c554b511c31`.
- Head commit at final verification: `62e41a5ed50bea2f074daa4bfbe03e8db4aaf807`; the current branch tip also includes the project-memory reconciliation commit.
- Current review: [draft PR #4](https://github.com/HaliosProto/Lingo-Page/pull/4); do not merge automatically.
- Current verification: repository/static/build, 234 unit tests, 21 API tests, six managed-Chromium scenarios, performance E2E, security scan, and RC packaging pass. The development-tool dependency audit fails with three existing high advisories; physical lifecycle, branded-Chrome, formal accessibility, and forced-GC checks remain open.
- Next milestone: M3 translation quality/context/terminology, blocked until M2 owner review, acceptance, and merge.
- Hard product gate: desktop/mobile implementation remains blocked until M8 extension General Availability acceptance.
- Verified provider baseline: deterministic mock. Live calls require explicit approval, backend-only secrets, synthetic text, and cost/terms review.
- Milestone 1 decisions: page-owned memory remains authoritative for active sessions; switching/scanning reuses it without provider calls; translated-copy and comparison handoffs are bounded, validated, acknowledged, and temporary.
- Current limitations: physical worker/browser restart, sleep/wake, discard/BFCache, forced-GC, branded-browser, formal accessibility/BiDi, owner acceptance, production identity/quotas, deployment/publication, and real-provider evidence remain open in `docs/known-limitations.md` and Beads.

## Where state belongs

- Durable product and architecture decisions: repository specifications and ADRs.
- Issues, dependencies, ownership, and acceptance evidence: Beads.
- Dated verification: milestone or archive reports.
- This file and Beads memories: concise status and links only.

Do not store secrets, keys, tokens, raw page/user text, private endpoints, provider bodies, logs, full source files, ignored environment contents, or copied specifications in project memory.

## Owner gates

External recipients, paid calls, accounts, public resources, deployment/publication, purchases, repository visibility, legal/compliance claims, pricing, production retention, branding, irreversible platform decisions, and material risk acceptance require explicit product-owner approval.

## Milestone 2 orientation

- Branch: `milestone/02-reliability-lifecycle-performance`
- Starting point: `d7b28468744e3c7111d3d8a33e524c554b511c31`
- State: implementation and automated verification complete; draft PR #4 and owner/manual review pending
- Decisions: ADRs 0011–0016 define bounded active recovery, worker reconstruction, navigation generations, mutation backpressure, retry idempotency, and atomic restored-tab reattachment
- Evidence: the 68 deterministic recovery baseline plus restored-tab/atomic-claim tests; managed Chromium covers reload and different-tab-ID `chrome.sessions.restore()` with zero-call reuse; the old branded-Chrome restart result at `fa2135b` remains FAIL pending owner Tests A-E
- Limitations: branded Chrome, physical sleep/restart/discard/BFCache, forced GC, and formal accessibility remain manual
- Pull request: draft PR #4 is open against `main`; branch is unmerged
- M3 dependency: M2 owner review and acceptance; M3 implementation has not begun
