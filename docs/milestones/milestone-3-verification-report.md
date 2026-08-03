# Milestone 3 verification report

- Date: 2026-08-03
- Branch: `003-milestone-3`
- Starting commit: `235b86c306255aba33ff1cc5f3988c8e7d7cc748`
- Ending commit: recorded in the final Git/PR handoff after focused closure commits
- Beads epic: `Lingo-Page-68x`
- Status: implementation and managed-browser evidence complete; final repository rerun, release packaging, commits, push, and PR creation are recorded below when finished

## Executive result

Milestone 3 implements one provider-neutral, versioned translation-intelligence path:

`settings/defaults -> validated TranslationPolicy -> bounded context and terminology -> versioned TranslationRequest -> canonical compiler/provider capability -> validated TranslationResponse -> deterministic checks -> at most one selective review -> plain-text DOM application`

Natural, meaning-preserving translation is the default. Security/output invariants remain privileged; page text, context, glossary values, terminology, and the compact user brief remain bounded untrusted data. Clean real-provider fixture batches use exactly one translation request and zero review requests. Suspicious or explicitly selected records can use one review request for at most 50 IDs; unrelated completed records are not resent, corrections are schema-validated/rechecked, and review failure preserves the original safe candidate.

No Milestone 4 redesign, accounts, cloud synchronization, billing, deployment, publication, desktop/mobile, OCR, audio, Vision, meetings, Studio, paid provider call, or live-provider claim was added.

## Architecture delivered

### Policy, defaults, and precedence

- `TranslationPolicy` v1 is typed in shared types and runtime-validated with strict Zod schemas.
- The default is natural/balanced, meaning-preserving, no added explanation or omissions, automatic tone/formality/content/audience, protected names/numbers/URLs/emails/code/identifiers/codes/models/formulas/units, bounded context/memory, deterministic checks, and automatic selective review.
- Language tags normalize; unknown versions/keys, oversized briefs, invalid site scopes, conflicting entries, and corrupt structures reject. Missing stored policy migrates to the safe default.
- Precedence is security/output invariants, product invariants, session brief/preferences, explicit glossary, site preferences, automatic classification, then defaults. Glossary and protected-token requirements cannot be disabled by page content.
- Stable serialization and semantic fingerprints cover policy identity without including unrelated UI state.

### Compiler and provider capability

- One prompt compiler emits stable role/task, language, behavior, style, preservation, terminology, context, untrusted-content, output, and error sections.
- Privileged instructions are capped at 16,000 characters; serialized untrusted input is capped at 192,000 characters. Page/context/glossary/brief values never enter the privileged section.
- Capabilities select native schema, JSON mode, or strict prompt-only JSON without changing policy meaning or weakening validation.
- Provider IDs, model choice, endpoints, credentials, retry policy, and recipient selection remain backend-owned.

### Structured request and response

- Request v1 retains M2 request/session/operation/batch/attempt/navigation identities and adds policy/fingerprint, page/section context, terminology memory, compiler/output versions, and bounded review candidates.
- Context-only data is structurally separate from requested segments and never applied to the DOM.
- Response v1 requires matching request/session identities and opaque IDs. Unknown, duplicate, empty, oversized, unexpected-markup, malformed, truncated, and missing records are classified; valid partial records survive and adaptive recovery retries unresolved IDs only.
- Raw provider output never reaches the DOM. Extension/API schemas and core response validation run before text-node mutation.

### Context, terminology, glossary, and protection

- The page shell derives bounded title, origin/site, direction, semantic role, heading path, and adjacent eligible source context locally; there is no default profiling model call.
- Heading/nearby enrichment is one document-order pass. Context switches are honored independently and accompany adaptive sub-batch retries.
- Terminology memory is page-session-only, normalized, latest-wins, and capped at 200 entries. It is seeded by explicit glossary decisions; autonomous learning is not implemented.
- Glossary entries are capped at 500, filtered to relevant text/language/origin, then capped at 200 per compiled request. Global, exact-site, and session scopes remain local; no account/team/cloud sync exists.
- URLs, emails, placeholders, formulas, product/model codes, identifiers, numbers, and explicit protected values are substituted with reserved text tokens. Missing, duplicate, or foreign tokens fail validation; restoration is plain text.

