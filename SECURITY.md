# Security policy and reporting

The canonical engineering model is in `docs/security-model.md`, with current threats in `docs/threat-model.md` and the bounded repository baseline in `docs/security-baseline.md`.

Do not include credentials, private page content, authorization headers, provider responses, private URLs, or production details in a report. Record the affected version, exact local code path, defensive impact, confidence, safe remediation, and a non-weaponized regression test. Security work must stay within systems and code the reporter is authorized to review.

Before any public release, the project requires a private reporting contact, response/embargo procedure, supported-version policy, dependency/secret/permission/bundle evidence, and an incident/rollback process. Those public operational details are not yet established.
