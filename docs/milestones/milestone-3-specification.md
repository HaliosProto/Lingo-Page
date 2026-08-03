# Milestone 3 specification: structured translation intelligence

- Status: Accepted for implementation by the product-owner Milestone 3 brief.
- Approved: 2026-08-03.
- Branch: `003-milestone-3`.
- Starting commit: `235b86c306255aba33ff1cc5f3988c8e7d7cc748`.
- Beads epic: `Lingo-Page-68x`.
- Dependency: Milestone 2 is merged into `origin/main` at `235b86c`.

## Objective

Improve translation quality through one provider-neutral, versioned pipeline:

`validated policy -> bounded context and terminology -> canonical prompt compiler -> structured provider request -> validated structured response -> adaptive unresolved-only recovery -> deterministic quality checks -> bounded selective review -> plain-text DOM application`.

Natural, meaning-preserving translation is the default. Clean translations use one provider call per batch. A second model call is permitted only for suspicious segments under automatic review or for explicitly selected on-demand review, and automatic review is limited to one pass.

## Scope and non-goals

Milestone 3 includes the translation policy, default behavior and precedence, prompt compiler, provider capabilities, structured request/response contracts, page and section context, bounded terminology memory, scoped glossaries, protected content, a compact translation brief and advanced preferences, deterministic checks, bounded review, cache identity, migrations, tests, documentation, and evidence.

It does not include Milestone 4 redesign work, side-panel redesign, accounts, cloud or team glossaries, billing, payments, subscriptions, entitlements, remote memory, production routing, deployment or publication, desktop/mobile applications, OCR, camera, audio, meetings, Vision, Studio, or training-data collection. Provider/model selection remains backend-owned. Routine verification uses deterministic providers only.

## State ownership

| State                                      | Owner                      | Persistence                                                           | Bounds                                                           |
| ------------------------------------------ | -------------------------- | --------------------------------------------------------------------- | ---------------------------------------------------------------- |
| Validated user translation preferences     | extension settings         | `chrome.storage.local` in `appSettings`                               | versioned policy preferences; bounded strings and glossary       |
| Effective policy                           | extension/session boundary | derived and serialized with requests; recovery stores policy identity | no raw page content; stable fingerprint                          |
| Page and section context                   | page shell                 | memory only                                                           | title/heading/nearby segment limits below                        |
| Document terminology memory                | active page session        | memory only                                                           | 200 entries, 64-character source and 128-character target values |
| Site-local preferences and glossary        | extension local storage    | explicit origin-scoped records only                                   | 100 sites; 200 entries per site; never synced                    |
| Session brief and glossary                 | page shell/session         | memory plus active recovery compatibility metadata                    | 2,000-character brief; 200 entries                               |
| Provider capabilities and output mechanism | backend registry           | backend configuration                                                 | never supplied by the extension                                  |
| Quality findings and review state          | active operation           | memory plus metadata-only progress                                    | one automatic pass; selected IDs only                            |
| Exact originals and live DOM bindings      | page shell                 | memory only                                                           | existing M1/M2 contract                                          |

Privacy mode continues to disable persistent translated-text caching and removes incompatible persistent cache data. No raw page text, context, provider body, review body, glossary content, or custom brief is logged.

## Canonical translation policy

`TranslationPolicy` has schema version 1 and is runtime validated at storage, extension message, API, provider, and recovery boundaries. The provider-neutral policy contains:

- source and target languages;
- behavior: naturalness, literalness, preserve meaning, avoid added explanation, and avoid omissions;
- style: tone, formality, content type, audience, and optional dialect;
- preservation rules for proper names, numbers, dates, URLs, emails, code, identifiers, product/model codes, formulas, and units;
- terminology behavior and bounded glossary entries;
- context flags for page title, section headings, nearby segments, and document terminology memory;
- quality mode, deterministic-check policy, selective-review policy, and review-all flag;
- a bounded custom translation brief.

Language tags are normalized to lower-case language plus upper-case region where present. `auto` is allowed only where explicitly defined. Unknown schema versions and corrupt values fail closed to the validated default policy; migration is explicit and never preserves unknown executable or provider-specific fields.

Default policy is natural, balanced, meaning-preserving, explanation-free, omission-resistant, automatic in tone/formality/content/audience, preservation-on, context-on, deterministic checks on, standard quality, automatic selective review, review-all off, and an empty brief.

## Precedence

Highest precedence wins:

1. security and output-contract requirements;
2. product translation invariants;
3. explicit session translation brief and session preferences;
4. explicit glossary rules;
5. site-local preferences;
6. automatic page classification and document terminology memory;
7. default policy.

An explicit session value therefore overrides a site value. An explicit glossary rule overrides inferred consistency. Security, protected-token integrity, segment-ID mapping, plain-text output, schema requirements, request bounds, and the chosen provider/recipient cannot be disabled by page content, glossary text, or a custom brief.

