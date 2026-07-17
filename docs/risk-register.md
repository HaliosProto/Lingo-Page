# Program risk register

| ID  | Risk                                                             | Likelihood / impact           | Current control                                       | Next treatment / owner gate                                  |
| --- | ---------------------------------------------------------------- | ----------------------------- | ----------------------------------------------------- | ------------------------------------------------------------ |
| R1  | Lifecycle loss leaves page and popup state inconsistent          | High / High                   | Page-owned originals, session IDs, stale checks       | M1 durable-session design and restart matrix                 |
| R2  | Long pages cause delayed visible value or main-thread jank       | High / High                   | Bounded batches and serial work                       | M1 viewport-first/adaptive batching measurements             |
| R3  | Editable, hidden, or excluded descendant text is included        | Medium / High                 | Conservative selectors and heuristics                 | Validate/fix findings in security baseline; privacy fixtures |
| R4  | Mixed-direction text misleads or becomes hard to copy/read       | High / High for RTL audiences | `dir="auto"`, plain text, some logical CSS            | BiDi engine contract and release fixture gate                |
| R5  | Provider behavior/terms change or quality is uneven              | High / Medium                 | Backend registry, allowlists, mock tests, no fallback | Owner-approved terms/smoke/benchmark program                 |
| R6  | Development rate/quota maps are mistaken for production controls | Medium / Critical             | Documentation labels them process-local               | M7 durable identity/accounting before release                |
| R7  | New persistence creates privacy or deletion debt                 | Medium / High                 | Cache off by default and bounded                      | Data-retention approval checklist and schema lifecycle       |
| R8  | Browser permission/lifecycle differences break expansion         | High / Medium                 | Chrome-only stated support and package boundaries     | Browser-specific prototypes and suites before commitment     |
| R9  | Research metrics become misleading product claims                | Medium / High                 | Human review and honest limitations                   | Evaluation protocol, dataset/license review, claim approval  |
| R10 | Tooling initialization overwrites repository rules/specs         | Low / High                    | No unsafe initialization; documented safe plan        | Isolated branch/diff and version pin after tool approval     |
| R11 | Dependency advisories cannot be refreshed offline                | Medium / Medium               | Lockfile and existing scan; historical audit evidence | Re-run production audit with approved registry access        |
| R12 | Release artifacts do not prove exact clean source                | Medium / High                 | Checksums and HEAD metadata                           | Strict manifest allowlist and clean-tree provenance gate     |
| R13 | Marketing outpaces verified privacy/quality/release evidence     | Medium / High                 | Constitution and launch prerequisites                 | Evidence review before public claims/assets                  |
| R14 | Roadmap breadth dilutes browser-product quality                  | High / High                   | One milestone at a time                               | Owner approves exact scope; distant work stays epic-level    |

Risk acceptance never follows from documentation alone. Material security, privacy, cost, legal, or user-data risks require product-owner approval and explicit evidence.
