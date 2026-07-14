# ADR 0002: Choose Cloudflare Workers + Hono for the API shell

- Status: Accepted for Milestone 1; revisit before production account/usage storage.
- Date: 2026-07-15

## Context

The API must be small, HTTPS-capable, TypeScript-friendly, secret-safe, rate-limited, and suitable for a translation proxy with bounded payloads.

## Decision

Use Cloudflare Workers with Hono for the API shell and platform-neutral `fetch` for provider calls.

## Rationale

Workers provide typed TypeScript support and encrypted secrets with a simple request handler. Hono provides routing, CORS middleware, and a testable Web-standard API. Application limits will be much smaller than platform limits. Durable account/quota storage remains a later decision.

## Consequences

Provider SDK compatibility must be checked. Stateful quotas and account data may require a separate service. Keep API code portable enough to move to Node if a provider or operational requirement demands it.
