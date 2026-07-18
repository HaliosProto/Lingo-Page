# Billing, entitlements, and monetization architecture

Status: DRAFT — provider-neutral architecture only

Related milestones: M6 accounts/usage, M7 payments/monetization, M8 extension GA

## Scope and authority

This document defines boundaries for future billing work. It does not select, purchase, configure, or integrate a payment provider; set prices; establish a legal entity; or authorize production data retention. Those choices require separate product, legal, privacy, security, tax, and operating-jurisdiction review.

The application backend is authoritative. The extension may display signed-in, plan, quota, and billing status returned by the backend, but local storage or client-provided fields never grant premium access.

## Domain model

| Entity                    | Purpose and authority                                                                                                                   |
| ------------------------- | --------------------------------------------------------------------------------------------------------------------------------------- |
| Authentication identity   | Verifies the person or service session; does not itself imply payment or entitlement.                                                   |
| Customer identity         | Internal account/person/organization identity used to reconcile product and billing records.                                            |
| Billing customer          | Provider-neutral reference to the payer; external provider IDs remain backend-only metadata.                                            |
| Plan                      | Versioned commercial offering such as free, consumer, professional, team, or enterprise.                                                |
| Price                     | Currency, amount, interval, tax behavior, effective dates, and jurisdiction availability for a plan.                                    |
| Subscription              | Customer commitment to a plan/price with lifecycle, renewal, and cancellation state.                                                    |
| Entitlement               | Server-evaluated capability or limit granted from plan, subscription, contract, trial, or support override.                             |
| Usage record              | Idempotent, append-only metering event with account, dimension, quantity, period, and integrity metadata; never raw page text.          |
| Quota                     | Period-bound allowance and consumed/reserved quantity for a metered dimension.                                                          |
| Trial                     | Bounded temporary entitlement with eligibility and abuse controls.                                                                      |
| Invoice                   | Provider-neutral financial document state and safe reference; detailed tax records may remain with the processor or merchant of record. |
| Payment status            | Normalized pending, paid, failed, refunded, disputed, or action-required state.                                                         |
| Refund                    | Authorized reversal with amount, reason category, source event, approver, and immutable audit reference.                                |
| Cancellation              | Request/effective timing, reason category, renewal behavior, and entitlement consequence.                                               |
| Grace period              | Bounded continued access after payment or reconciliation failure, governed server-side.                                                 |
| Team seats                | Purchased, assigned, invited, and available seat counts tied to an organization entitlement.                                            |
| Enterprise contract state | Contract dates, negotiated entitlements, seat/usage terms, invoicing state, and support ownership.                                      |

Identifiers are opaque and scoped. Financial records never contain raw translated/page text. Public client contracts expose only the minimum normalized state required for UX.

## Separated systems

| System                 | Owns                                                              | Must not own                                   |
| ---------------------- | ----------------------------------------------------------------- | ---------------------------------------------- |
| Authentication         | Sessions, revocation, identity assurance                          | Prices, payment truth, usage totals            |
| Billing                | Customers, subscriptions, invoices, payments, refunds             | Product capability decisions in client code    |
| Entitlements           | Effective capabilities/limits and reasoned decisions              | Payment collection or raw provider webhooks    |
| Usage metering         | Idempotent usage events, aggregation, reservation/commit/release  | Plan catalog or payment retries                |
| Provider-cost controls | Upstream budgets, request limits, anomaly stops, recipient policy | Customer invoice truth                         |
| Administrative support | Audited corrections, refunds, reconciliation, customer support    | Unlogged privilege or direct database mutation |

An entitlement decision combines authenticated identity, active plan/subscription/contract/trial state, usage/quota state, grace rules, product policy, and emergency controls. Billing state is an input, not the implementation of authorization.

## Authoritative request flow

1. The client authenticates to the application backend.
2. The backend resolves customer/account/organization context.
3. The entitlement service evaluates the requested capability and current quota.
4. For metered work, the usage service atomically reserves an allowance before the provider call.
5. Provider-cost controls independently allow, limit, or stop the upstream request.
6. Successful work commits measured usage; cancellation/failure releases or adjusts the reservation under a documented rule.
7. The response returns a bounded entitlement/usage projection suitable for client display.

The extension must reject stale account projections when the backend denies a capability. Offline premium behavior requires a separately approved, time-bounded signed grant and revocation model; ordinary local state is insufficient.

## Webhook and event security

- Verify webhook signatures over the exact raw request bytes with a provider-specific, backend-only secret and bounded timestamp tolerance.
- Reject missing/invalid signatures, unsupported event versions, oversized bodies, and events outside the replay window.
- Store the provider event ID and normalized event hash before side effects; duplicate delivery returns success without repeating effects.
- Process events through an idempotent state transition keyed by provider event/customer/subscription version.
- Prevent replay with timestamp tolerance, event-ID uniqueness, monotonic object versions where available, and bounded retention of replay keys.
- Keep raw payload retention minimal and access-controlled. Normalize operational logs; never log secrets, payment instruments, authorization headers, or unrelated personal data.
- Queue retryable processing failures with backoff and a dead-letter/reconciliation path. Acknowledgment must not claim a transition succeeded when durable processing was lost.

