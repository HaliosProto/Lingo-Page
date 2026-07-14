# Backend platform evaluation

| Option | Strengths | Costs/risks | Decision |
| --- | --- | --- | --- |
| Cloudflare Workers + Hono | Web-standard fetch runtime, TypeScript support, encrypted secrets, edge deployment, clear request/resource limits, small API surface | Worker runtime constraints; stateful quotas need a separate data store; provider SDK compatibility varies | Choose for API shell. |
| Node.js API (Fastify/Hono) | Broad SDK compatibility, easy local debugging, mature ecosystem | Hosting/patching/egress/scale choices; larger operational surface | Keep as a portable fallback if provider SDK/runtime blocks Workers. |
| Supabase Edge Functions | Natural future fit for auth, Postgres, usage, and subscriptions | Runtime and deployment coupling; account/auth work is out of scope now | Defer to Milestone 7 evaluation. |
| Serverless platform functions | Simple deployment and autoscaling | Vendor-specific limits and less direct control over edge/secret behavior | No advantage over Workers for this first API. |

## Decision

Use Cloudflare Workers + Hono for the API shell. Keep provider calls behind `TranslationProvider` and use platform-neutral `fetch` where possible. Add durable quota/account storage only when Milestone 7 requirements are implemented. Cloudflare secrets are server bindings; they are never returned to the extension.

Cloudflare's documented Worker limits reinforce the need for application-level smaller limits: default request body, CPU, subrequest, memory, and connection limits are platform constraints, not product safety controls. Hono provides standard CORS middleware and a testable `app.request` pattern.

Sources: [Cloudflare Workers TypeScript](https://developers.cloudflare.com/workers/languages/typescript/), [Cloudflare Workers secrets](https://developers.cloudflare.com/workers/configuration/secrets/), [Cloudflare Workers limits](https://developers.cloudflare.com/workers/platform/limits/), [Hono](https://hono.dev/docs), [Hono CORS](https://www.honojs.com/docs/middleware/builtin/cors).