### Quality and review

- Deterministic findings cover protected/integrity mismatch, number/URL/email/code/formula/identifier/glossary mismatch, identical output, truncation/expansion, unexpected markup/control characters, and heuristic source-language carryover.
- Automatic mode nominates only suspicious IDs, capped at 50, for one review pass. Review-off makes no review call. On-demand sends only selected IDs/candidates.
- Provider-call counts are reported separately. Review cannot recurse; cancellation aborts pending transport; review failure returns unresolved decisions and preserves the original translation.
- The popup exposes policy summary, finding count, translation/review calls, warning, reviewing, reviewed, and non-destructive failure states.

### Cache, recovery, and persistence

- Cache identity includes source/target, provider/model, text, relevant policy fingerprint, bounded context fingerprint, glossary version, prompt version, and output-contract version. Review bypasses the cache.
- Recovery/session bundles carry policy and fingerprint. The restored-tab identity comparison includes the same fingerprint; the managed regression found and fixed one omitted background comparison.
- Policy/glossary settings remain in `appSettings`. Terminology and authoritative active-page state remain memory-only. Existing optional translated-text cache bounds/privacy-mode deletion remain unchanged.
- Options warns that existing translations retain their original policy and must be translated again after a semantic preference change.

## User experience and accessibility evidence

- Options adds a 2,000-character translation brief, naturalness and quality choices, progressive-disclosure tone/formality/content/audience/review controls, and scoped glossary editor.
- Internal JSON, prompt text, provider credentials, and model routing are not exposed.
- Managed Chromium verifies keyboard focus, saved-state reload, 390 px layout, a halved-CSS-viewport 200% zoom equivalent without content clipping (the headless browser reports a 9 px scrollbar gutter), forced RTL, mixed-direction inputs, dark mode, saved reduced motion, accessible labels/status text, and the review call disclosure.
- Visual inspection found and fixed an Options-specific 360 px body minimum that clipped narrow 200% zoom/RTL content.
- This is not formal screen-reader, contrast, high-contrast, or branded-browser certification.

## Automated evidence

### Focused intelligence baselines

| Evidence                                                                   | Result                                                 |
| -------------------------------------------------------------------------- | ------------------------------------------------------ |
| Policy validation/migration/normalization/bounds/conflicts                 | PASS                                                   |
| Stable precedence/fingerprint/cache identity                               | PASS                                                   |
| Relevant site glossary and cross-site isolation                            | PASS                                                   |
| Protected token preservation/missing/duplicate/foreign rejection           | PASS                                                   |
| Deterministic findings and bounded terminology memory                      | PASS                                                   |
| Deterministic compiler, prompt separation, capability selection, size caps | PASS                                                   |
| Clean provider fixture                                                     | 1 translation call, 0 review calls                     |
| Suspicious provider fixture                                                | 1 translation call, 1 review call for the flagged ID   |
| Reviewer failure                                                           | Original safe candidate preserved                      |
| Explicit on-demand fixture                                                 | 0 translation calls, 1 review call for the selected ID |

Existing provider/recovery tests retain malformed/truncated JSON, partial, unknown, duplicate, missing, empty, stubborn-record isolation, cancellation, rate/timeout/auth/quota, and unresolved-only retry coverage.

### Managed Chromium

The final suite contains the seven M1/M2 shell, lifecycle, restored-tab, adaptive-recovery, outage, translated-copy, and permission scenarios plus one M3 preferences/review scenario. The M3 scenario:

1. loaded default preferences;
2. configured a formal technical expert brief, enhanced mode, exact-site glossary, dark mode, and reduced motion;
3. saved/reloaded validated settings and observed the retranslation notice;
4. exercised 390 px, keyboard focus, forced RTL, mixed direction, and a 200% zoom-equivalent layout without content clipping;
5. translated five fixture segments with one synthetic structured request;
6. displayed the non-default policy and deterministic warning;
7. sent exactly one flagged ID through one delayed review request, captured the in-progress state, applied a validated correction, and displayed completion;
8. observed no page, Options, popup, or worker console errors and no raw fixture text in extension storage.

