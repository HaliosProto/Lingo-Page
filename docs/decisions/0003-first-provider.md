# ADR 0003: Use a deterministic mock first and DeepL as first real adapter candidate

- Status: Mock accepted for Milestone 2; DeepL provisional pending benchmark for Milestone 3.
- Date: 2026-07-15

## Context

DOM traversal, mapping, cancellation, restore, and security must be proven without API cost or provider variability. The first real provider should have translation-specific controls and predictable plain-text behavior.

## Decision

Milestone 2 uses a deterministic local mock provider. Milestone 3 implements DeepL first, with Google Cloud Translation Advanced and Azure Translator retained as benchmarked alternatives.

## Rationale

DeepL exposes glossary, formality, and formatting concepts directly relevant to webpage translation. Google and Azure offer broader language/document/enterprise features and remain important future adapters. Provider-specific logic stays behind the interface.

## Consequences

DeepL language breadth, regional processing, terms, quotas, and cost must be confirmed before release. No provider choice is permanent; fixture benchmarks decide whether the adapter is production-ready.
