# Design-system plan

## Current foundation

`packages/ui/src/tokens.css` is the token source and `apps/extension/src/ui/global.css` consumes it. The current system covers color, type, spacing, radius, shadow, focus, theme, and a 120 ms fast-motion token. Components remain local React markup; there is no component workbench or visual-regression service.

## Token model

- Semantic color: canvas, surface, text, muted, border, action, success, warning, danger, focus.
- Typography: compact UI and reading/content roles; language-appropriate fallback stacks.
- Space and size: a small constrained scale; popup minimum touch/click targets and predictable control height.
- Shape/elevation: restrained, purpose-driven separation.
- Motion: functional state transitions only; OS or saved reduced-motion removes nonessential transitions.
- Direction: logical spacing/alignment tokens and isolated content containers.

## Component inventory

First candidates are Button, Select, TextField, Toggle, Notice, Progress, StatusSummary, RecoveryActions, Disclosure, ProviderRecipientSummary, Dialog/Card shell, LanguagePair, and DiagnosticsDetails. Each component needs semantic HTML, keyboard behavior, accessible name/description, forced/contrast-state review, direction examples, long-copy examples, and state stories before reuse.

## Tool decisions

| Tooling                 | Decision                               | Reason / gate                                                          |
| ----------------------- | -------------------------------------- | ---------------------------------------------------------------------- |
| Existing CSS tokens     | Keep                                   | Small, dependency-free, already shared                                 |
| Component workbench     | Pending for Milestone 1                | Add only after inventory proves it reduces state/RTL/a11y drift        |
| Screenshot regression   | Use Playwright-managed snapshots first | Already in the stack; stabilize fixtures/fonts/themes before baselines |
| Hosted visual service   | Not now                                | External account, upload, cost, and privacy decision required          |
| Design-file integration | Optional later                         | Requires product-owner design approval and asset/license controls      |

## Governance

No one-off color, spacing, radius, motion, or direction rule is added when a semantic token can express it. Changes require affected-surface examples, accessibility evidence, and migration notes. Visual baselines contain synthetic content only.
