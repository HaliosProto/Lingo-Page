# Design and UX strategy

## Experience goal

Lingo should feel calm, fast, trustworthy, international, professional, friendly, and memorable. The interface should foreground the user’s language goal and translation state—not implementation details or provider marketing.

## Current audit

The compact 360 px popup, responsive Options page, shared CSS tokens, semantic React controls, visible progress/failure copy, `dir="auto"`, theme support, focus styles, and reduced-motion media query form a coherent functional base. Current evidence does not justify calling the UI polished: branded-Chrome visual inspection, long-label/zoom/contrast coverage, formal keyboard/screen-reader review, and saved reduced-motion behavior are still open.

## Principles

- One primary action and one clear state at a time.
- Progressive disclosure for provider, diagnostics, and advanced policy.
- Plain-language recovery actions for partial, stopped, offline, and unsupported states.
- Stable layout during progress and errors; no motion required for comprehension.
- Logical CSS properties and direction isolation for multilingual content.
- Extension UI remains visually distinct from, and technically isolated from, the host page.
- No generic dashboard chrome, decorative delay, excessive cards, random gradients, or raw HTTP/provider terminology in default flows.

## Surface strategy

| Surface                          | Role                                     | Near-term direction                                                                |
| -------------------------------- | ---------------------------------------- | ---------------------------------------------------------------------------------- |
| Popup                            | Fast activation and state/recovery       | Preserve compact hierarchy; improve long-state resilience and lifecycle continuity |
| Options                          | Durable preferences and privacy controls | Group by user outcome, retain explicit recipient/cache disclosure                  |
| Page-owned result                | Selected-text outcome                    | Strong isolation, directional safety, keyboard/copy semantics                      |
| Side panel                       | Future reading workspace                 | Bilingual comparison, paragraph controls, explanations; not an oversized popup     |
| Marketing                        | Explain trust and use cases              | Evidence-led, accessible, lightweight, no product implementation jargon            |
| Desktop/mobile/Studio/enterprise | Platform-specific workspaces             | Share tokens and contracts, not blindly identical layouts                          |

## Required state inventory

Loading, empty, ready, translating, waiting-to-retry, retrying, partial, cancelled, completed, restored, disabled, unsupported, sensitive-page warning/block, backend unavailable, provider unavailable, quota/rate limit, stale navigation, invalid response, cache cleared, and settings-save failure. Hover, focus, active, disabled, high zoom, long strings, RTL, dark/light/system, OS reduced motion, and saved reduced motion apply where relevant.
