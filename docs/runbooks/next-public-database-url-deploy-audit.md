# Deploy audit — `NEXT_PUBLIC_DATABASE_URL` must be absent

> **Security:** This runbook lists **environment variable names only**. Never paste secret **values** into chat, git, PRs, Linear, Slack, screenshots, or ticket comments.

**Purpose:** Confirm the Neon connection string stays **server-only** (`DATABASE_URL`) and is never exposed to the browser via a `NEXT_PUBLIC_*` name.

**Runtime guard (do not weaken):** `@motian/db` throws at first DB client use when `NEXT_PUBLIC_DATABASE_URL` is set. See `packages/db/src/index.ts` (`assertNoPublicDatabaseUrl`) and regression coverage in `tests/db-env-guard.test.ts`.

**Correct pattern:** Set **`DATABASE_URL`** on each deploy surface. Do **not** create `NEXT_PUBLIC_DATABASE_URL`.

---

## Surfaces to audit

| Surface | Project / scope | Where to check |
|---------|-----------------|----------------|
| **Vercel** | Project `motian` (`https://motian.vercel.app`) | Dashboard → Project Settings → Environment Variables, or `vercel env ls` |
| **Coolify** | Motian app (Docker / self-hosted) | Coolify → Motian service → Environment variables |
| **Trigger.dev** | Project `proj_nqihauooanbnqnbpoybp` | Dashboard → Project → Environment variables (deploy/runtime) |

`trigger.config.ts` `syncEnvVars` syncs **`DATABASE_URL`** and other task keys — **`NEXT_PUBLIC_DATABASE_URL` is not in that list** and must remain absent everywhere.

---

## Checklist (names only — all surfaces)

- [ ] **`NEXT_PUBLIC_DATABASE_URL` is absent** on Vercel Motian (Production, Preview, Development).
- [ ] **`NEXT_PUBLIC_DATABASE_URL` is absent** on Coolify Motian.
- [ ] **`NEXT_PUBLIC_DATABASE_URL` is absent** on Trigger.dev Motian.
- [ ] **`DATABASE_URL` is present** where the app or tasks need Postgres (server/task runtime only).
- [ ] No ticket, runbook edit, or PR includes connection string **values** — names and pass/fail only.
- [ ] If the name was found: **delete the variable** on that surface, redeploy, and re-run smoke below.

---

## Per-surface verification (no values)

### Vercel Motian

```bash
vercel link          # project: motian
vercel env ls        # confirm NEXT_PUBLIC_DATABASE_URL does NOT appear
```

Optional: diff names against [`docs/runbooks/vercel-env-inventory-rjc-420.md`](vercel-env-inventory-rjc-420.md) and [`docs/rjc-420-vercel-env-inventory.md`](../rjc-420-vercel-env-inventory.md).

### Coolify Motian

1. Open the Motian service → **Environment**.
2. Search the name list for `NEXT_PUBLIC_DATABASE_URL`.
3. **Pass:** name not listed. **Fail:** remove it, keep `DATABASE_URL`, redeploy the container.

See also [`docs/runbooks/coolify-dockerfile.md`](coolify-dockerfile.md) for required runtime env names (values set in Coolify UI only).

### Trigger.dev Motian

1. Open project **`proj_nqihauooanbnqnbpoybp`** → **Environment variables**.
2. Confirm **`NEXT_PUBLIC_DATABASE_URL` is not configured** for Production / Staging / Development.
3. Confirm **`DATABASE_URL` is configured** for task runtime (synced at deploy via `trigger.config.ts`).

Deploy hygiene: source `.env.local` before `pnpm dlx trigger.dev deploy` so only intended names sync — never add `NEXT_PUBLIC_DATABASE_URL` to the deploy shell.

---

## Post-audit smoke (after any env change)

1. Redeploy the affected surface (Vercel, Coolify, and/or Trigger.dev).
2. Hit health: `GET https://motian.vercel.app/api/gezondheid` (use Deployment Protection bypass if enabled).
3. If DB access fails with `NEXT_PUBLIC_DATABASE_URL is set…`, the guard fired — remove the public name and redeploy.

---

## Related

- [`docs/rjc-420-vercel-env-inventory.md`](../rjc-420-vercel-env-inventory.md) — RJC-420 matrix (`NEXT_PUBLIC_DATABASE_URL` marked forbidden)
- [`docs/runbooks/vercel-env-inventory-rjc-420.md`](vercel-env-inventory-rjc-420.md) — grouped Vercel name inventory
- `packages/db/src/index.ts` — `assertNoPublicDatabaseUrl` runtime guard
- `tests/db-env-guard.test.ts` — regression test for the guard
- [`docs/deployment-verification-summary.md`](../deployment-verification-summary.md) — broader deploy verification
