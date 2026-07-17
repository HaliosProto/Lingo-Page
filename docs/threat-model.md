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

| Threat                              | Impact                                                     | Mitigation                                                                                                   | Verification                                                      |
| ----------------------------------- | ---------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Prompt-injection text in page       | Changes provider behavior                                  | Provider adapter isolates page text as data; fixed system/config; no provider controls from page             | Fixture with adversarial instructions; provider request snapshot. |
| Invented provider/model or fallback | Sends text to an unintended recipient                      | Backend registry and model allowlist; selected-provider failure is terminal; no cross-provider fallback      | API rejection tests and registry-state tests.                     |
| Custom-provider SSRF/proxy abuse    | Reaches arbitrary/private services                         | Backend-only URL; HTTPS public or loopback policy; no client URL/headers; fixed translation route and limits | URL-policy and controlled-test-route tests.                       |
| Malformed/refused LLM output        | Corrupts DOM or hides partial work                         | Strict local JSON/ID/token/plain-text validation; bounded retry only for malformed compatible output         | Adapter contract matrix.                                          |
| HTML/script returned as translation | XSS/page compromise                                        | Plain-text output, strict schemas, no HTML insertion, suspicious-output tests                                | Unit and browser tests.                                           |
| Forged page message                 | Unauthorized action/data access                            | Isolated-world assumptions plus sender/tab/frame/request checks and schemas                                  | Message fuzz/integration tests.                                   |
| Cross-tab/navigation response       | Wrong page mutation                                        | Bind session to tab, frame, URL/navigation identity, and request ID                                          | Navigation race tests.                                            |
| Oversized page                      | Browser/API/expense DoS                                    | Incremental traversal, segment/character limits, quotas, timeouts, bounded concurrency                       | Large fixture and API limit tests.                                |
| Translation loop                    | CPU/network storm                                          | Extension-owned markers, mutation-origin guard, session IDs, dedup cache                                     | Mutation fixture tests.                                           |
| Secret leakage in bundle            | Provider compromise/cost                                   | Server-only secrets, client env allowlist, bundle/source-map scan                                            | Milestone 3 security gate.                                        |
| Malformed backend environment       | API-wide outage or diagnostic leakage                      | Blank optional normalization, fail-closed schema, early request ID, value-redacted issue metadata            | Environment and API regression tests.                             |
| Request replay                      | Quota/spend abuse                                          | Short-lived auth, request IDs, rate limits, idempotency strategy                                             | API integration tests.                                            |
| Malicious DOM attributes            | Incorrect targeting or crashes                             | Safe attribute reads, bounded strings, no selector execution from page data                                  | Malformed DOM fixtures.                                           |
| Storage corruption                  | State confusion/data loss                                  | Versioned schemas, safe parse/fallback, clear-data recovery                                                  | Storage migration tests.                                          |
| Provider outage/invalid response    | Partial or misleading translation                          | Timeout, normalized errors, exact response reconciliation, preserved completed sections, pending-only retry  | Error-path and continuation browser tests.                        |
| Retry of completed batches          | Duplicate provider disclosure/cost and double-applied text | Session-bound node state; continuation selects only untranslated connected records                           | Large multi-batch cancellation/continuation browser test.         |
| Compromised dependency              | Extension/API compromise                                   | Lockfile, minimal dependencies, audit, review, CSP, no remote code                                           | Release audit.                                                    |
| Sensitive content sent remotely     | Privacy harm                                               | Explicit action, warning/block mode, exclusions, no sensitive fields                                         | Privacy fixtures and manual review.                               |
| Replayed or guessed session handoff | Cross-tab translation disclosure                           | Random single-use token, owning comparison tab, cloned copy IDs, exact navigation, bounded runtime schema    | Browser copy/comparison and invalid-schema tests.                 |
| Ambiguous duplicate page content    | Old translation applied to the wrong text                  | Fingerprint plus structure/node identity; uncertain matches stay original                                    | Dynamic duplicate and translated-copy tests.                      |
| Oversized session bundle            | Storage/memory exhaustion or UI freeze                     | 2,500-segment and 2 MB caps at export, validation, worker, and import boundaries                             | Schema limit and 2,206-segment browser/performance tests.         |
| Source HTML in comparison           | Script execution or misleading reconstructed UI            | Dedicated extension page renders validated strings only and imports no source markup                         | Comparison DOM/browser and bundle scans.                          |

## Residual risks

- Sensitive-page heuristics cannot guarantee detection.
- A user can deliberately override a warning.
- Any remote provider may see submitted text; provider terms and regional routing remain product decisions.
- Web pages can replace DOM nodes after translation; restoration is best-effort and must avoid corrupting new content.
- Cross-origin iframes and canvas/image text cannot be fully handled by a normal content script.
