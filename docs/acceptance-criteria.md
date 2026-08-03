# Acceptance criteria

Status: CURRENT

`ROADMAP.md` defines milestone order. This document defines observable gates; implementation existence alone is not acceptance.

## Global gate

- Scope remains within the approved milestone and preserves the product constitution.
- Security/privacy, package boundaries, runtime validation, least privilege, plain-text DOM mutation, exact restore safety, and backend-only credentials remain intact.
- Success, failure, boundary, cancellation/recovery, navigation, and adjacent regression cases have proportionate tests.
- Applicable formatting, lint, strict types, unit/integration, production build, runtime, managed-browser, security, documentation, and diff checks pass.
- Branded-browser, assistive-technology, persistence, provider, or external-system claims are made only from the exact evidence performed.
- Living specifications, ADRs, limitations, tasks, changelog, and verification evidence are reconciled; historical reports remain historical.
- The final diff contains only intentional files, no secrets/ignored environment data/generated clutter, and no concealed high-severity issue.

## M1 — completed contract

- Original/Translation switching and scans reuse retained page-owned state with zero provider calls after full, partial, or cancelled translation.
- Change scans distinguish confident new/modified/removed/reordered records from uncertain duplicates; updates transmit only confident eligible changes.
- Translated copies request only the explicit current HTTP(S) origin, validate/recheck navigation, reconcile one bounded hydration pass, acknowledge final translated DOM, preserve the visible destination on failure, and remain source-isolated.
- Comparison reconstructs bounded allowlisted structure as inert read-only content, supports linked/unlinked scroll, keyboard/pointer divider, reset/swap, responsive/BiDi/motion states, and single-use handoff.
- Adaptive recovery preserves valid stable-ID results, retries unresolved IDs only with bounded splitting, continues the queue, and reports honest unresolved state without unsafe recursive retries.
- End session is separately confirmed, restores originals, cancels work, stops observers/timers, and clears only the owning tab session.
- Managed long-page, accessibility, BiDi, permission, manifest, bundle, and security evidence is recorded in `docs/milestones/milestone-1-verification-report.md`; formal and branded-browser gaps remain explicit.

## M1.5 — active gate

### Repository and documentation

- `docs/INDEX.md` identifies the canonical hierarchy, purpose, status, source of truth, related milestone, superseded replacements, and historical evidence locations.
- Every pre-change document is classified in `docs/repository-cleanup-inventory.md` before structural changes.
- Historical milestone evidence is preserved under `docs/milestones/` or `docs/archive/`; all active references are updated and valid.
- `TASKS.md` is a concise current operational index; `AGENTS.md` contains durable repository instructions; Beads/memory hold concise execution state and links rather than copied specifications.
- Duplicate roadmap material is consolidated into `ROADMAP.md`; confirmed junk is removed only after reference checks; no canonical information is lost.

### Roadmap and billing

- The sequence is M1, M1.5, M2 reliability, M3 quality/context, M4 finished extension UX, M5 advanced browser features, M6 accounts/usage, M7 payments, M8 cross-browser GA, then M9 desktop, M10 mobile, M11 Vision/audio/meetings, and M12 Studio/enterprise.
- M8 is a hard commercial extension-GA gate; desktop/mobile implementation is explicitly blocked until it is accepted.
- `docs/billing/architecture.md` is provider-neutral, backend-authoritative, and separates authentication, billing, entitlements, usage metering, provider-cost controls, and support.
- Webhook signatures/idempotency/replay, reconciliation, payment failure, trial abuse, usage integrity, plan transitions, cancellation/refunds, deletion/retention, tax/region/sanctions/jurisdiction, merchant-of-record/direct-processor, and later app-store interactions are covered.
- No payment/provider account, live service, price, deployment, publication, or legal structure is purchased/configured/assumed.

### Frontend foundation and UX

- Shared tokens cover typography, spacing, radii, surfaces, borders, focus, semantic status colors, shadows, control size, and reduced motion in light/dark themes.
- Shared UI primitives exist for primary/secondary/tertiary/destructive/link actions, form fields, segmented controls, status/error/warning cards, progress/loading, permission requests, empty states, and accessible disclosure.
- Popup preserves 360 px width while clarifying its primary action, session view switch, comparison, page-change scan/update, optional translated-copy permission, recovery, advanced refresh, and destructive end-session hierarchy.
- Options and comparison use the same action/status/focus language without changing core translation behavior or removing recovery controls.
- Ordinary UI does not expose raw HTTP failures, private endpoints, fingerprints, or internal IDs; technical diagnostics remain bounded and disclosed on demand.

