# Extension framework evaluation

| Option                   | Strengths                                                                                                                     | Costs/risks                                                                                         | Decision                                                                                       |
| ------------------------ | ----------------------------------------------------------------------------------------------------------------------------- | --------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| WXT                      | TypeScript-first, framework-agnostic, MV3 manifest generation, content-script/service-worker entrypoints, browser portability | Young ecosystem relative to raw Chrome APIs; generated output must be audited                       | Choose. Keeps browser plumbing explicit and supports React without coupling the core to React. |
| Plasmo                   | Excellent React/TypeScript ergonomics, HMR, storage/messaging helpers, fast scaffolding                                       | More opinionated platform layer; long-term behavior and generated permissions need careful auditing | Viable alternative; do not choose unless WXT proves blocked.                                   |
| Raw Vite + Chrome APIs   | Maximum transparency and minimal framework magic                                                                              | More manifest/build/entrypoint/reload/test plumbing; higher maintenance cost                        | Reserve for a future compatibility fallback.                                                   |
| CRXJS/Vite-style tooling | Familiar Vite workflow and direct manifest control                                                                            | Maintenance/version compatibility must be verified; less complete cross-browser abstraction         | Not selected for the baseline.                                                                 |

## Decision

Use WXT with React for the extension shell, while keeping the translation engine and message contracts framework-independent. WXT generates the manifest from configuration and entrypoints; the production bundle and generated permissions remain release-review artifacts.

Sources: [WXT introduction](https://wxt.dev/guide/introduction), [WXT manifest configuration](https://wxt.dev/guide/essentials/config/manifest.html), [Plasmo documentation](https://docs.plasmo.com/).
