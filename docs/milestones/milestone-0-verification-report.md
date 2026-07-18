# Milestone 0 verification report

Date: 2026-07-18. Scope: post-MVP foundation, audit, specification, execution system, and local evidence. Milestone 1 implementation was not started.

## 1. Executive summary

The established local MVP was preserved. Milestone 0 reconciled its real architecture and contradictory historical status, created the long-term product/program source of truth, established safe specification/Beads/memory workflows, recorded ordinary defensive security and deterministic browser-performance baselines, and produced the exact proposed durable-browser Milestone 1 graph. No external system, real provider, deployment, publication, purchase, visibility change, or remote push was used.

## 2. Repository and Git state

- Requested historical baseline exists: `b929ac52484840c8c5b69f40719efb04b768f425` (`feat: add resilient partial translation recovery and diagnostics`).
- Source inspected before Milestone 0: `fdcc9aaca680691981bc5bcc0019e669b254bad1` on `main`, tracking `origin/main`.
- Remote URL is the existing GitHub repository. A URL does not independently prove server-side private visibility; no connector/network access was used. Owner confirmation remains optional unless independent evidence is required.
- The initial tracked/staged diff was empty. One pre-existing untracked 5,132-byte text file named `t Enter an email verified on your GitHub account` was preserved and excluded. A bounded pattern check found no common token/private-key/Bearer/email pattern; content ownership remains unknown.
- `apps/api/.dev.vars` is ignored and untracked. No tracked `node_modules`, `.output`, `dist`, artifacts, test results, coverage, logs, local vars, or environment secret files were found.
- The program artifact commit containing this report is `71a970c79a5247cd67a4b4a3f6708902dd791d8a`. A following local metadata commit records the Beads close event; the final handoff reports both. Neither was pushed.

## 3. Architecture and current feature findings

The existing boundaries are appropriate: extension-owned Chrome/DOM/UI/session work; pure shared contracts/core; API-owned auth/limits/routing; provider-owned credentials/payloads/parsing. The 24-stage lifecycle and state-survival matrix are in `docs/current-architecture-audit.md`.

Current automated evidence covers explicit mock page translation, exclusions, form values, progress/cancellation, exact restore, dynamic insertion, 1,000-section partial continuation, selected-text result, popup, Options, message/API/provider validation, and production builds. The mock is the current reproducible provider baseline. A dated historical Gemini claim is not treated as current live-provider evidence.

Main lifecycle gap: page originals/node records live in the page shell, while service-worker progress/controllers and API counters are transient. Popup closure should not destroy the page session, but worker/browser/backend restart and SPA-route recovery are not comprehensively verified.

## 4. Performance and reliability baseline

Managed headless Chromium with synthetic loopback fixtures and a 1 ms deterministic mock delay produced:

| Added / eligible nodes | Requests | First visible | Completion | Restore | Long tasks |
| ---------------------- | -------- | ------------- | ---------- | ------- | ---------- |
| 25 / 31                | 1        | 73 ms         | 79 ms      | 7 ms    | 0          |
| 400 / 406              | 9        | 60 ms         | 190 ms     | 11 ms   | 0          |
| 1,000 / 1,006          | 21       | 64 ms         | 184 ms     | 19 ms   | 0          |
| 2,200 / 2,206          | 45       | 72 ms         | 445 ms     | 31 ms   | 0          |

Dynamic insertion translated in 834 ms; mixed Persian/English RTL text translated; form value was unchanged. Heap snapshots are directional, not leak proof. Real-provider latency, discovery/write separation, p50/p95 repetitions, cache ratios, mutation storms, GC-aware cleanup, lifecycle failures, and branded Chrome remain M1 gates. Full raw context is in `docs/archive/v2-performance-baseline.md`.

## 5. Frontend, accessibility, and BiDi audit

The functional base is coherent: compact 360 px popup, responsive Options, shared tokens, semantic controls, focus styles, theme support, progress/recovery copy, plain-text result card, `dir="auto"`, and OS reduced-motion CSS. The saved reduced-motion setting is a confirmed implementation gap: storage/UI exists but runtime application has no evidence.

Managed synthetic screenshots were captured locally (ignored) for popup partial/recovery, full Options, and selected-text result. Visual inspection found readable hierarchy, visible actions, consistent light-theme tokens, and an isolated result card. The popup screenshot used direct test control messages, so its stale partial projection after background continuation is harness-induced evidence of the projection model, not a confirmed normal-user defect. Dark mode, narrow variants beyond 360 px, long localized labels, high zoom, saved motion, screen reader, formal contrast, and visual RTL/mixed layout were not inspected.

