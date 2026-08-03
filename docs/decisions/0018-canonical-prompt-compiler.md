# ADR 0018: Compile translation prompts canonically

- Status: Accepted.
- Date: 2026-08-03

## Context

The original provider prompt was structured but monolithic. Copying expanded quality instructions into each adapter would allow semantic drift, contradictory rules, injection mistakes, and unbounded prompt growth.

## Decision

`packages/translation-providers` owns one deterministic, versioned compiler. It emits stable privileged sections for role/task, language, applicable behavior, style/audience, preservation, terminology, context use, untrusted-content boundaries, output contract, and error behavior. It includes only applicable policy rules.

Page segments, context, glossary values, terminology values, dialect, and custom brief remain in a separately stable-serialized untrusted payload. They are never interpolated into privileged instructions. The compiler has explicit system/user and size bounds and contains no credential, endpoint, provider selection, model selection, or UI-label dependency.

Adapters may map system/user roles and output configuration to their protocols. Provider capabilities select schema, JSON, or prompt-only output mechanisms without changing translation semantics.

## Consequences

Identical canonical input produces identical prompts, snapshot/injection tests are meaningful, and provider adapters remain small protocol transformations. Prompt-template changes are explicit cache-identity events.
