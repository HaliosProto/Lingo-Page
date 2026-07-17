# Project memory index and Obsidian policy

## Quick orientation

- Product: Lingo Page, the first privacy-first browser client of the Lingo multilingual platform.
- Current program state: Milestone 1 is implemented and locally verified on `milestone/01-durable-translation-sessions`; branch review and separate owner acceptance remain the active gate. Milestone 2 has not begun.
- Starting source: `f011f6fb85c2f6e1a79541f1ee4ed4aac1c436c6`. The branch `HEAD` and `docs/milestone-1-verification-report.md` become authoritative after the milestone commit.
- Canonical sources: `PRODUCT_CONSTITUTION.md`, `PRODUCT_VISION.md`, `ROADMAP.md`, `TASKS.md`, `AGENTS.md`, approved milestone specs, `docs/architecture.md`, contracts, security/privacy/threat documents, acceptance criteria, and verification reports.
- Execution graph: Beads. Run `bd prime`; use `bd ready/show/update/close`; use `bd remember` for short durable facts.
- Specification templates: repository workflow is active; CLI integration remains pending the safe plan in `docs/tooling-and-workflow.md`.
- Handoffs: dated milestone verification reports in `docs/`, plus Beads issue comments/status.
- Milestone 1 decisions: page-shell memory owns normal sessions; display mode is independent from lifecycle; translated copies clone bounded bundles; comparison uses an owning-tab single-use `chrome.storage.session` token; full restart persistence is deferred. Canonical sources are `docs/milestone-1-specification.md`, ADR 0007, and ADR 0009.

## Memory and Obsidian role

An Obsidian vault may hold decision summaries, research/competitive notes, owner preferences, meeting notes, experiments, rejected alternatives, lessons, and handoffs. Every note links to the canonical repository source and carries one status: proposed, approved, implemented, superseded, or rejected.

Capture -> link -> label status -> review at milestone close -> promote durable decisions into repository docs -> archive stale notes. A vault is optional and must never become the only copy of a critical decision or override repository specifications.

## Prohibited memory content

Secrets, API keys, tokens, credential values, raw private user/page content, private provider endpoints, authorization headers, production logs, full source-file copies, unredacted diagnostics, and contradictory unlabeled instructions. Do not paste ignored environment files or generated bundles into notes.

## Owner gates

External accounts/data recipients, paid calls, public resources, deployment/publication, purchases, repository visibility, legal/privacy/compliance claims, production retention, branding/pricing, physical-device access, irreversible platform choices, and material risk acceptance require product-owner approval.

## Vault status

No repository-tracked Obsidian vault is required or created. If the owner selects a private vault later, store only links and sanitized notes; keep vault configuration/caches private unless a separate review approves specific tracked templates.