The BiDi plan treats direction as correctness/safety. Current coarse `dir="auto"` and inherited host direction are insufficient evidence for mixed identifiers, clipboard behavior, tables/forms, or browser differences. The release-blocking fixture/clipboard/accessibility contract is in `docs/bidi-safety.md`.

## 6. Ordinary defensive security and privacy baseline

The existing repository security scan passed, including two extension roots and one configured secret-value comparison without display. Production manifest permissions are `activeTab`, `contextMenus`, `scripting`, and `storage`; host permission is only `http://127.0.0.1:8787/*`. The E2E-only fixture origin is absent from production. Production extension output contains no source maps and none of eight checked provider-origin/key-name patterns. The API dry-run has one source map; provider origins/config names there are backend design, while actual configured values were covered by the non-displaying scan.

No confirmed critical/high vulnerability was established. One confirmed code path and plausible hardening issues were documented without exploitation: excluded descendant text can enter `surroundingText`; editable/hidden-ancestor eligibility; body buffering before application byte rejection; provider body timeout/size; custom endpoint IPv6/DNS/redirect policy; process-local quotas; 32-bit cache collision verification; release manifest/provenance; and local PID ownership. Exact paths, confidence, remediation, and tests are in `docs/security-baseline.md`.

Existing privacy protections include explicit activation, backend-only recipients/keys, validated messages/requests/responses, plain-text DOM writes, navigation/session checks, opt-in bounded cache, privacy-mode cache disable, sensitive-page policy, and metadata-only diagnostics/logging. Future persistence/analytics/TM/feedback gates are in `docs/data-retention.md`.

The production dependency audit was attempted offline but still required registry access and failed with `ECONNREFUSED`. It was not retried or bypassed; prior clean audits are dated historical evidence.

## 7. Specification, Beads, and project memory

Python 3.12.13 is available; `uv` and Specify CLI are absent. The exact official-only, pinned, isolated-worktree/diff-reviewed installation and initialization plan is documented in `docs/tooling-and-workflow.md`. CLI absence did not block the repository’s constitution/specification/ADR/task/verification process.

Beads 1.1.0 embedded mode was audited. `bd doctor` is unsupported in that mode; `bd lint` and dependency-cycle checks pass. Created/synchronized:

- Program epic `translation-1mp` and M0 epic `translation-1mp.1`.
- M1 epic `translation-1mp.2`, ten detailed children `translation-1mp.2.1` through `.10`, and the existing local-release evidence epic reparented as a prerequisite workstream.
- Future M2-M6 and M9-M12 epics under the program; existing M7 `translation-we8` and M8 `translation-akt` reparented; dependencies match `ROADMAP.md`.
- Existing narrow local-release tasks were retained and wired as prerequisites instead of duplicated.
- Three durable memories: program authority, provider safety, and memory safety.

The optional Obsidian workflow is link/status/archive-based and non-authoritative. No vault was created or tracked; secrets/private content are prohibited.

## 8. Research, competition, and positioning

The offline competitive baseline covers browser/page/selection/bilingual/subtitle/document/terminology/OCR/speech/provider/professional/game categories and explicitly requires an official-source refresh before product or marketing use. External research was prohibited, so no claim of current competitor parity is made.

The research registry seeds COMET, BLEURT, MQM, xCOMET, document context, terminology, TM, speech, OCR, WMT, and Unicode BiDi inputs with license/privacy/compute and proposed-experiment fields. Metadata must be verified from primary sources before experimentation.

Positioning centers on controlled multilingual understanding/communication/localization rather than “many models.” Launch claims require dated evidence; fake testimonials, invented accuracy, misleading privacy/compliance/unlimited claims, hidden sponsorship, and dark patterns are prohibited.

## 9. Final milestone sequence and exact M1 scope

Program sequence: M0 foundation; M1 durable browser foundation; M2 reading workspace; M3 language intelligence; M4 personal continuity; M5 Compose; M6 vision/media; M7 identity/usage; M8 release readiness; M9 cross-browser; M10 Meet; M11 Studio; M12 Platform/enterprise.

M1 only: approved text-minimizing session design; lifecycle recovery; no-call original/translation toggles; changed-section-only updates; viewport/adaptive scheduling and profiling; DOM context/privacy hardening; saved motion/accessibility; BiDi engine; bounded request/provider/release hardening; convergence/browser/owner gate. It excludes accounts, billing, deployment, publication, automatic routing, new platforms, and live provider calls.

## 10. Files created and changed

