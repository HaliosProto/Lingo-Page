# Lingo product roadmap

Status: CURRENT

Last approved sequence: 2026-07-18

This is the sole authority for milestone order. The browser extension must be commercially launch-ready before desktop or mobile product implementation begins. Work advances one approved milestone at a time; planning does not authorize implementation.

## Program sequence

| Milestone | Outcome                                                          | Status    | Hard dependency                                             |
| --------- | ---------------------------------------------------------------- | --------- | ----------------------------------------------------------- |
| M1        | Durable translation sessions and comparison                      | COMPLETED | Accepted Milestone 1 specification and evidence             |
| M1.5      | Repository cleanup, roadmap realignment, and frontend foundation | ACTIVE    | M1 acceptance fixes merged to `main`                        |
| M2        | Reliability, lifecycle resilience, and performance               | PLANNED   | M1.5 accepted                                               |
| M3        | Translation quality, context, and terminology                    | PLANNED   | M2 reliability baseline                                     |
| M4        | Finished extension frontend and user experience                  | PLANNED   | M2 and M3 contracts                                         |
| M5        | Advanced browser-extension capabilities                          | PLANNED   | M4 extension UX                                             |
| M6        | Accounts, cloud services, and usage platform                     | PLANNED   | M2 privacy/reliability acceptance                           |
| M7        | Payments, plans, subscriptions, and monetization                 | PLANNED   | M6 identity, entitlements, and metering                     |
| M8        | Cross-browser production extension launch                        | BLOCKED   | M2-M7 accepted plus the GA gate below                       |
| M9        | Desktop application                                              | BLOCKED   | M8 accepted                                                 |
| M10       | Mobile applications                                              | BLOCKED   | M8 accepted                                                 |
| M11       | Lingo Vision, audio, and meetings                                | BLOCKED   | M8 plus separately approved capture/consent architecture    |
| M12       | Lingo Studio and enterprise localization                         | BLOCKED   | M8 plus validated professional demand and platform controls |

## M1 — Durable translation sessions and comparison

Status: COMPLETED after acceptance fixes.

Delivered page-owned session state, zero-call Original/Translated switching, explicit change scans and changed-only updates, adaptive incomplete-response recovery, acknowledged translated-copy handoff, a sanitized full-page comparison, explicit end-session cleanup, saved reduced-motion behavior, BiDi coverage, and deterministic long-page reuse evidence.

The accepted contract and dated evidence are in `docs/milestones/milestone-1-specification.md` and `docs/milestones/milestone-1-verification-report.md`. Branded-browser, formal accessibility/BiDi, and owner acceptance gaps remain explicit; they do not erase the implemented M1 contract.

## M1.5 — Repository cleanup, roadmap realignment, and frontend foundation

Status: ACTIVE.

- Establish one canonical document hierarchy and a searchable documentation index.
- Keep task state in Beads and concise operational links in `TASKS.md`.
- Preserve historical verification while removing active duplicate specifications.
- Establish this extension-first sequence and the M8 commercial GA gate.
- Define provider-neutral billing, entitlements, usage, and cost-control boundaries without selecting or configuring a payment provider.
- Audit the running extension and implement a low-risk shared frontend foundation without changing translation behavior.

M1.5 must not begin M2 features, accounts, payments, deployment, publication, desktop, mobile, Vision, meetings, or Studio implementation.

## M2 — Reliability, lifecycle resilience, and performance

- Browser restart and extension service-worker restart recovery.
- Page reload reconstruction and sleep/wake recovery.
- Complex SPA navigation, history transitions, infinite scroll, and mutation storms.
- Large-page performance, viewport-aware work, adaptive provider batching, and memory-leak profiling.
- Partial-response recovery, provider backoff/resilience, cancellation, offline, and degraded states.

Acceptance requires bounded performance evidence, stale-session rejection, exact restore safety, lifecycle recovery tests, and no privacy regression.

## M3 — Translation quality, context, and terminology

- Translation briefs covering tone, dialect, formality, audience, slang, and terminology.
- Page and section context with explicit disclosure and bounded collection.
- Glossary, correction feedback, context-aware routing, and quality evaluation.
- Focused quality work for Persian, Arabic, mixed-direction, and low-resource languages.

No hidden provider routing, autonomous learning, or remote memory is authorized by this milestone description.

## M4 — Finished extension frontend and user experience

- Professional popup, browser side panel, Options/account UX, and comparison experience.
- Coherent design system and component library.
- Session, onboarding, error, permission, partial, recovery, and degraded-state UX.
- Accessibility, keyboard, focus, responsive, dark/light, BiDi, zoom, and reduced-motion acceptance.
- Visual regression coverage and browser-specific interaction evidence.

