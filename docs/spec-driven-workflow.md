# Specification-driven development workflow

This project uses a contract-first workflow that is intentionally stronger than a one-off feature checklist:

1. **Discover** — inspect the repository, environment, constraints, and existing behavior.
2. **Specify and clarify** — define user journeys, scope, requirements, non-functional targets, risks, ambiguities, and owner decisions in the approved milestone specification.
3. **Design** — define boundaries, data flow, contracts, security/privacy models, and ADRs before implementation.
4. **Plan** — order milestones and break each into observable tasks in `docs/milestones.md` and `TASKS.md`.
5. **Accept** — define milestone gates before coding in `docs/acceptance-criteria.md` and `docs/verification-matrix.md`.
6. **Implement one milestone** — do not silently cross milestone boundaries.
7. **Verify** — run the applicable static, automated, runtime, browser, security, and error-path checks.
8. **Converge** — compare specification, ADRs, contracts, code, tests, Beads, limitations, and observed behavior; resolve contradictions without rewriting historical evidence.
9. **Record** — update living documents, changelog, task status, known limitations, memory links, and the milestone report.
10. **Spec-to-code review** — trace every accepted requirement to implementation/evidence or a clearly owned gap.
11. **Stop and review** — stop after the report and wait for the next milestone instruction.

The source of truth is the living document set, not an unrecorded plan in chat. Changes to behavior, interfaces, permissions, data handling, provider selection, or milestone scope require a corresponding specification/ADR/task/acceptance update.

Optional template tooling follows `docs/tooling-and-workflow.md`; it cannot overwrite the constitution or repository rules. Beads tracks execution/dependencies and does not replace approved specifications.
