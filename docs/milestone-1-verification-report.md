# Milestone 1 verification report

- Date: 2026-07-18
- Branch: `milestone/01-durable-translation-sessions`
- Starting commit: `f011f6fb85c2f6e1a79541f1ee4ed4aac1c436c6`
- Scope: durable page translation sessions, zero-call views, changed-section updates, translated copies, and safe comparison foundation
- Provider path: deterministic local mock only; no live provider call
- Browser evidence: managed headless Chromium; branded Chrome and formal owner acceptance remain separate

## Outcome

Showing the original page no longer ends or clears a translation session. Completed and partial translations remain page-owned and can be reapplied repeatedly without an API or provider request. New and modified eligible text can be updated independently, uncertain matches remain original, translated copy tabs reuse confident matches, and the comparison page renders a bounded plain-text snapshot. A separately confirmed End translation session action performs destructive cleanup.

Milestone 2 was not started. The branch was not merged, deployed, published, or connected to a live provider.

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

Open translated copy exports a versioned bundle capped at 2,500 segments and 2 MB, opens the exact HTTP(S) source URL, waits for the new top-level page, validates navigation/content, and imports only confident matches. The copy owns an independent cloned session; matched text makes zero provider calls and ending the source does not alter the copy.

Open comparison places a single-use 128-bit token in the extension-page fragment. The corresponding validated bundle lives temporarily in `chrome.storage.session`, is bound to the owning comparison tab, and is removed after retrieval or tab cleanup. Source HTML and scripts are never loaded or interpreted. React text nodes render aligned original/translation pairs with status, copy controls, Previous/Next navigation, safe source navigation, responsive columns, theme/reduced-motion handling, `dir="auto"`, and Unicode isolation.

## Frontend, accessibility, and BiDi

The 360 px popup now provides a semantic Original/Translated segmented control, lifecycle badge, changed-content summary/action, copy/comparison actions, and progressive advanced Refresh/End actions with confirmation. State is not communicated by color alone. Popup, Options, and comparison apply both saved and system reduced-motion preferences. Controls are labeled and keyboard operable; comparison Previous/Next and copy actions passed managed tests.

Managed fixtures cover English to Persian, Persian to English, Arabic with Arabic numerals, Hebrew with a URL, mixed Persian/English text, technical model identifiers, Persian digits, a list, table cells, and a button. Comparison content uses paragraph-level automatic direction and inline isolation without changing host-page ancestor direction. Dark desktop and 390 px narrow comparison layouts were visually inspected and remained readable.

Formal screen-reader, 200% zoom, contrast-tool, OS-level motion, broad real-site RTL, and branded-Chrome checks remain owner/manual release evidence.

## Security and privacy review

The ordinary single-pass review covered new schemas, sender/tab/frame authorization, navigation identity, cross-tab isolation, storage lifetime, URL handling, session guessing/replay, size limits, plain-text insertion, permissions, generated manifests, bundles, source maps, ignored secrets, and cleanup. No specialized security workspace, external system, credential test, exploit, or attack simulation was used.

No confirmed critical or high-severity vulnerability was established. One plausible sender-authorization gap was found and remediated: privileged popup/comparison commands previously relied on schema validation and extension ID without an explicit extension-page URL check. The background router now requires its own extension origin for privileged UI commands; content-script messages retain top-frame tab/frame validation. A direct fake-sender router unit test remains recommended once the router has an injectable seam.

Existing page-shell eligibility gaps for inherited/variant editability, hidden ancestors, and excluded descendant context were remediated. Bundles fail closed when stale, mismatched, invalid, replayed, or oversized. Comparison/copy text never enters URLs, diagnostics, analytics, or long-term history. Provider keys and endpoints remain backend-only.

Production permissions remain `activeTab`, `contextMenus`, `scripting`, and `storage`, with only `http://127.0.0.1:8787/*`. The E2E build alone adds `http://127.0.0.1:4173/*`. No `<all_urls>` permission was added. The existing defensive scan passed. Manual artifact patterns found no credential-like values. Production extension source maps are absent; the ignored Worker dry-run map embeds expected source content. `apps/api/.dev.vars` is ignored and untracked.

