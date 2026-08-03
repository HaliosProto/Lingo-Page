# ADR 0022: Make translation cache identity policy and context aware

- Status: Accepted.
- Date: 2026-08-03

## Context

The pre-M3 cache key included language, text, structural context, provider/model, glossary version, tone, and formality. It could incorrectly reuse results after other semantic policy, prompt, glossary, or context changes.

## Decision

Cache keys include source/target language, normalized source text, segment and bounded page/section context fingerprint, provider/model identity, semantic policy fingerprint, relevant glossary version, prompt-template version, and output-contract version. Review requests bypass translation cache; validated corrections may replace the compatible entry.

The active recovery identity also includes the semantic policy fingerprint. Missing pre-M3 policy migrates to defaults; corrupt or unknown state fails closed without automatic provider work. Theme, reduced motion, and other UI-only settings do not affect translation identity.

## Consequences

Compatible reload and same-policy reuse remain zero-call, while meaningful policy/context changes require retranslation. Prompt/output contract upgrades can invalidate safely and deliberately.