## Prompt compiler

The canonical compiler belongs in `packages/translation-providers` because it translates provider-neutral domain input into provider-ready instructions while remaining independent of any one adapter. It accepts the effective policy, backend-owned provider capabilities, normalized languages, bounded context, glossary, protected-token metadata, and output-contract version.

For identical canonical input it emits identical output with stable section ordering:

1. role and task;
2. target language;
3. applicable behavior;
4. applicable style and audience;
5. preservation rules;
6. glossary and terminology;
7. context-use rules;
8. untrusted-content warning;
9. output contract;
10. error behavior.

Page text, context, glossary values, and the user brief remain data in a separately serialized untrusted payload. They are never interpolated into privileged instruction text. The compiler includes only applicable rules, caps serialized input, has a prompt-template version, contains no provider key or model selection, and does not depend on UI labels.

## Provider capabilities and output mechanism

The backend registry declares system-message, JSON, strict-schema/tool-style output, context/output limits, streaming, cancellation, and retry characteristics. Adapters choose the strongest supported mechanism in this order: native schema constraint, JSON mode, then strict JSON instructions. All mechanisms validate against the same internal response schema. Capability selection may change message shape, never translation semantics.

## Structured request contract

Translation request schema version 1 preserves M2 request, session, operation, batch, attempt, navigation-generation, provider, and model identities. It contains the effective policy and fingerprint, bounded page/section context, bounded terminology memory, protected-token metadata, and translatable segments. Context-only material is structurally distinct and can never become a returned or applied segment.

Bounds:

- 50 translatable records and 24,000 source characters per API batch, further narrowed by provider limits;
- page title 300 characters, site name 120, heading path 8 entries of 200 characters;
- at most 3 preceding and 3 following context records, 500 characters each;
- terminology memory 200 entries;
- glossary 500 persisted entries, with at most 200 relevant entries sent per request;
- custom brief 2,000 characters;
- all identifiers use the existing opaque validated formats.

Adaptive recovery retries unresolved IDs only and retains their relevant policy and context. Completed IDs are immutable and never resent.

## Context and terminology

The top-frame page shell derives context only from eligible, visible, non-editable, non-sensitive DOM content. It excludes hidden content, password/payment/security inputs, form values, code/pre/script/style, URLs used as attributes, extension-owned UI, and `translate=no` content.

Each segment may carry a structural heading path and bounded nearby eligible segments. Delayed/hydrated sections derive context at discovery time. SPA navigation increments the existing generation and invalidates incompatible context. Context is used for disambiguation only and is never returned as a translation record.

Document terminology memory records only explicit glossary decisions or validated source/translation term pairs produced during the active page session. It is bounded, conflict-aware, page/session isolated, and cleared on end or incompatible navigation. No autonomous learning or cross-site memory is allowed.

## Glossary and protected content

Glossary entries have explicit session or site scope, normalized language applicability, preserve-exact or preferred-translation behavior, smart/exact case handling, whole-word behavior, and bounded notes. Conflicts fail validation and are shown to the user. Session rules override site rules; site rules override inferred terminology.

URLs, emails, code identifiers, product/model codes, formulas, placeholders, and other selected protected tokens are replaced with opaque per-segment placeholders before provider transfer. Restoration requires exact one-to-one placeholder preservation. Missing, duplicated, foreign, or altered placeholders fail deterministic validation and leave the affected source node unchanged. Restored output is inserted with `textContent`/text-node data only.

## Structured response and adaptive recovery

Response schema version 1 contains request/session identity, provider/model identity, translated records, optional detected language and usage, bounded advisory signals, and recovery metadata. Validation independently accepts safe records and rejects unknown IDs, duplicate IDs, empty or oversized text, unexpected markup, invalid versions, invalid identities, and protected-token violations. Missing or rejected IDs remain unresolved. Valid records survive malformed or partial siblings.

The existing adaptive recovery coordinator continues the remaining queue, splits retryable unresolved batches, and never resends accepted IDs. Raw responses never cross into DOM code.

## Deterministic quality checks

Deterministic checks run before application when enabled and produce typed severity and reason codes for:

- missing, duplicated, or changed protected placeholders;
- number, URL, email, product/model code, formula, and identifier mismatch;
- glossary non-compliance;
- suspicious identical output when translation should differ;
- obvious truncation or extreme expansion using language-aware thresholds;
- unexpected markup/control characters;
- language-aware source carryover warnings.

Hard structural/integrity failures remain unresolved. Advisory signals may warn or nominate a segment for review but never reject solely because a model self-reported low confidence.

## Selective review