## Reconciliation and recovery

- Run scheduled reconciliation between local subscription/invoice state and the billing provider or merchant of record.
- Treat webhook delivery as near-real-time input, not the only recovery mechanism.
- Record last reconciled version/time, mismatches, corrective transition, and safe audit identity.
- Failed payments enter a bounded retry/grace policy. UX explains action required, retained access, expiration, and recovery without exposing processor internals.
- Entitlements change only through documented transitions; emergency support overrides are time-bounded, reasoned, and audited.
- Customer-visible status distinguishes payment failure, subscription cancellation, quota exhaustion, provider outage, and account restriction.

## Trials and abuse protection

- Trial eligibility is backend-authoritative and tied to verified account/risk signals permitted by the privacy model.
- Enforce one active trial per eligible customer/organization and use bounded device/network signals only after explicit privacy/security approval.
- Do not fingerprint covertly or retain raw browsing/page text for trial enforcement.
- Apply quotas, concurrency limits, provider-cost ceilings, suspicious-usage holds, and manual review with appeal/support paths.
- Promotional codes and support grants are single-use or bounded, auditable, and cannot bypass sanctions/region policy.

## Usage integrity and cost protection

- Generate usage IDs server-side or verify signed idempotency keys bound to account, request, capability, and time window.
- Reserve before expensive work; commit actual normalized units after success; release on pre-provider cancellation; document partial/failure charging.
- Prevent duplicate counting across client retries, worker restarts, webhook retries, and provider retries.
- Reconcile aggregate usage with provider invoices/telemetry without storing page text.
- Enforce per-request, per-account, per-organization, per-plan, per-provider, and global emergency limits.
- Provider selection remains backend-owned; a customer-visible plan never silently changes the external recipient.

## Subscription lifecycle rules

### Upgrade

Define effective timing, proration/credit, tax recalculation, immediate versus next-cycle entitlements, quota reset/carryover, and confirmation. Entitlements activate only after an authoritative successful/payment-allowed state.

### Downgrade

Default to next renewal unless explicitly approved otherwise. Explain capability/seat/storage/usage consequences before confirmation and preserve export/deletion access required by policy.

### Cancellation

Record requested and effective timestamps separately. State whether service continues through the paid period, how trials end, what happens to seats/quotas, and how reactivation works. Cancellation must be accessible without dark patterns.

### Refund

Use a documented eligibility and approval workflow. Partial/full refunds are idempotent, reconciled with invoice/payment state, audited, and reflected in entitlements only under an explicit policy.

### Failed payment and grace

Normalize retrying, action-required, grace, restricted, and terminated states. Grace has a maximum duration, customer notification cadence, provider-cost ceiling, and deterministic recovery/expiry transition.

## Account deletion and retention

- Separate deletion of product content/settings from legally required financial records.
- Delete or irreversibly detach product data under the privacy model; revoke sessions and active entitlements.
- Retain invoices, refunds, tax, fraud, and dispute records only for the legally required period and documented purpose in the applicable jurisdiction.
- Preserve a minimal tombstone only when needed to prevent replay, honor deletion, or meet legal obligations; never retain raw translated/page text for billing.
- Document processor/merchant-of-record deletion APIs, subprocessor retention, backups, legal holds, export, and customer notification before launch.

## Provider and jurisdiction evaluation

Final provider selection depends on the company/legal structure, merchant location, customer regions, supported currencies/payment methods, tax registrations, sanctions/export controls, payout availability, data residency, dispute/fraud responsibilities, and operating jurisdiction.

The evaluation must compare:

- **Merchant of record:** provider handles seller-of-record, tax collection/remittance, and some compliance/support obligations, usually with higher fees and less control.
- **Direct processor:** company remains merchant, controlling customer/payment UX but owning tax, invoicing, refunds, disputes, regional restrictions, and more compliance operations.

No option is assumed. Regional availability and sanctions policy must be explicit, fail closed, and reviewed before accepting payment.

## Later app-store billing

Desktop/mobile products may be subject to platform purchase rules. Before M9/M10 monetization, document when app-store billing is required, external-link/account rules, subscription portability, entitlement reconciliation across web/store purchases, family/team behavior, refunds, price changes, taxes, and account deletion. Store receipts are verified server-side; local receipt presence alone never grants durable entitlement.

## Required acceptance before implementation

- Product/legal approval of entity, jurisdiction, regions, plan model, pricing ownership, tax, sanctions, retention, cancellation, and refund policy.
- Security/privacy threat model for payment data, webhooks, admin tooling, abuse controls, and support access.
- Versioned runtime schemas and state machines for customers, subscriptions, entitlements, usage, and webhook events.
- Idempotency, replay, concurrency, reconciliation, failure, deletion, audit, and provider-sandbox tests.
- Operational runbooks for failed payments, disputes, reconciliation, provider outage, support override, incident response, and rollback.
