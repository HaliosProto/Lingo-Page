# ADR 0017: Use one versioned provider-neutral translation policy

- Status: Accepted.
- Date: 2026-08-03

## Context

Tone, formality, glossary, preservation, context, and quality behavior previously existed as separate optional request fields or provider prompt details. Adding more quality behavior through those paths would create conflicting provider semantics, unstable cache identity, and UI-owned prompt construction.

## Decision

Use one runtime-validated `TranslationPolicy` with schema version 1. It owns provider-neutral behavior, style, preservation, terminology, context, quality, and a bounded custom brief. Defaults are natural, meaning-preserving, context-aware, explanation-free, omission-resistant, and selectively reviewed only when deterministic findings justify it.

Precedence is security/output contract, product invariants, explicit session brief/preferences, explicit glossary, site preferences, automatic classification/terminology, then defaults. Storage, extension messages, API requests, provider input, recovery, and cache identity validate or fingerprint the same semantic object. UI exposes only high-value preferences through progressive disclosure.

Unknown versions, corrupt values, arbitrary properties, unbounded strings/arrays, provider model names, endpoints, secrets, and executable values are rejected. Missing pre-M3 stored policy migrates to the safe default.

## Consequences

Providers receive consistent semantics, settings and recovery compatibility are explicit, and UI labels no longer define prompt behavior. A semantic policy change invalidates affected cache/session reuse; theme or reduced-motion changes do not.
