# ADR 0006: Preserve current client, domain, API, and provider boundaries

- Status: Accepted; desktop/mobile implementations remain pending candidates.
- Date: 2026-07-18

## Context

The local MVP already separates browser DOM/UI, pure translation logic, cross-boundary schemas, API policy, and provider adapters. The long-term product needs more clients, but speculative unification would increase risk and erase working evidence.

## Decision

Preserve WXT/React for the browser client, Cloudflare Workers/Hono for the current API, pure shared packages for reusable contracts/domain logic, and backend-only provider adapters. Chrome-specific capture/session/DOM code stays in the extension. Future Edge/Firefox/Safari, desktop, and mobile clients reuse contracts selectively through platform adapters. Backend portability remains a design constraint; production identity/storage is a later ADR.

## Consequences

No rewrite is authorized. WXT multi-browser claims require browser-specific permission/lifecycle/package tests. Desktop candidates (native/Tauri/Electron) and mobile candidates require capability, security, accessibility, bundle, and store-policy prototypes before selection.
