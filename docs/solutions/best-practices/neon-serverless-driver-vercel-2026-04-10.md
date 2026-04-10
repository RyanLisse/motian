---
title: "Use @neondatabase/serverless with max: 1 on Vercel — not node-postgres"
date: 2026-04-10
category: docs/solutions/best-practices
module: database
problem_type: best_practice
component: database
severity: high
applies_when:
  - Deploying a Drizzle + Neon application to Vercel or any serverless platform
  - Using drizzle-orm/node-postgres with pg.Pool in a Next.js app
  - Running drizzle-kit migrations when DATABASE_URL points to a PgBouncer pooler endpoint
tags:
  - neon
  - drizzle
  - serverless
  - connection-pooling
  - vercel
  - next-js
  - database-url
related_components:
  - tooling
  - development_workflow
---

# Use @neondatabase/serverless with max: 1 on Vercel — not node-postgres

## Context

Next.js applications on Vercel run in a serverless execution model: each invocation spins up an isolated process, handles a request, then exits. Traditional `node-postgres` (`pg`) was designed for long-running server processes that maintain a persistent connection pool across many requests.

Using `pg.Pool` with `max: 10` in a Vercel deployment means each concurrent invocation creates up to 10 TCP connections. At 50 concurrent invocations, that is potentially 500 open connections against Neon's pool limit — silently exhausting it under load. The failure mode is non-obvious: queries begin timing out without any application-level error pointing to the root cause.

The project `motian` was found using this wrong configuration:

```typescript
// ❌ Wrong: pg.Pool with max: 10 in a serverless context
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";
const pool = new Pool({
  connectionString: url,
  max: 10,
  idleTimeoutMillis: 60_000, // meaningless: process exits before this fires
  connectionTimeoutMillis: 5_000,
});
```

A prior session (`session history`) evaluated Neon connection pooling + read replicas as a potential improvement but rejected it as "premature — no evidence of connection saturation yet." That evaluation was about per-surface routing complexity. The driver mismatch (using `pg` in serverless) is a separate concern and is always wrong regardless of load evidence.

## Guidance

Replace `pg` with `@neondatabase/serverless` and `drizzle-orm/node-postgres` with `drizzle-orm/neon-serverless`. Set `max: 1`.

**`packages/db/package.json`:**

```json
// Before
"dependencies": {
  "pg": "^8.20.0"
}

// After
"dependencies": {
  "@neondatabase/serverless": "^0.10.4"
}
```

**`packages/db/src/index.ts`:**

```typescript
// Before
import { drizzle as drizzlePg } from "drizzle-orm/node-postgres";
import { Pool } from "pg";

const pool = new Pool({
  connectionString: url,
  max: 10,
  idleTimeoutMillis: 60_000,
  connectionTimeoutMillis: 5_000,
});
return drizzlePg(pool);

// After
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

// max: 1 is correct for serverless — higher values multiply connections
// across concurrent invocations. Use Neon's pooler endpoint for multiplexing.
// Node.js 22 has native WebSocket — no ws package or neonConfig needed.
const pool = new Pool({
  connectionString: url,
  max: 1,
  connectionTimeoutMillis: 5_000,
});
return drizzle(pool);
```

**`drizzle.config.ts`** — migrations must target the direct (unpooled) endpoint:

```typescript
// Migrations must use the DIRECT (unpooled) Neon endpoint.
// PgBouncer transaction mode blocks DDL: SET, CREATE INDEX CONCURRENTLY,
// trigger creation, etc. Set DATABASE_URL_UNPOOLED in .env.local and Vercel.
url:
  process.env.DATABASE_URL_UNPOOLED ??
  process.env.DATABASE_URL ??
  (() => { throw new Error("DATABASE_URL is not set"); })(),
```

**Vercel environment variables** (set for production, preview, and development):

| Variable | Endpoint | Used by |
|---|---|---|
| `DATABASE_URL` | `-pooler.` hostname | App runtime queries |
| `DATABASE_URL_UNPOOLED` | Direct hostname (no `-pooler.`) | `drizzle-kit` migrations, DDL scripts |

Both can be found in the Neon dashboard → Project → Connection Details → toggle "Pooled connection".

## Why This Matters

`@neondatabase/serverless` uses WebSockets and is designed for open-per-request, close-per-request lifecycles. PgBouncer at the infrastructure level handles multiplexing across invocations. This combination keeps connection counts bounded regardless of concurrency.

Without it:
- Connection exhaustion degrades all users simultaneously, not just the overloaded invocation
- `idleTimeoutMillis` is a dead config option — the process exits before idle, wasting developer attention on tuning
- Migrations run through the pooler endpoint will silently fail on DDL statements that PgBouncer's transaction mode blocks

The `db.transaction()` API on `neon-serverless`'s Pool is identical to `pg.Pool` — services using transactions (`chat-sessions.ts`, `gdpr.ts`, `scraper-dashboard.ts`) required no changes beyond the import swap.

## When to Apply

- Any Drizzle + Neon application deployed to Vercel, Netlify, AWS Lambda, or any provider where functions are ephemeral
- If the deployment target is a persistent server (Docker container, VPS, long-running Node process), `pg.Pool` with a tuned `max` is appropriate — the distinguishing question is whether a single process handles many requests over its lifetime
- Always use `DATABASE_URL_UNPOOLED` for any migration tooling (drizzle-kit, Flyway, raw `psql`) when the runtime `DATABASE_URL` points to a PgBouncer pooler

## Examples

**Correct — serverless context:**

```typescript
import { Pool } from "@neondatabase/serverless";
import { drizzle } from "drizzle-orm/neon-serverless";

const pool = new Pool({
  connectionString: process.env.DATABASE_URL, // pooler endpoint
  max: 1,
  connectionTimeoutMillis: 5_000,
});

export const db = drizzle(pool);
```

**Migrations — always direct endpoint:**

```typescript
// drizzle.config.ts
dbCredentials: {
  url: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
},
```

**DDL scripts (`apply-search-indexes.ts`, etc.):**

```typescript
import { Pool } from "@neondatabase/serverless";
const pool = new Pool({
  connectionString: process.env.DATABASE_URL_UNPOOLED ?? process.env.DATABASE_URL,
});
```

## Related

- Neon docs: [Connection pooling](https://neon.tech/docs/connect/connection-pooling)
- Drizzle docs: [Neon Serverless adapter](https://orm.drizzle.team/docs/get-started-postgresql#neon)
- `packages/db/src/index.ts` — current implementation
- `drizzle.config.ts` — migration config with `DATABASE_URL_UNPOOLED`