Created: constitution/vision/roadmap/contributing/security/privacy entry points; current/platform architecture; design system/verification/accessibility/BiDi; data retention/risk; security/performance baselines; workflow/memory; competitive/research/experiment; marketing/positioning/user actions; four ADRs; performance Playwright config/test; this report.

Changed: `.prettierignore`, `README.md`, `TASKS.md`, `CHANGELOG.md`, `package.json`, existing E2E screenshot option, and living acceptance/current-state/limitations/milestones/performance/testing/spec-workflow/verification reports. Application production behavior was not changed.

ADRs created: 0005 specification/Beads/memory authority; 0006 boundary preservation/platform candidates; 0007 proposed durable session/BiDi direction; 0008 deferred design/analytics/routing/research infrastructure.

## 11. Commands and results

Material inspections: `git status --short`, `git diff`, `git log`, `git show`, `git remote -v`, `git ls-files`, `git check-ignore`, `rg --files`, targeted `rg -n`, `Get-Content`, manifest JSON parsing, generated-file/source-map counts, and boolean bundle-pattern checks.

Tool/workflow: `bd prime`, `bd show/list/ready/lint/dep cycles/remember/recall`, Beads create/update/dependency commands, `git --version`, `bd version`, bundled Node/pnpm/Python version checks, browser executable/version checks, and missing `uv`/`specify` checks. `bd doctor` was attempted and reported unsupported embedded mode.

Verification:

- `pnpm security:scan` — pass (initial and final/release run).
- `pnpm audit --prod --offline` — failed: registry connection still required and external access was unavailable; not retried.
- `pnpm format:check` — initially failed because generated/hand-managed Beads/tool instruction files were included; `.prettierignore` was safely scoped, `pnpm format` ran, final check passed.
- `pnpm verify` — first sandboxed run reached tests then failed `spawn EPERM`; approved local subprocess run passed: format, lint, strict types, 95 unit tests, 21 API integration tests, production extension build, Worker dry-run.
- `pnpm test:e2e:performance` — initial sandbox `spawn EPERM`; two harness assertion iterations failed (progress polling, then observer readiness); corrected cache-isolated run passed and emitted the recorded metrics; final rerun is part of closure verification.
- `pnpm test:e2e` — pass; screenshot-enabled rerun also pass.
- `pnpm build:release-candidate` — pass; reran verification/security scan, rebuilt ignored extension/backend artifact, metadata, and checksums.
- Manifest/bundle inspection — pass after correcting two local PowerShell inspection-expression errors; permissions/source-map/generated tracking and eight extension forbidden patterns recorded above.

## 12. Browser, console, and network evidence

Managed Playwright Chromium only: page translation, exact exclusions/form safety, dynamic content, cancellation/partial progress, pending-only continuation, restore, selected result, popup, Options, 25-2,200-node performance, RTL/mixed text DOM assertion, and screenshots. Branded Chrome, interactive inspection, responsive/dark/RTL visual matrix, and accessibility tooling were unavailable/not run.

No explicit page/popup/service-worker console capture was performed, so no “console clean” claim is made. Network request capture in the performance test counted synthetic `/v1/translate` requests and input sizes; no full network trace was inspected. The manifest/bundle boundary shows no provider host access in the extension; the backend mock loopback was the only intended runtime recipient.

## 13. Problems discovered, fixed, and remaining

Fixed in Milestone 0 tooling/evidence: source-of-truth contradiction labeling; unsafe formatter coverage of generated/hand-managed instruction files; missing reproducible performance harness; missing program/Beads/memory/research/design/security documents; progress-poll and observer-readiness defects in the new harness; cache isolation between performance sizes.

Not fixed automatically: every application/security/lifecycle/accessibility/BiDi finding in the baselines, because M0 does not implement M1 and findings require validation. Also open: exact pnpm 11.7 runtime restoration (checks used compatible 11.9), production dependency audit, official Spec Kit tools, private remote confirmation, live-provider qualification, branded Chrome, formal accessibility/RTL, lifecycle durability, production identity/quotas, owner acceptance, deployment/publication.

## 14. Product-owner actions and closure

Required before M1: review this report, `ROADMAP.md`, and Beads M1 scope; explicitly approve or revise M1. Optional now: authorize official Spec Kit/uv download and confirm remote private visibility. Later owner gates are in `docs/user-action-checklist.md`.

The local Milestone 0 commit was authorized by the task and no push followed. M0 Beads closure was recorded only after the program commit succeeded; M1 remains unclaimed and unstarted pending explicit approval.