## M5 — Advanced browser-extension capabilities

Only browser-feasible, explicitly approved capabilities belong here:

- Lingo Compose preview/edit/undo for completed drafts; never keylogging or automatic send.
- Chat and form translation with explicit activation and protected-field exclusions.
- Selected-text workflows and subtitle translation where browser APIs permit.
- Bounded document and image workflows that preserve format and consent.
- Saved translation sessions, export/sharing, and correction tools with approved retention.

Desktop-only capture or operating-system integration does not belong in M5.

## M6 — Accounts, cloud services, and usage platform

- Authentication, user accounts, team accounts, revocation, and account deletion.
- Secure settings sync and user-controlled translation-history/data controls.
- Data export, privacy controls, retention enforcement, and audit events.
- Usage metering, quotas, entitlement service, backend observability, and abuse protection.

The backend is authoritative. Page text, history, glossary, or diagnostics must not silently sync.

## M7 — Payments, plans, subscriptions, and monetization

- Free, paid consumer, professional, team, and enterprise plans.
- Monthly/annual subscriptions, trials, promotions, upgrades, downgrades, cancellation, refunds, failed-payment recovery, billing portal, receipts, and invoices.
- Team seats, enterprise contract state, usage-based limits where appropriate, provider-cost protection, and administrative support tooling.
- Server-authoritative entitlement enforcement separated from billing and usage metering.

The provider-neutral architecture is defined in `docs/billing/architecture.md`. Provider selection and external configuration require separate approval after the company structure, operating jurisdiction, tax, sanctions, regional availability, and legal responsibilities are known.

## M8 — Cross-browser production extension launch

- Chrome production readiness and release acceptance.
- Edge and Firefox support and release acceptance.
- Safari feasibility, adapter plan, and honest availability decision.
- Store assets/submissions, privacy policy, terms, support, and incident response.
- Production monitoring, real-user beta, performance, security, accessibility, BiDi, billing, and cancellation acceptance.
- Launch, rollback, and customer-support procedures.

Store submission, deployment, public resources, or purchases still require the applicable product-owner approval.

## Extension General Availability gate

M8 is the hard gate for any desktop or mobile implementation. It is accepted only when all of the following have current evidence:

- Reliable large-page translation and adaptive provider recovery.
- Browser restart, service-worker restart, page reload, SPA, and sleep/wake resilience.
- No known critical or high security issue; minimal justified permissions.
- Accepted privacy model and data controls.
- Formal accessibility and RTL/LTR/BiDi acceptance.
- Finished extension UX across required states and supported viewports.
- Accounts, deletion/export controls, usage metering, quotas, and server-authoritative entitlements.
- Subscription management, cancellation/refund flows, billing acceptance, and provider-cost controls.
- Chrome, Edge, and Firefox release acceptance plus Safari feasibility decision.
- Store-submission readiness, production monitoring, incident response, support workflow, and real-user beta acceptance.
- Documented launch rollback and recovery procedures.

**No desktop or mobile application implementation may begin until M8 is accepted and the browser extension is commercially launch-ready.** Earlier planning or architecture is allowed only when necessary to avoid locking the extension into an incompatible design, and it must not create product implementation.

## M9 — Desktop application

After M8, a separately approved desktop milestone may reuse shared domain contracts while adding platform-native consent, accessibility APIs, capture/OCR, offline model management, and operating-system permission UX. Browser permissions are never a substitute for operating-system consent.

## M10 — Mobile applications

After M8, separately approved mobile milestones may evaluate share sheets, keyboards/input methods, Android accessibility integration, iOS extension constraints, camera/OCR, and offline translation. Compose remains explicit, previewable, undoable, and never auto-sends.

## M11 — Lingo Vision, audio, and meetings

Image, screenshot, camera, speech, captions, translation, summaries, and action items require explicit capture/recording consent, physical-device evidence, bounded retention, and platform-specific privacy review. Covert or continuous capture is prohibited.

## M12 — Lingo Studio and enterprise localization

Professional projects, review, terminology, translation memory, websites/apps/games, and format-aware DOCX/PPTX/XLSX/EPUB/PDF/XLIFF/TMX/TBX workflows require round-trip integrity, roles/audit, tenant isolation, retention, and validated customer demand. Blind text extraction and reinsertion is prohibited.

## Cross-cutting rules

Security, privacy, accessibility, BiDi, research, design, and performance are continuous inputs with milestone-specific acceptance. Research findings and market plans do not authorize implementation. Paid calls, new recipients, accounts, public deployment/publication, purchases, and legal claims require explicit approval.
