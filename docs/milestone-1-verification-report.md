# Milestone 1 verification report

- Date: 2026-07-18
- Branch: `milestone/01-durable-translation-sessions`
- Starting commit: `f011f6fb85c2f6e1a79541f1ee4ed4aac1c436c6`
- Scope: durable page translation sessions, zero-call views, changed-section updates, translated copies, and safe comparison foundation
- Provider path: deterministic local mock only; no live provider call
- Browser evidence: managed headless and headed Chromium; branded Chrome and formal owner acceptance remain separate

## Outcome

Showing the original page no longer ends or clears a translation session. Completed and partial translations remain page-owned and can be reapplied repeatedly without an API or provider request. New and modified eligible text can be updated independently, uncertain matches remain original, translated copy tabs reuse confident matches, and the comparison page renders a bounded plain-text snapshot. A separately confirmed End translation session action performs destructive cleanup.

Milestone 2 was not started. The branch was not merged, deployed, published, or connected to a live provider.

## Post-merge acceptance-fix addendum

- Fix branch: `fix/milestone-1-acceptance-bugs`
- Starting commit: `474f9597e2b699ca8191195e87bd7424988af196` (`origin/main` after the Milestone 1 merge)
- Beads parent: `translation-1mp.2.11`; bugs `.11.1`, `.11.2`, `.11.3`, translated-copy permission/hydration follow-up `translation-1mp.2.12`, adaptive provider recovery `translation-1mp.2.13`, and one-click permission intent `translation-1mp.2.14`
- Provider path: deterministic loopback mock only; no live provider call

Manual acceptance found three defects after merge. First, translated-copy setup deleted the only handoff during retrieval and explicitly removed the newly created user-visible tab from its broad exception path. Direct import also raced page readiness, redirects, injection, and initialization. The corrected lifecycle creates one visible blank destination, stores and binds the cloned bundle before navigation, validates the top-frame destination, leaves retrieval non-destructive, and removes central page-text data only after idempotent acknowledgment. Failure removes temporary page-text data, retains bounded metadata, leaves the requested tab open, preserves the source, and shows a privacy-safe destination status.

Second, the comparison implementation intentionally rendered one card per segment, so it could not resemble two versions of the same page. The corrected comparison captures a bounded allowlisted structural snapshot and reconstructs it twice without parsing source HTML: Original on the left and cached Translation with original fallback on the right. Desktop defaults to compact full-height 50/50 panes. Proportional linked scrolling uses `requestAnimationFrame` with a recursion guard; users can unlink/relink, drag or keyboard-adjust the divider, reset, and swap. Narrow view stacks two usable panes. Scripts, event handlers, source styles, forms, editable content, field values, frames, embeds, objects, and unsafe URLs are excluded.

Third, successful change scans updated internal progress but the popup rendered a result only when changes existed, making a valid no-change scan indistinguishable from no action. Progress now retains an explicit `no-changes`, `changes-found`, or `updated` result. The popup exposes a visible checking state, detailed counts, an up-to-date message, and a retry action for failure. Scans work in Original and Translated views and create no translation request; only Update changed sections sends confident new/modified eligible text.

A fourth acceptance defect remained in the production translated-copy path. `activeTab` authorized the user-invoked source but did not transfer to the newly created destination, while the E2E-only fixture host grant masked the missing production authority. The production manifest now declares optional HTTP/HTTPS patterns without granting them. **Open translated copy** explains the need and requests only the source origin directly from the gesture. Denial creates no tab or background handoff, leaves the source unchanged, avoids another prompt in the same view, and gives the manual duplicate-and-invoke fallback. The background rechecks the source grant before tab creation and the final destination origin before injection, covering cross-origin redirects and revocation without required `<all_urls>` access.

The same defect report exposed a deterministic destination hydration race: cached translations were initially visible and acknowledged, then page-owned delayed rendering replaced the translated nodes. Destination startup now waits for bounded initial readiness, applies confident cached matches, performs one bounded hydration reconciliation pass, and sends the final acknowledgment only after the final translated DOM is ready. Reused content makes zero provider calls.

