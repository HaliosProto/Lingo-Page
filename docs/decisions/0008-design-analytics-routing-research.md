# ADR 0008: Defer new design, analytics, routing, and evaluation infrastructure until evidence exists

- Status: Accepted deferral with decision gates.
- Date: 2026-07-18

## Context

The roadmap considers a component workbench, visual-regression service, privacy-preserving analytics, automatic provider routing, and learned translation-quality metrics. Each adds dependency, data, cost, or product-behavior risk.

## Decision

Keep existing CSS tokens and add managed Playwright visual fixtures first. Do not add a component workbench or hosted visual service until the M1 component/state inventory demonstrates value. Do not collect remote analytics until an event/retention/consent ADR exists. Keep provider choice explicit and backend allowlisted; automatic routing remains off until recipient disclosure, privacy region, quality, cost, fallback, and user-control policy is approved. Use the research registry and offline human-calibrated experiments before adopting learned metrics or research code/data.

## Consequences

The current toolchain remains small. Marketing cannot claim automatic “best” routing or objective quality scores. Later adoption requires license/data review, reproducible evaluation, security/privacy acceptance, capability flags, and rollback.
