# Acceptance criteria

Implementation status: Milestones 0-2 pass. Milestone 3 passes in deterministic/mock and mocked-upstream form; a live real-provider smoke test remains credential-dependent. Local-MVP portions of Milestones 4-6 pass as recorded in `docs/mvp-verification-report.md`.

## Milestone 0

- Repository and environment status is evidenced.
- `AGENTS.md`, `README.md`, `TASKS.md`, `CHANGELOG.md`, `.env.example`, and all required `docs/` living documents exist.
- Product behavior, architecture, package boundaries, API contracts, security/privacy/threat models, provider/framework/backend evaluations, pipeline, testing, performance, compatibility, roadmap, milestones, and verification matrix are documented.
- Choices are explicit, provisional where appropriate, and linked to alternatives/risks.
- No extension or backend feature code is implemented.

## Milestone 1

- Workspace installs and builds with a lockfile.
- Extension and API shells compile in strict TypeScript mode.
- MV3 manifest has minimal declared permissions and no provider secret.
- Popup/options/worker/content-script entrypoints load.
- Shared schemas validate both accepted and rejected messages.
- Health endpoint works locally; mock-only provider interface exists.
- Unit tests, lint, format, typecheck, production build, and unpacked-load smoke test pass.

## Milestone 2

- Local fixtures prove safe eligibility and in-place mutation.
- Original text restores without replacing page HTML.
- Mock provider output is deterministic and visibly transformed.
- Cancellation and stale navigation cannot corrupt the page.
- Excluded content and extension-owned UI remain unchanged.
- Browser scenarios and console checks pass.

## Milestone 3

- Extension contacts only the API.
- Provider key exists only in backend secret configuration and is absent from the extension bundle/source maps.
- Request/response limits, auth, timeouts, safe retry, rate limits, usage, and normalized errors are tested.
- Real-provider smoke test is opt-in and documented.

## Milestone 4+

Use the criteria in `docs/verification-matrix.md` as the gate. No milestone is complete with unresolved high-severity security, privacy, correctness, or data-loss failures.

## Universal provider release-candidate extension

- Every provider is registered by stable ID with honest configured/enabled state, safe capability metadata, and backend-only credentials/endpoints.
- Native Gemini, OpenAI, Anthropic, Cohere, and DeepL requests and the generic compatible profiles pass mocked contract tests.
- Extension selection contains only backend-enabled providers and allowlisted models; backend validation rejects invented values.
- No selected-provider failure silently sends text to another provider.
- Malformed, fenced, refused, truncated, partial, stale, duplicate, unknown, markup-injecting, token-changing, or excessively expanded output fails safely.
- Normal automated tests and browser tests make no paid provider request. Live test and benchmark commands are explicit and documented.
- Full verification, browser mock regression, secret/bundle scans, and a rebuilt local unpacked candidate pass before local commit.