A fifth manual-acceptance defect showed that one incomplete Gemini batch could halt a 2,500-section page with all later batches left queued. Response parsing now reconciles stable IDs independently and preserves valid siblings from partial or truncated output. The page engine retries unresolved IDs only, halves only the failing subset within split-depth/per-segment/total-attempt/duration bounds, honors cancellation and Retry-After, and continues untouched queued sections. Authentication, quota, refusal, unsupported model, and invalid configuration remain non-recursive. Initial and subsequent batch sizes account for count, characters, estimated input/output tokens, provider/language profile, segment distribution, and the current session's learned safe target. The popup displays automatic smaller-group progress and allowlisted classification/size/attempt diagnostics without page text.

A sixth defect required a second popup click after the optional-origin grant. The popup now dispatches a validated metadata-only pending intent before calling `permissions.request()` directly from the original gesture. The permission callback and exact-origin `permissions.onAdded` event both resume the same token; persisted lifecycle states plus an execution lock make the continuation idempotent and allow exactly one destination execution. The intent stores source tab/session, exact origin, navigation hash, provider/model, timestamps, and state only; the page-text handoff remains separate. Denial enters a short no-reprompt cooldown while preserving a later deliberate retry, expiry and wrong-origin events do not execute, and navigation/redirect/revocation checks fail closed.

Managed Chromium verifies the actual popup open-copy button on an already-granted E2E fixture origin, pending status during delayed hydration, final translated readiness, successful copy reuse, duplicate claim/acknowledgment, same-origin and wrong-origin redirects with the destination retained, cached-match zero-call behavior, unmatched original fallback, source/copy independence, and central handoff cleanup. Focused permission tests cover newly granted, denied, already-granted, HTTP/HTTPS, wrong-origin, and revoked states. It also verifies two structural comparison documents, no default segment cards, unsafe-node removal, no source-script execution, 50/50 layout, two-way linked scrolling, independent scrolling, deterministic relink, pointer/keyboard divider, reset, swap, partial fallback, light/dark themes, reduced motion, 200% zoom, 390 px stacking, and RTL/LTR combinations. Change tests cover explicit no-change, new, modified, removed, reordered, uncertain/duplicate, updated, partial, and both display modes with provider-request deltas.

The final refreshed 2,206-segment performance result records 82 ms first visible, 448 ms complete, 28 ms Original, 28 ms Translation, 209 ms for ten full switches, zero switch calls, and zero long tasks. Copy matched/applied 2,205 segments in 283 ms; comparison loaded in 413 ms; both made zero provider calls. Dynamic insertion completed in 790 ms. These runs are deterministic managed-browser indicators, not forced-GC leak proof.

Ignored visual evidence includes `translated-copy.png`, `translated-copy-hydrated.png`, `comparison-default-50-50.png`, `comparison-synchronized-scrolled.png`, `comparison-unlinked-scroll.png`, `comparison-adjusted-divider.png`, `comparison-swapped-sides.png`, `comparison-partial.png`, `comparison-rtl-ltr.png`, `comparison-narrow.png`, `no-page-changes.png`, `changed-sections.png`, and `changed-sections-updated.png`. The connected branded-Chrome control boundary blocks `chrome://extensions`, so this build could not be loaded unpacked there. The production permission prompt, Wikipedia, real-site redirect/canonicalization, screen-reader, 400% zoom, high-contrast, and owner acceptance remain unverified and must not be inferred from managed Chromium.

## Root cause and session design

The previous restore path combined two different intentions: it rewrote original text and also cancelled work, cleared segment maps, removed mutation/session state, and reset progress. Once that state was destroyed, showing translated text again required a new translation request.

The page shell now owns one authoritative in-memory session per top-level page. It retains exact original and translated strings, live Text-node bindings, stable source and structural fingerprints, segment status, display mode, lifecycle, change summary, and observer state. Display mode (`original`, `translated`, or mixed partial) is independent from lifecycle (`translating`, `partial`, `complete`, `stale`, `ended`, or invalidated). Runtime-validated shared contracts describe progress, change summaries, and bounded transfer bundles.

Normal session text is not duplicated into long-term storage or diagnostics. The service worker routes validated commands and retains privacy-safe progress metadata. Navigation identity, top frame, owning tab, session ID, and cancellation epochs constrain mutation.

## Implemented behavior

### Views and lifecycle

- Original and Translated rewrite only session-owned Text nodes from retained values.
- Full, partial, and cancelled sessions remain switchable when completed work exists.
- Switching does not call the backend/provider, recreate wrappers, or clear counts/failures.
- Refresh translation is an advanced confirmed action that may replace completed output; a failed whole-page refresh rolls back to the prior translation where safe.
- End translation session restores originals, cancels queued work, stops observers/timers, clears only the owning page session, and leaves global settings and other tabs intact.

