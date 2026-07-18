# Threat model

## Assets

- Provider API keys and backend credentials.
- User session tokens and account identity.
- Sensitive webpage text.
- Original page DOM content and page behavior.
- Translation quotas and provider spend.
- Extension integrity and update channel.
- Operational logs and diagnostic exports.

## Adversaries

- Malicious webpage author or injected third-party script.
- Malicious/compromised provider response.
- Attacker forging extension messages.
- Attacker replaying or flooding API requests.
- Curious operator or log consumer.
- Compromised dependency or build pipeline.
- User accidentally translating a sensitive page.

## Threats and mitigations

| Threat                               | Impact                                                         | Mitigation                                                                                                                                                  | Verification                                                                                |
| ------------------------------------ | -------------------------------------------------------------- | ----------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------- |
| Prompt-injection text in page        | Changes provider behavior                                      | Provider adapter isolates page text as data; fixed system/config; no provider controls from page                                                            | Fixture with adversarial instructions; provider request snapshot.                           |
| Invented provider/model or fallback  | Sends text to an unintended recipient                          | Backend registry and model allowlist; selected-provider failure is terminal; no cross-provider fallback                                                     | API rejection tests and registry-state tests.                                               |
| Custom-provider SSRF/proxy abuse     | Reaches arbitrary/private services                             | Backend-only URL; HTTPS public or loopback policy; no client URL/headers; fixed translation route and limits                                                | URL-policy and controlled-test-route tests.                                                 |
| Malformed/refused LLM output         | Corrupts DOM or hides partial work                             | Per-record JSON/ID/token/plain-text validation; preserve valid siblings; unresolved-only bounded splitting; refusals remain non-retryable                   | Adapter and 24-case adaptive recovery matrix.                                               |
| HTML/script returned as translation  | XSS/page compromise                                            | Plain-text output, strict schemas, no HTML insertion, suspicious-output tests                                                                               | Unit and browser tests.                                                                     |
| Forged page message                  | Unauthorized action/data access                                | Isolated-world assumptions plus sender/tab/frame/request checks and schemas                                                                                 | Message fuzz/integration tests.                                                             |
| Cross-tab/navigation response        | Wrong page mutation                                            | Bind session to tab, frame, URL/navigation identity, and request ID                                                                                         | Navigation race tests.                                                                      |
| Oversized page                       | Browser/API/expense DoS                                        | Incremental traversal, segment/character limits, quotas, timeouts, bounded concurrency                                                                      | Large fixture and API limit tests.                                                          |
| Translation loop                     | CPU/network storm                                              | Extension-owned markers, mutation-origin guard, session IDs, dedup cache                                                                                    | Mutation fixture tests.                                                                     |
| Secret leakage in bundle             | Provider compromise/cost                                       | Server-only secrets, client env allowlist, bundle/source-map scan                                                                                           | Milestone 3 security gate.                                                                  |
| Malformed backend environment        | API-wide outage or diagnostic leakage                          | Blank optional normalization, fail-closed schema, early request ID, value-redacted issue metadata                                                           | Environment and API regression tests.                                                       |
| Request replay                       | Quota/spend abuse                                              | Short-lived auth, request IDs, rate limits, idempotency strategy                                                                                            | API integration tests.                                                                      |
| Malicious DOM attributes             | Incorrect targeting or crashes                                 | Safe attribute reads, bounded strings, no selector execution from page data                                                                                 | Malformed DOM fixtures.                                                                     |
| Storage corruption                   | State confusion/data loss                                      | Versioned schemas, safe parse/fallback, clear-data recovery                                                                                                 | Storage migration tests.                                                                    |
| Provider outage/invalid response     | Partial or misleading translation                              | Classification metadata, stable-ID reconciliation, valid partial preservation, unresolved-only split recovery, bounded exhaustion, honest partial state     | Adapter, recovery, and provider-recovery browser tests.                                     |
| Retry of completed batches           | Duplicate provider disclosure/cost and double-applied text     | Session-bound node state; adaptive and manual continuation select only untranslated connected records; accepted IDs are immutable                           | 2,500-record recovery and multi-batch browser tests.                                        |
| Compromised dependency               | Extension/API compromise                                       | Lockfile, minimal dependencies, audit, review, CSP, no remote code                                                                                          | Release audit.                                                                              |
| Sensitive content sent remotely      | Privacy harm                                                   | Explicit action, warning/block mode, exclusions, no sensitive fields                                                                                        | Privacy fixtures and manual review.                                                         |
| Replayed or guessed session handoff  | Cross-tab translation disclosure                               | Random token, owning destination tab/top frame, cloned copy IDs, compatible protocol/host/port/path, bounded runtime schema, acknowledgment before deletion | Browser duplicate/redirect/copy/comparison and invalid-schema tests.                        |
| Ambiguous duplicate page content     | Old translation applied to the wrong text                      | Fingerprint plus structure/node identity; uncertain matches stay original                                                                                   | Dynamic duplicate and translated-copy tests.                                                |
| Oversized session bundle             | Storage/memory exhaustion or UI freeze                         | 2,500-segment and 2 MB caps at export, validation, worker, and import boundaries                                                                            | Schema limit and 2,206-segment browser/performance tests.                                   |
| Source DOM in comparison             | Script execution, sensitive-value disclosure, or misleading UI | Allowlisted acyclic structural snapshot; no HTML parsing, scripts/styles/handlers/forms/fields/frames/embeds; safe URL policy; disabled buttons             | Snapshot schema and comparison DOM/browser/bundle scans.                                    |
| Destination startup or reuse failure | Visible user tab is lost or central text remains indefinitely  | Store tab binding before navigation; keep visible tab; acknowledgment-gated deletion; expiry/failure/tab cleanup                                            | Successful, duplicate, redirected-failure, and cleanup browser tests.                       |
| Overbroad or stale copy permission   | Extension can inject outside the site the user selected        | Optional HTTP(S) declaration only; direct-gesture exact-origin request; exact-origin event matching; checks before tab creation and after final navigation  | Granted, denied, already-granted, HTTP/HTTPS, wrong-origin, redirect, and revocation tests. |
| Permission callback/event race       | Duplicate destination tabs or stale action replay              | Metadata-only expiring intent, navigation hash, persisted lifecycle, in-memory execution lock, terminal-state idempotence                                   | Popup-closure, callback-plus-event, expiry, and exact-one-tab tests.                        |

## Residual risks

- Sensitive-page heuristics cannot guarantee detection.
- A user can deliberately override a warning.
- Any remote provider may see submitted text; provider terms and regional routing remain product decisions.
- Web pages can replace DOM nodes after translation; restoration is best-effort and must avoid corrupting new content.
- Cross-origin iframes and canvas/image text cannot be fully handled by a normal content script.
