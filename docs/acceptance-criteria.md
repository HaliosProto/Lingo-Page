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

- Display mode is independent from lifecycle; original and translated values remain reusable after full, partial, and cancelled translation.
- Original/translation switching repeats with zero backend/provider calls; exact originals and page interaction remain intact.
- Changed scans distinguish confident new/modified/removed/reordered records from uncertain duplicates; updates transmit only confident changed eligible text.
- Translated copies request only an explicitly approved current HTTP(S) origin from the open-copy gesture, clone bounded validated sessions, recheck final-origin access, confidently match the same navigation, reconcile one bounded hydration pass, acknowledge only after the final translated DOM, make zero provider calls for matches, and remain isolated from the source. Denial and revocation preserve the source and fail closed without repeated prompting or an all-site grant.
- Comparison renders aligned plain text without source HTML/scripts, supports keyboard/copy/responsive/BiDi states, and fails safely for invalid or expired handoff.
- End session is separately confirmed, restores originals, cancels work, stops observers/timers, and clears only the owning tab session.
- The 2,206-segment managed fixture records switch/copy/comparison time, request deltas, long tasks, and directional memory evidence against the Milestone 0 baseline.
- Saved and OS reduced motion, semantic controls, narrow/dark layouts, and mixed RTL/LTR content have managed evidence; branded Chrome and screen-reader evidence are reported separately.
- Required permissions retain `activeTab` without `<all_urls>`; optional HTTP/HTTPS patterns are granted only per current origin. Plain-text output, backend-only keys, runtime validation, bounds, and privacy defaults are preserved; deferred restart/SPA/viewport work is not claimed.
- Incomplete provider batches preserve every valid stable-ID record, retry unresolved IDs only through bounded adaptive splitting, reduce only the current session's safe batch target, continue the later queue, and report honest final unresolved state without recursively retrying authentication, quota, refusal, model, or configuration failures.
- One translated-copy click records a metadata-only expiring intent, requests the exact origin directly from the gesture, and resumes idempotently from either the permission callback or exact-origin permission event. Grant creates exactly one destination; denial, expiry, wrong origin, redirect mismatch, and revocation never mutate the source or apply the bundle to another site.

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