### Changed sections

Matching combines normalized source fingerprint, bounded structural context, live node/parent identity, and navigation identity. Stable parent rebinding recognizes a replaced Text node as modified. Connected records whose context moves are reordered and reused. Removed mappings are discarded. Duplicate candidates without a confident identity are classified uncertain and never receive an old translation. Update changed sections transmits only confident pending/new/modified records and preserves successful unchanged output.

### Translated copy and comparison

Open translated copy requests only the current origin from the explicit gesture, then exports a versioned bundle capped at 2,500 segments and 2 MB, binds it to one destination tab before navigation, validates final-origin access plus compatible top-level navigation/content, and imports only confident matches. The destination waits for bounded readiness, reconciles one hydration pass, and acknowledges its independent cloned session only after the final translated DOM is ready and before central page-text cleanup. Denial leaves the source unchanged; post-open failure leaves the visible destination open. Matched text makes zero provider calls and ending the source does not alter the copy.

Open comparison places a single-use 128-bit token in the extension-page fragment. The corresponding validated bundle lives temporarily in `chrome.storage.session`, is bound to the owning comparison tab, and is removed after retrieval or tab cleanup. Source HTML and scripts are never loaded or interpreted. React reconstructs the same sanitized structural snapshot twice in full-height Original/Translation panes with linked or independent scrolling, adjustable/resettable split, swap, safe source/copy actions, responsive stacking, theme/reduced-motion handling, independent direction, and Unicode isolation.

## Frontend, accessibility, and BiDi

The 360 px popup now provides a semantic Original/Translated segmented control, lifecycle badge, explicit scan result/action, copy/comparison actions, and progressive advanced Refresh/End actions with confirmation. State is not communicated by color alone. Popup, Options, and comparison apply both saved and system reduced-motion preferences. Controls are labeled and keyboard operable; comparison skip links, scroll toggle, divider, reset, swap, source/copy, and close actions passed managed tests.

Managed fixtures cover English to Persian, Persian to English, Arabic with Arabic numerals, Hebrew with a URL, mixed Persian/English text, technical model identifiers, Persian digits, a list, table cells, and a button. Comparison panes independently apply source/target direction and text-unit isolation without changing host-page ancestor direction. Light RTL/LTR, dark desktop, 200% zoom, and 390 px narrow stacked layouts were inspected and remained usable.

Formal screen-reader, 400% zoom, contrast-tool/high contrast, OS-level motion, broad real-site RTL, and branded-Chrome checks remain owner/manual release evidence.

## Security and privacy review

The ordinary single-pass review covered new schemas, sender/tab/frame authorization, navigation identity, cross-tab isolation, storage lifetime, URL handling, session guessing/replay, size limits, plain-text insertion, permissions, generated manifests, bundles, source maps, ignored secrets, and cleanup. No specialized security workspace, external system, credential test, exploit, or attack simulation was used.

No confirmed critical or high-severity vulnerability was established. One plausible sender-authorization gap was found and remediated: privileged popup/comparison commands previously relied on schema validation and extension ID without an explicit extension-page URL check. The background router now requires its own extension origin for privileged UI commands; content-script messages retain top-frame tab/frame validation. A direct fake-sender router unit test remains recommended once the router has an injectable seam.

Existing page-shell eligibility gaps for inherited/variant editability, hidden ancestors, and excluded descendant context were remediated. Bundles fail closed when stale, mismatched, invalid, replayed, or oversized. Copy retrieval is acknowledgment-gated and its visible tab survives failure. Comparison schemas reject cyclic/forward parents, unsafe URL schemes, and oversized structure; active and sensitive nodes are excluded. Comparison/copy text never enters URLs, diagnostics, analytics, or long-term history. Provider keys and endpoints remain backend-only.

Required production permissions remain `activeTab`, `contextMenus`, `scripting`, and `storage`, with only `http://127.0.0.1:8787/*` as a required host. The manifest declares `http://*/*` and `https://*/*` only as optional host permissions; runtime requests are exact-origin and user-initiated. The E2E build alone adds `http://127.0.0.1:4173/*` as a required fixture host. No required `<all_urls>` permission or all-site runtime request was added. The existing defensive scan passed. Manual artifact patterns found no credential-like values. Production extension source maps are absent; the ignored Worker dry-run map embeds expected source content. `apps/api/.dev.vars` is ignored and untracked.

