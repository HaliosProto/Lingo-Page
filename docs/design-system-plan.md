# Extension frontend foundation

Status: CURRENT — Milestone 1.5 foundation

## Goal

Provide one compact, accessible visual language for popup, Options, comparison, and extension-owned page UI without changing translation behavior or copying another product.

## Source files

- `packages/ui/src/tokens.css`: light/dark semantic tokens.
- `packages/ui/src/foundation.css`: shared visual primitives and state behavior.
- `packages/ui/src/components.tsx`: typed React primitives.
- `apps/extension/src/ui/global.css`: extension layouts and surface-specific composition.
- `apps/extension/entrypoints/comparison/style.css`: full-page comparison layout only.

Screen styles may compose shared primitives but must not redefine competing colors, control hierarchy, focus rules, radii, spacing, or motion.

## Token contract

- Typography: XS/SM/MD/LG/XL sizes plus tight/normal line height.
- Spacing: 4, 8, 12, 16, 20, 24, and 32 px steps.
- Radii: small controls, medium cards, large feature surfaces, pill metadata.
- Surfaces: background, default, raised, and subtle.
- Borders: normal and strong; focus is a separate semantic token.
- Status: info, success, warning, and danger foreground/surface pairs.
- Elevation: small control/card and medium raised-surface shadows.
- Controls: one 40 px default height.
- Motion: 120 ms functional transition; zero/effectively zero under OS or saved reduced motion.

Light/dark values must preserve semantic meaning; status never relies on color alone.

## Shared primitives

| Primitive                         | Contract                                                                                                                         |
| --------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `Button`                          | Primary, secondary, tertiary, destructive, and link/action variants; disabled, hover, active, visible-focus, full-width support. |
| `FormField`                       | Label, control, and optional hint remain one accessible unit.                                                                    |
| `SegmentedControl`                | Labeled pressed-state group for mutually exclusive view modes.                                                                   |
| `StatusCard`                      | Neutral/info/success/warning/danger status with text title, description/meta, and optional action content.                       |
| `ErrorMessage` / `WarningMessage` | Semantic status-card specializations; errors default to alert behavior.                                                          |
| `ProgressIndicator`               | Text label/value plus native progress and queue details.                                                                         |
| `LoadingIndicator`                | Text status with nonessential animation removed by reduced motion.                                                               |
| `PermissionRequest`               | Explains why exact-origin access is needed before the related action.                                                            |
| `EmptyState`                      | Bordered text state for absent optional data.                                                                                    |
| `Disclosure`                      | Native details/summary progressive disclosure with visible keyboard focus.                                                       |

## Action hierarchy

- **Primary:** the strongest next step on the current surface, normally Translate, Compare, Update changed sections, Save, or Open translated copy in comparison.
- **Secondary:** safe alternative or supporting action such as translated copy or Close.
- **Tertiary:** lower-emphasis utility such as check, refresh, reset, swap, source page, or diagnostics download.
- **Destructive:** cancel/end/remove/clear only when the action can discard or reverse user work; destructive meaning appears in text and styling.
- **Link/action:** navigation or compact inline action such as Settings, Retry text, or Remove.

Only one primary action should dominate a compact decision group. Destructive actions belong behind confirmation/progressive disclosure where appropriate.

## Surface composition

### Popup

- Fixed 360 px width with 18 px shell padding and compact 14 px vertical rhythm.
- Page readiness, languages, progress, session, recovery/notices, backend recipient, privacy, and footer remain ordered by user decision.
- Original/Translated is a segmented mode switch.
- Compare is the primary session destination; page-change scan is tertiary; exact-origin translated copy has its own permission explanation.
- Refresh and end session remain under accessible disclosure; end is destructive.
- Failure actions keep the recommended recovery primary and technical metadata collapsed.

### Options

- Raised grouped cards up to 680 px, collapsing compound controls at 600 px.
- Save is primary, cache clear secondary, diagnostics tertiary.
- Empty glossary and excluded-domain help use shared primitives.

### Comparison

- Shared action variants in a responsive toolbar; pane layout remains comparison-specific.
- Open translated copy is primary, Close secondary, linked scroll/swap/reset/source tertiary.
- Permission explanation uses the same exact-origin primitive as popup.
- At narrow widths panes stack; at 200% zoom essential toolbar/pane labels remain reachable without document horizontal overflow.

## Accessibility and BiDi requirements

- Native semantic controls, labels, roles, pressed states, live regions, details/summary, and progress remain intact.
- Focus outline applies to buttons, links styled as buttons, inputs/selects/textarea, summaries, and explicit tabindex regions.
- Logical CSS properties and `dir="auto"`/language direction boundaries preserve RTL/LTR and mixed content.
- Reduced motion removes button lift/spinner animation and all nonessential extension transitions.
- Formal screen-reader, contrast/high-contrast, 400% zoom, and branded-browser acceptance remain separate release gates.
