# Specification-driven development workflow

This repository uses a contract-first workflow that is stronger than a one-off feature checklist:

1. **Discover** — inspect the repository, environment, constraints, evidence, and current behavior.
2. **Specify and clarify** — define journeys, scope, requirements, non-functional targets, risks, ambiguities, and owner decisions in the approved milestone specification.
3. **Design** — define boundaries, data flow, contracts, security/privacy models, and ADRs before implementation.
4. **Plan** — order milestones in `ROADMAP.md` and break the approved milestone into observable Beads issues linked from `TASKS.md`.
5. **Accept** — define milestone gates before coding in `docs/acceptance-criteria.md` and `docs/verification-matrix.md`.
6. **Implement one milestone** — do not silently cross milestone boundaries.
7. **Verify** — run the applicable static, automated, runtime, browser, security, documentation, and error-path checks.
8. **Converge** — compare specification, ADRs, contracts, code, tests, Beads, limitations, and observed behavior; resolve contradictions without rewriting historical evidence.
9. **Record** — update living documents, changelog, operational status, known limitations, memory links, and the milestone report.
10. **Spec-to-code review** — trace every accepted requirement to implementation/evidence or a clearly owned gap.
11. **Stop and review** — stop after the report and wait for the next milestone instruction.

The source of truth is the canonical hierarchy in `docs/INDEX.md`, not an unrecorded conversation or duplicated task description. Changes to behavior, interfaces, permissions, data handling, provider selection, or milestone scope require the corresponding specification, ADR, task, acceptance, security/privacy, and evidence updates.

Optional template tooling follows `docs/tooling-and-workflow.md`; it cannot overwrite the constitution or repository rules. Beads tracks execution and dependencies but does not replace approved specifications.
