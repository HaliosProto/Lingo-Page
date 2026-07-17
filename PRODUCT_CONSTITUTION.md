# Product constitution

This document defines durable constraints. A milestone specification or task may narrow them but may not silently override them.

## User and data rights

1. Translation is explicit. Background browsing surveillance, covert capture, and automatic sending are prohibited.
2. Page text is transient by default. Persistent or synchronized text requires informed consent, bounded retention, deletion, and a separate approval.
3. Provider recipients and material processing limitations must be disclosed honestly.
4. Originals remain recoverable during the supported session. Failure must not hide completed work or corrupt new content.
5. Diagnostics are metadata-only by default and must never expose page text, secrets, private URLs, cookies, form values, or raw provider bodies.

## Engineering constraints

1. Every trust boundary uses runtime validation; static types alone are insufficient.
2. The extension never owns provider credentials, arbitrary provider endpoints, production quotas, or administrator capabilities.
3. Translated output is inserted only as plain text. Remote executable code, HTML interpretation, and whole-page replacement are prohibited.
4. Permissions are least-privilege and additions require a security/privacy decision plus manifest evidence.
5. Shared domain packages remain browser-, UI-, and provider-independent where their boundary requires it.
6. No selected-provider failure silently changes the recipient.
7. A milestone closes only with recorded verification, honest limitations, and no concealed high-severity issue.

## Product quality constraints

1. Multilingual UX includes BiDi, mixed-script, keyboard, focus, zoom, contrast, reduced motion, and assistive technology behavior.
2. Performance work may not weaken eligibility, validation, restore safety, or privacy controls.
3. Research findings are evidence, not production requirements, until an approved experiment and decision exist.
4. Marketing may not use fabricated evidence, misleading privacy/compliance claims, hidden sponsorship, dark patterns, or unlimited claims unsupported by limits.

## Decision authority

Product-owner approval is required for external data recipients, paid calls, public resources, deployment, publication, purchases, repository visibility, secrets, legal claims, pricing, irreversible platform choices, production retention, and acceptance of material security/privacy risk.

## Change process

Constitution changes require an ADR describing the reason, affected guarantees, alternatives, migration or rollback, and product-owner approval. Implementation tasks cannot amend this document implicitly.