The 2026-07-18 production dependency audit completed and reported one high advisory in `adm-zip@0.5.18`, reached through WXT → `web-ext-run` → `firefox-profile`. The affected path is build/development tooling and does not appear in the produced Chrome extension, but the lockfile remains affected. A WXT-chain update or explicitly approved compatible override to `adm-zip >=0.6.0` requires separate dependency work and is not reported as fixed. Remaining security follow-ups are recorded in `docs/security-baseline.md` and `docs/known-limitations.md`.

## Performance evidence

Final `pnpm test:e2e:performance` results on the 2,206-segment deterministic fixture:

| Fixture        | First visible | Complete | Show original | Show translated | Ten cycles | Switch calls | Long tasks |
| -------------- | ------------: | -------: | ------------: | --------------: | ---------: | -----------: | ---------: |
| 31 eligible    |         52 ms |    59 ms |          8 ms |            8 ms |      80 ms |            0 |          0 |
| 406 eligible   |         63 ms |   187 ms |         10 ms |           11 ms |      93 ms |            0 |          0 |
| 1,006 eligible |         78 ms |   189 ms |         19 ms |           16 ms |     139 ms |            0 |          0 |
| 2,206 eligible |        106 ms |   483 ms |         40 ms |           34 ms |     254 ms |            0 |          0 |

Dynamic insertion completed in 844 ms. A same-navigation copy confidently applied 2,205 of 2,206 records in 212 ms, left one ambiguous record original, and made zero provider calls. Comparison became visible in 623 ms and made zero provider calls. Directional heap snapshots were 5.4/9.1/10.1 MB, 2.2/6.6/6.6 MB, 3.2/8.0/6.2 MB, and 3.5/8.0/7.8 MB before/after/final-original by fixture size. No forced collection was available, so these values are indicators rather than leak proof.

The final acceptance-fix performance rerun completed on 2026-07-18 against an isolated loopback API configured for the documented performance rate. Its 2,206-segment fixture reached first visible in 100 ms and completion in 469 ms; Original and Translated switches took 33 ms and 30 ms, ten cycles took 273 ms, and no switch provider call or long task occurred. Copy matching/application completed in 2,066 ms because the acceptance path includes the bounded hydration window; comparison loaded in 456 ms, and copy plus comparison made zero provider calls.

## Automated and runtime evidence

- Static/application gate: focused changed-file formatting, ESLint, strict type checks, 166 unit/regression tests, 21 explicit API integration tests, production extension build, and Worker dry-run build passed. The focused final-acceptance suite passed 111 tests, including the numbered 24 recovery and 18 permission-intent cases. Repository-wide formatting still reports the pre-existing baseline listed below.
- Managed Chromium E2E: the three current browser scenarios passed: incomplete-provider recovery in the real page engine, translated-copy hydration/reuse, and the extension shell. Earlier branch evidence also covers full and repeated switches, partial cancellation/switch/continue, exact originals, explicit scan results, changed-only requests, acknowledged/duplicate/redirected-failure copy behavior, structural comparison controls, explicit end cleanup, selected text, popup, and Options.
- Request inspection: view cycles, scans, confident copy matches, and comparison produced zero additional `/v1/translate` requests. Changed updates increased the request count only for the changed batch.
- Console inspection: the final managed run asserted no page, popup, Options, comparison, or service-worker errors. The assertion first exposed a fixture-only missing favicon 404; a data-URL fixture favicon removed it and the rerun passed.
- Interactive headed inspection: the real toolbar popup translated the managed fixture, exposed the required site-access explanation, toggled Original and Translated without another request, and one **Open translated copy** click created exactly one destination whose final heading/body were translated while protected text remained unchanged. A current screenshot was inspected directly; no tracked visual artifact was added. The production first-grant prompt remains branded-Chrome owner evidence.
- Earlier visual inspection: completed translated popup/page, retained original, reapplied translated, partial session, explicit no-change/changed/updated states, translated copy, mixed RTL/LTR page, light/dark comparison, linked/unlinked scrolling, adjusted/reset/swapped panes, and narrow comparison artifacts remain under ignored `artifacts/milestone-1-visual-baseline/`.

## Commands and notable failures

Material commands included Git preflight/branch checks; `bd prime`, `bd show`, `bd update`, and `bd remember`; focused and repository-wide Prettier checks; ESLint; direct strict TypeScript package/application checks and builds; full and focused Vitest; production/e2e WXT builds; Wrangler dry-run; full/focused/performance Playwright; the repository security scan; exact production-manifest assertions; visual artifact inspection; `pnpm verify`; release-candidate packaging; manifest/bundle/source-map searches; `git diff --check`; and final Git/PR review commands.