### Runtime evidence

- Managed Chromium covers no-session, translating/partial/completed, automatic incomplete-response recovery, original/translated, no-change/changed/updated, permission explanation/denial/copy-ready, comparison, provider error, restricted page, light/dark, RTL/LTR/mixed direction, 390 px, 200% zoom, reduced motion, and keyboard focus.
- Screenshots and numeric region/overflow checks reject cropped controls, overlap, horizontal overflow, dense unreadable cards, color-only status, broken BiDi order, and inconsistent action styling.
- Formal screen-reader/contrast and branded-Chrome claims remain separate unless actually performed.

### Closure

- Full old-path/reference and Markdown-link checks, Beads lint/preflight, dependency-cycle checks, secret/permission/manifest/bundle/source-map inspection, performance suite where applicable, and Git diff checks pass or exact blockers are recorded.
- Work remains only on `chore/repository-cleanup-roadmap-and-extension-ux`; focused commits are pushed and a draft pull request is opened but not merged.
- M2, desktop, mobile, Vision, meetings, and Studio implementation have not begun.

## M3 — structured translation intelligence gate

- One versioned runtime-validated provider-neutral policy defines natural defaults, precedence, preservation, context, terminology, quality, migration, and semantic fingerprinting without provider-specific models/secrets.
- One deterministic canonical compiler separates privileged instructions from untrusted page/context/glossary/brief data and selects provider output mechanisms without semantic drift.
- Requests/responses, page/section context, terminology memory, glossary scopes, review metadata, and protected values are bounded, versioned, serializable, and runtime validated.
- Valid partial records survive; unresolved-only adaptive recovery, lifecycle reconstruction, SPA rejection, cancellation, and zero-call switching/copy/comparison remain correct.
- Deterministic checks cover protected tokens, numbers, URLs/emails, identifiers/codes/formulas, glossary compliance, identical output, truncation/expansion, markup/control, and language carryover.
- Clean batches make one translation call and no review call. Suspicious or explicitly selected IDs may receive at most one review call; corrections are revalidated/rechecked and reviewer failure preserves safe work.
- Cache/recovery identity changes with relevant policy, context, glossary, prompt, and output contracts but not UI-only theme/motion settings.
- Default use needs no setup; the brief and high-value settings use accessible progressive disclosure; internal JSON/prompts remain hidden; policy/review/retranslation effects are explained.
- Static, unit/integration, managed Chromium, performance, production build, release-candidate, security, docs, dependency, bundle/manifest/source-map, secret, Git, and Beads gates pass or are explicitly unavailable. Mock/synthetic providers are sufficient; live-provider quality is optional and never inferred.
- Canonical documents, ADRs, verification report, Beads evidence, and concise project memory match implementation. Push only `003-milestone-3`, prepare a PR, do not merge, and do not begin M4.

## M2-M7 planning gates

- M2: lifecycle/restart/reload/SPA/sleep-wake resilience, large-page/mutation/memory performance, adaptive batching, provider backoff, and degraded/offline recovery have accepted specifications and evidence.
- M3: explicit bounded context/brief/glossary/feedback/routing and quality evaluation pass privacy, recipient, language, and human-review gates.
- M4: finished extension popup/side-panel/options/comparison/onboarding design system passes formal accessibility, BiDi, responsive, theme, motion, and visual acceptance.
- M5: each advanced browser capability proves browser feasibility, explicit activation, protected-field handling, retention, export, and format safety.
- M6: production authentication/accounts/teams/sync/data controls/metering/quotas/entitlements/audit/deletion/export/observability pass concurrency, revocation, abuse, privacy, and security gates.
- M7: plans/subscriptions/trials/coupons/upgrades/downgrades/cancellation/refunds/failures/portal/invoices/seats/enterprise/cost protection pass billing, reconciliation, jurisdiction, legal, security, privacy, and support acceptance.

## M8 — extension General Availability gate

M8 requires the complete gate in `ROADMAP.md`: reliable large pages and lifecycle/SPA behavior; no known critical/high security issue; least privilege; accepted privacy/accessibility/BiDi/finished UX; accounts/data controls/metering/entitlements/subscriptions/cancellation/cost protection; Chrome/Edge/Firefox acceptance and Safari decision; store/support/monitoring/incident/beta/rollback readiness.

M9/M10 implementation remains blocked until M8 is accepted.
