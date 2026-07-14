# ADR 0001: Choose WXT for the extension shell

- Status: Accepted for Milestone 1; revisit if build/runtime limitations emerge.
- Date: 2026-07-15

## Context

The product needs MV3 service-worker, popup, options, content-script, cross-browser portability, TypeScript, React, testing, and maintainable manifest generation.

## Decision

Use WXT + React for the extension shell. Keep browser-independent translation logic in packages so WXT is replaceable.

## Rationale

WXT supports TypeScript, multiple UI frameworks, and generated MV3 manifests while remaining close to the WebExtension APIs. It avoids building custom entrypoint/reload/manifest tooling in the empty repository. Plasmo remains a viable alternative, and raw Vite remains a fallback if WXT blocks a required Chrome behavior.

## Consequences

Generated manifests and bundles must be audited. WXT version updates require build and browser regression checks. Framework abstractions must not hide permission changes or message validation.
