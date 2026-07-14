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

| Threat                              | Impact                            | Mitigation                                                                                       | Verification                                                      |
| ----------------------------------- | --------------------------------- | ------------------------------------------------------------------------------------------------ | ----------------------------------------------------------------- |
| Prompt-injection text in page       | Changes provider behavior         | Provider adapter isolates page text as data; fixed system/config; no provider controls from page | Fixture with adversarial instructions; provider request snapshot. |
| HTML/script returned as translation | XSS/page compromise               | Plain-text output, strict schemas, no HTML insertion, suspicious-output tests                    | Unit and browser tests.                                           |
| Forged page message                 | Unauthorized action/data access   | Isolated-world assumptions plus sender/tab/frame/request checks and schemas                      | Message fuzz/integration tests.                                   |
| Cross-tab/navigation response       | Wrong page mutation               | Bind session to tab, frame, URL/navigation identity, and request ID                              | Navigation race tests.                                            |
| Oversized page                      | Browser/API/expense DoS           | Incremental traversal, segment/character limits, quotas, timeouts, bounded concurrency           | Large fixture and API limit tests.                                |
| Translation loop                    | CPU/network storm                 | Extension-owned markers, mutation-origin guard, session IDs, dedup cache                         | Mutation fixture tests.                                           |
| Secret leakage in bundle            | Provider compromise/cost          | Server-only secrets, client env allowlist, bundle/source-map scan                                | Milestone 3 security gate.                                        |
| Request replay                      | Quota/spend abuse                 | Short-lived auth, request IDs, rate limits, idempotency strategy                                 | API integration tests.                                            |
| Malicious DOM attributes            | Incorrect targeting or crashes    | Safe attribute reads, bounded strings, no selector execution from page data                      | Malformed DOM fixtures.                                           |
| Storage corruption                  | State confusion/data loss         | Versioned schemas, safe parse/fallback, clear-data recovery                                      | Storage migration tests.                                          |
| Provider outage/invalid response    | Partial or misleading translation | Timeout, normalized errors, exact response reconciliation, restore                               | Error-path tests.                                                 |
| Compromised dependency              | Extension/API compromise          | Lockfile, minimal dependencies, audit, review, CSP, no remote code                               | Release audit.                                                    |
| Sensitive content sent remotely     | Privacy harm                      | Explicit action, warning/block mode, exclusions, no sensitive fields                             | Privacy fixtures and manual review.                               |

## Residual risks

- Sensitive-page heuristics cannot guarantee detection.
- A user can deliberately override a warning.
- Any remote provider may see submitted text; provider terms and regional routing remain product decisions.
- Web pages can replace DOM nodes after translation; restoration is best-effort and must avoid corrupting new content.
- Cross-origin iframes and canvas/image text cannot be fully handled by a normal content script.