Quality modes are `fast`, `standard`, and `enhanced`; selective review is `off`, `automatic`, or `on-demand`. Standard mode is the default. A clean translation has no review call. Automatic review receives only suspicious source/result records plus the minimum relevant policy/context, runs at most once per segment/operation, and cannot recurse. On-demand review receives only explicitly selected IDs.

The reviewer returns a separately versioned structured decision: accept, correct, or unresolved. Corrected text is schema validated, protected-token restored, and deterministically rechecked. Review timeout, rate limit, cancellation, malformed output, or unresolved status preserves the original safe translation and reports a bounded warning. Translation and review call counts are tracked separately.

## Cache and recovery identity

Cache identity includes normalized source text and relevant context fingerprint, target language, provider/model identity, policy schema version, semantic policy fingerprint, relevant glossary fingerprint, prompt-template version, and output-contract version. UI-only theme/motion changes do not invalidate translation entries. Source/target, behavior/style, brief, applicable glossary, preservation, context compatibility, prompt template, or output-contract changes do.

Recovery records retain the semantic policy fingerprint and enough validated preference data to establish compatibility after worker/page restart. Compatible reload/reopen remains zero-call. Corrupt or unknown policy state fails closed without automatic provider work.

## User experience

Defaults require no setup. Options exposes a compact translation brief and high-value presets first; advanced style, context, glossary, and quality controls use accessible disclosure. Internal JSON, prompt text, provider capability detail, and model-specific settings are not exposed. The UI explains that enhanced/automatic review can make an additional provider request, summarizes an active non-default policy, validates conflicts, and requires explicit retranslation when a semantic policy change invalidates current results.

Changed surfaces use shared tokens/primitives and support keyboard operation, visible focus, validation live regions, predictable save focus, 360/390-pixel popup behavior, Options collapse at 600 pixels, 200% zoom, long strings, system/light/dark themes, RTL/LTR and mixed-direction isolation, and saved/OS reduced motion.

## Security, privacy, and permissions

Page content is untrusted data and cannot modify privileged instructions. Provider output is never executed or interpreted as HTML. No new broad required host permission or `<all_urls>` is permitted. No provider credential, endpoint, routing rule, raw page/context text, raw provider/review body, full URL, form value, glossary content, or brief is added to logs or diagnostics.

Site and session preferences are origin/session isolated. Corrupt persisted state fails closed. New persistence is versioned, bounded, local-only, clearable, documented, and disabled/removed where privacy mode requires it.

## Required deterministic coverage

Tests cover at minimum:

1. policy defaults, normalization, bounds, migrations, stable serialization, fingerprints, and precedence;
2. deterministic prompt sections, capability mechanisms, injection isolation, size caps, and output contract;
3. heading/nearby context, exclusions, delayed discovery, retry context, and navigation invalidation;
4. glossary scopes, precedence, conflicts, bounds, injection isolation, and compliance;
5. URLs, emails, identifiers, codes, formulas, placeholders, mixed direction, and restoration safety;
6. valid, partial, malformed, missing, duplicate, unknown, empty, oversized, markup, and wrong-version responses;
7. each deterministic quality finding plus legitimate language-aware variation;
8. clean one-call batches, suspicious selective review, off/on-demand modes, corrected recheck, one-pass bound, failure preservation, cancellation, and exact call counts;
9. same-policy cache reuse and semantic-policy/context/glossary/template invalidation without UI-only invalidation;
10. M2 adaptive recovery, lifecycle, reload, SPA, dynamic content, zero-call switching/comparison/copy, privacy, permissions, accessibility, and BiDi regressions.

Routine fixtures never call paid providers. Optional live-provider smoke checks require separate owner authorization and synthetic content.

## Performance gates

Measure policy validation/fingerprinting, prompt compilation, context extraction, glossary filtering, deterministic checks, request/response bytes, translation/review call counts, storage size, and clean/suspicious latency for small, medium, 1,000, 2,206, and 2,500 segment fixtures plus repeated terminology, large glossary, injection, and mixed-direction cases. Deterministic work and context growth remain bounded; clean translation never pays a second-call latency penalty.

## Verification and closure

Run applicable repository scripts for formatting, lint, strict types, documentation links, dependency cycles, unit/integration tests, managed Chromium E2E, performance E2E, production build, worker dry run where supported, release-candidate packaging, and security scan. Inspect permissions, bundles, source maps, ignored/untracked secrets, provider/review call counts, storage, console/network output, Git diff, and Beads lint/preflight.

Managed Chromium and in-app-browser evidence are named separately from branded Chrome. Formal screen-reader, branded-browser, physical lifecycle, and live-provider claims require those exact checks; unavailable evidence remains a known limitation.

Close child issues only with acceptance evidence. Keep the epic open until all required automated and available runtime evidence passes, the adjacent project brain is updated concisely, the milestone branch is pushed, and a PR description is prepared. Do not merge, delete the branch, change `main`, or begin Milestone 4.