Screenshots are ignored local evidence in `artifacts/milestone-3-ui/`:

- `01-default-preferences.png`
- `02-expanded-preferences.png`
- `03-translation-brief.png`
- `04-glossary-editor.png`
- `05-dark-reduced-motion.png`
- `06-rtl-preferences.png`
- `07-active-policy-quality-warning.png`
- `08-review-in-progress.png`
- `09-review-completed.png`
- `10-policy-change-retranslation-notice.png`
- `11-zoom-preferences.png`

The requested in-app browser surface was attempted after its mandatory setup was read, but its local runtime failed with `EPERM` while traversing the Windows `AppData` path. Managed Playwright with the loaded test extension supplied reproducible browser evidence instead; the in-app surface is not claimed as passed.

## Performance result

| Eligible segments | Completion | Translation calls | Review calls | Longest task |
| ----------------: | ---------: | ----------------: | -----------: | -----------: |
|                31 |     255 ms |                 1 |            0 |        80 ms |
|               406 |     316 ms |                 9 |            0 |        76 ms |
|             1,006 |     629 ms |                21 |            0 |        73 ms |
|             2,206 |   1,249 ms |                45 |            0 |        82 ms |
|             2,500 |   1,350 ms |                50 |            0 |       108 ms |

The 2,500 case translated exactly the safety ceiling and left later eligible nodes original. Dynamic translation was 128 ms. A 2,205-segment translated copy applied in 3,219 ms and comparison loaded in 1,485 ms, with zero provider calls for both reuse paths.

The 2,206 result regresses from the final M2 492 ms to 1,249 ms and exceeds the aspirational 50 ms long-task budget. An initial per-segment heading implementation measured 2,475 ms/1,343 ms and was replaced by one document-order pass; the remaining structured-validation/context/quality cost is retained as an explicit known limitation. There is no clean-page double pass: review count remained zero at every size.

Focused measurements: 1,000 policy validations 30.07 ms; 1,000 fingerprints 35.95 ms; 500-entry glossary/50 segments 1.50 ms; 50 quality checks 4.27 ms; 50-segment/200-term compiler 3.32 ms. Prompt system/untrusted bytes were 1,476/24,317; representative request/response 26,464/4,134 bytes; policy 818 bytes; 200-term memory 17,801 bytes.

## Security and privacy result

- Required permissions remain `activeTab`, `alarms`, `contextMenus`, `scripting`, `sessions`, and `storage`; required host access remains the configured local API. Optional HTTP/HTTPS access remains explicit-current-origin behavior. There is no `<all_urls>` requirement.
- The compiler marks page/context/glossary/brief data as untrusted and keeps it out of privileged instructions. Prompt-injection fixtures cannot change schema, IDs, recipient, target, or security rules.
- Provider output remains plain text; HTML/script is rejected or flagged and never executed.
- Raw page text, full URLs/query strings, form values, credentials, raw provider bodies, and unbounded errors are not logged. The security script scans source, release artifacts, maps where present, configured secret values without printing them, and Git history.
- No live recipients were contacted. All automated translation/review evidence used deterministic mock or intercepted synthetic structured responses.

## Verification command record

Material commands include:

- Git preflight: `git status`, branch/remote/revision/log checks, `git fetch origin`, ignore checks.
- Beads: `bd prime`, create/claim/dependency/show/list/close operations, `bd lint`.
- Installation: `pnpm install --offline` (failed: missing cached Cloudflare metadata), then authorized pinned `pnpm install` (passed).
- Focused checks: Vitest policy/core/provider files; extension and repository typechecks; focused restored-tab, copy, and M3 UI Playwright tests.
- Repository gates: `pnpm verify`, `pnpm test:e2e`, `pnpm test:e2e:performance`, `pnpm security:scan`, `pnpm build:release-candidate`.
- Audit/inspection: production/development dependency audits where available, manifest/bundle/map inspection, `.dev.vars` ignore/untracked check, `git diff --check`, staged-content/secret review.

Notable retries/failures retained as evidence:

- Sandbox `EPERM` blocked initial pnpm executable access; authorized repository commands passed.
- Playwright Chromium was initially absent; the pinned browser was installed, after which managed tests ran.
- The first post-M3 E2E build rejected legacy direct start messages; optional migration fields plus derived defaults fixed it.
- A restored-tab test failed because the background recomputed translation identity without the new policy fingerprint; focused and full regressions pass after the fix.
- One translated-copy run failed once and passed in isolation plus the full rebuilt suite; no persistent defect reproduced.
- Performance was twice blocked by a stale repository-owned `workerd` listener; the exact process was identified/stopped and the unchanged suite ran.
- The first performance implementation exposed an O(segments x headings) context pass; it was replaced and remeasured.
- The expanded 2,500 fixture initially expected a post-ceiling RTL node to translate; the test now verifies correct deferral.
- The first release-candidate attempt stopped before artifact creation because Prettier flagged shared validation; the file was formatted before the final rerun.
- In-app browser setup failed as described above; it is not counted as browser evidence.

## Final gate table

| Gate                                                   | Result               | Evidence                                                            |
| ------------------------------------------------------ | -------------------- | ------------------------------------------------------------------- |
| Formatting, ESLint, strict TypeScript                  | PASS                 | `pnpm verify`                                                       |
| Markdown links / dependency cycles                     | PASS                 | 92 Markdown files; no cycles across 9 workspaces                    |
| Unit / API integration                                 | PASS                 | 16 files / 271 unit tests; 21 API tests                             |
| Production extension / Worker dry run                  | PASS                 | 706.76 kB extension; 772.04 KiB upload / 126.36 KiB gzip            |
| Managed Chromium E2E                                   | PASS                 | 8 serialized scenarios including M3 UI/review                       |
| Performance E2E                                        | PASS with regression | 25/400/1,000/2,200/2,500 added-node fixtures; exact results above   |
| Security/secret scan                                   | PASS                 | Two extension roots; one configured value checked without display   |
| Release candidate                                      | PASS                 | Extension/backend metadata and SHA-256 checksum artifact created    |
| Dependency audit                                       | FAIL (pre-existing)  | Both scopes report six high WXT/web-ext/ESLint toolchain advisories |
| Manifest/bundle/source maps                            | PASS                 | MV3; 15 files / 706,756 bytes; no extension maps; one scanned Worker map |
| Beads lint                                             | PASS                 | No template warnings; optional local role remains unset             |
| In-app browser                                         | BLOCKED              | Windows profile-path `EPERM`; managed Playwright used               |
| Branded Chrome / formal accessibility / live providers | NOT RUN              | Owner/manual evidence; no claim made                                |

## ADRs

- 0017: versioned structured translation policy
- 0018: canonical prompt compiler
- 0019: provider-neutral structured output
- 0020: bounded document terminology memory
- 0021: selective quality review
- 0022: policy-aware cache identity

## Known limitations and owner actions

1. Review the 2,206-segment regression and 82 ms observed task before acceptance; optimize in a dedicated approved task if the M2 latency is a hard merge gate.
2. Run optional live-provider smoke tests only with explicit approval, backend-only credentials, synthetic non-sensitive text, and recorded cost/recipient/model/call counts. None were run here.
3. Perform branded Chrome, formal screen-reader/contrast/high-contrast, OS zoom/motion, and physical lifecycle checks. Managed Chromium does not certify them.
4. Automatic source carryover, truncation, glossary compliance, and classification are heuristics. Review remains one-pass/non-authoritative; terminology memory is explicit-glossary seeded rather than autonomous learning.
5. Site scope is exact-origin local storage. There is no account, cloud/team glossary, cross-device memory, or remote learning.
6. Inspect the PR diff, screenshots, performance tradeoff, and release candidate; do not merge automatically.

## Rollback

Revert the focused M3 commits together to return to the M2 request/settings/cache identities. Do not partially retain M3 cache/recovery fingerprints without their policy/schema/compiler contracts. Clearing local extension data removes migrated settings/cache if an owner chooses rollback during manual testing.

## Closure state

The Beads epic stays open until the final repository/packaging rerun, focused commits, branch push, and PR creation succeed. M4 remains blocked on owner review and acceptance of this report and the M3 PR. The branch must not be merged or deleted automatically.