The production advisory refresh could not be completed without prohibited registry access. An offline audit attempt did not complete and was terminated; it is not reported as passing. Remaining security follow-ups are recorded in `docs/security-baseline.md`.

## Performance evidence

Final `pnpm test:e2e:performance` results on the 2,206-segment deterministic fixture:

| Fixture        | First visible | Complete | Show original | Show translated | Ten cycles | Switch calls | Long tasks |
| -------------- | ------------: | -------: | ------------: | --------------: | ---------: | -----------: | ---------: |
| 31 eligible    |         52 ms |    59 ms |          8 ms |            8 ms |      80 ms |            0 |          0 |
| 406 eligible   |         63 ms |   187 ms |         10 ms |           11 ms |      93 ms |            0 |          0 |
| 1,006 eligible |         78 ms |   189 ms |         19 ms |           16 ms |     139 ms |            0 |          0 |
| 2,206 eligible |        106 ms |   483 ms |         40 ms |           34 ms |     254 ms |            0 |          0 |

Dynamic insertion completed in 844 ms. A same-navigation copy confidently applied 2,205 of 2,206 records in 212 ms, left one ambiguous record original, and made zero provider calls. Comparison became visible in 623 ms and made zero provider calls. Directional heap snapshots were 5.4/9.1/10.1 MB, 2.2/6.6/6.6 MB, 3.2/8.0/6.2 MB, and 3.5/8.0/7.8 MB before/after/final-original by fixture size. No forced collection was available, so these values are indicators rather than leak proof.

## Automated and runtime evidence

- Static/full gate: formatting, ESLint, strict type checks, 98 unit tests, 21 API integration tests, production extension build, and Worker dry-run build passed.
- Managed Chromium E2E: full and five repeated switches, partial cancellation/switch/continue, exact originals, new/modified/removed/reordered/uncertain detection, changed-only requests, copy reuse/isolation, comparison keyboard/theme/narrow/motion, explicit end cleanup, selected text, popup, and Options passed.
- Request inspection: view cycles, copy matched content, and comparison produced zero additional `/v1/translate` requests. Changed updates increased the request count only for the changed batch.
- Console inspection: the final managed run asserted no page, popup, Options, comparison, or service-worker errors. The assertion first exposed a fixture-only missing favicon 404; a data-URL fixture favicon removed it and the rerun passed.
- Visual inspection: completed translated popup/page, retained original, reapplied translated, partial session, changed sections, translated copy, mixed RTL/LTR page, dark comparison, and narrow comparison artifacts were refreshed under ignored `artifacts/milestone-1-visual-baseline/`.

## Commands and notable failures

Material commands included Git preflight/fetch/fast-forward/branch checks; `bd prime`, `bd show`, `bd list`, `bd lint`, `bd dep cycles`, and `bd preflight`; `pnpm format`, `pnpm lint`, `pnpm typecheck`, `pnpm test:unit`, `pnpm verify`, `pnpm test:e2e`, `pnpm test:e2e:performance`, `pnpm security:scan`, production builds, release-candidate packaging, manifest/bundle/source-map searches, `git check-ignore`, `git ls-files`, `git diff --check`, and final Git review/status commands.

Observed failures were resolved or bounded:

- Sandbox child-process launches initially returned `spawn EPERM`; the same local commands passed with approved process-launch permission.
- Comparison handoff was retrieved twice under development Strict Mode; a single-request guard fixed it.
- Text-node replacement was initially classified removed/new; stable parent-element rebinding fixed the modified classification.
- The fixture server initially treated query strings as part of the file path; URL pathname parsing fixed copy/performance fixtures.
- The console gate found a fixture favicon 404; the fixture now supplies a data-URL icon.
- Two manual bundle-regex invocations initially failed because of shell quoting/leading-hyphen parsing; corrected file-only scans returned no matches.
- The offline production dependency audit remained incomplete without registry access and was terminated rather than allowed external access.

## Documentation and decisions

- `docs/milestone-1-specification.md` is the accepted implementation specification.
- ADR 0007 records page-owned lifecycle/display separation and BiDi boundaries.
- ADR 0009 records bounded copy/comparison handoff.
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