Observed failures were resolved or bounded:

- Sandbox child-process launches initially returned `spawn EPERM`; the same local commands passed with approved process-launch permission.
- Comparison handoff was retrieved twice under development Strict Mode; a single-request guard fixed it.
- Text-node replacement was initially classified removed/new; stable parent-element rebinding fixed the modified classification.
- The fixture server initially treated query strings as part of the file path; URL pathname parsing fixed copy/performance fixtures.
- The console gate found a fixture favicon 404; the fixture now supplies a data-URL icon.
- Two manual bundle-regex invocations initially failed because of shell quoting/leading-hyphen parsing; corrected file-only scans returned no matches.
- The production dependency audit completed and reported the high `adm-zip@0.5.18` WXT/Firefox-tooling advisory described above; no dependency change was mixed into this acceptance fix.
- `pnpm verify` and `pnpm build:release-candidate` stopped at the same pre-existing Prettier baseline in nine files unchanged by this branch. Focused formatting over every acceptance-fix file passed, as did repository lint, strict types, 166 unit tests, 21 API integration tests, production builds, the three managed E2E scenarios, the isolated performance E2E, and the repository security scan. No release-candidate artifact was created.
- The first performance invocation correctly refused to reuse an occupied port 8787. A diagnostic reuse attempt then encountered that server's normal 30-request/minute limit. The final performance run used an isolated port 8788 process with the harness's intended mock rate and passed; the normal E2E build was restored afterward.
- `bd preflight --check-only` is unsupported by the installed CLI. `bd preflight --check` assumes Go/golangci-lint/gofmt and also reports the repository's existing AGENTS/CLAUDE divergence, so it is not an applicable TypeScript gate. `bd lint` and `bd dep cycles` passed.

## Documentation and decisions

- `docs/milestone-1-specification.md` is the accepted implementation specification.
- ADR 0007 records page-owned lifecycle/display separation and BiDi boundaries.
- ADR 0009 records exact-origin optional access, final-origin checks, hydration reconciliation, acknowledgment-gated translated-copy handoff, and visible-tab retention.
- ADR 0010 records bounded sanitized structural comparison and full-page split behavior.
- Architecture, privacy, data retention, security, threat, accessibility, BiDi, testing, performance, acceptance, verification, roadmap, tasks, changelog, README, UAT, known limitations, and project memory were reconciled.
- Beads tasks `translation-1mp.2.1` through `.10` provide the specification-to-evidence graph. The cross-milestone release/owner-acceptance epic `translation-12l` remains open under the program root rather than blocking or being falsely closed as Milestone 1 implementation work.

## Git and Beads closure

- `d3ea973` — `feat: add durable translation sessions and reusable views`
- `451056e` — `test: verify durable session workflows and reuse`
- `d62da8f` — `docs: specify and verify Milestone 1`
- `ef8afc9` — `chore: record Milestone 1 closure`
- A final focused test-evidence commit expands the explicit Arabic, Hebrew, table, list, and button BiDi matrix after the closure cross-check.

The branch was pushed with upstream tracking to `origin/milestone/01-durable-translation-sessions`. Beads tasks `translation-1mp.2.1` through `.10` and epic `translation-1mp.2` are closed with evidence. No commit was pushed to main, no pull request was opened or merged, and the prepared title/description is part of the handoff for team review.

## Known limitations and owner actions

- Sessions are durable only while their page/content-script context lives. Full service-worker/browser restart, reload reconstruction, sleep/wake, and complex SPA persistence are deferred.
- Copy/comparison transfer is single-use and fail-closed; it does not become history or restart persistence.
- Broad real-site, shadow DOM, iframe, infinite-scroll storm, formal accessibility/RTL, branded Chrome, and forced-GC lifecycle profiling remain release evidence.
- No live provider, deployment, publication, purchase, account, billing, or production identity work occurred.
- The product owner should load the packaged candidate in branded Chrome, follow the Milestone 1 supplement in `docs/user-acceptance-testing.md`, record console/network/accessibility/RTL evidence, and review the prepared pull request before authorizing Milestone 2.

Milestone 2 depends on review and acceptance of this Milestone 1 branch. It remains unclaimed and unstarted.
