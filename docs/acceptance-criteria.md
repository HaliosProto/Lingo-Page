# Acceptance criteria

The original local-MVP acceptance history remains below where useful. The active program gates are the post-MVP Milestones 0 and 1 defined here and in `ROADMAP.md`.

## Milestone 0

- Repository/current/baseline commit, remote, ignored secret files, toolchain, architecture, and living-status contradictions are evidenced.
- Product constitution/vision, complete roadmap, risks, current/platform architecture, 24-stage lifecycle, design/accessibility/BiDi, data lifecycle, research, competitive, marketing, workflow, project memory, user actions, and ADR decisions are coherent and linked.
- Spec Kit is safely integrated or its missing prerequisite, exact official-only isolated plan, and non-blocking status are recorded.
- Beads has one program parent, one epic per approved milestone, and an implementation-ready M1 graph without premature distant tasks.
- Ordinary defensive security and reproducible deterministic performance baselines exist; findings/limitations are classified honestly.
- Applicable format/lint/type/test/build/E2E/security/manifest/bundle checks pass or exact limitations are recorded.
- Diff/staged content contains no secrets/generated clutter/unrelated user file; an authorized local commit is created; M1 implementation has not begun.

## Milestone 1

- Approved versioned session design minimizes stored text and defines migration, deletion, stale-DOM handling, and rollback.
- Original/translation switching repeats without a provider call; changed-section updates send only changed eligible content.
- Popup close/reopen, service-worker termination/restart, tab reload/close, SPA navigation, sleep/wake approximation, backend disconnect/restart, cancellation, continuation, and restore have explicit evidence/limitations.
- Small/medium/large/very-large, viewport-first/adaptive batching, mutation storm, memory cleanup, cache, 429, and timeout baselines meet approved targets or create blocking issues.
- Saved and OS reduced-motion paths work; accessibility and BiDi fixture/visual/clipboard/keyboard gates pass in managed Chromium, with branded-Chrome evidence recorded separately.
- Least permissions, plain-text output, backend-only keys, runtime validation, and privacy defaults are preserved; no accounts, billing, deployment, publication, automatic routing, or new platform implementation is added.

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

Partial, paused, cancelled, or stopped translation must show a normalized plain-language reason, completed and remaining counts, whether an automatic retry will occur, and relevant recovery actions. Technical details are optional and privacy-safe. Automatic retry honors the displayed delay; exhaustion changes the reason; manual continuation processes only failed/pending sections and preserves completed DOM changes.

## Universal provider release-candidate extension

- Every provider is registered by stable ID with honest configured/enabled state, safe capability metadata, and backend-only credentials/endpoints.
- Native Gemini, OpenAI, Anthropic, Cohere, and DeepL requests and the generic compatible profiles pass mocked contract tests.
- Extension selection contains only backend-enabled providers and allowlisted models; backend validation rejects invented values.
- No selected-provider failure silently sends text to another provider.
- Malformed, fenced, refused, truncated, partial, stale, duplicate, unknown, markup-injecting, token-changing, or excessively expanded output fails safely.
- Normal automated tests and browser tests make no paid provider request. Live test and benchmark commands are explicit and documented.
- Full verification, browser mock regression, secret/bundle scans, and a rebuilt local unpacked candidate pass before local commit.
