---
name: verify-motian
description: Drive the Motian recruiter web app locally, prove a user-facing feature with browser evidence, and tear down only the instance this skill started. Use when verifying Overzicht, Vacatures, Kandidaten, Pipeline, or Chat against a real Next.js process.
---

# Verify Motian

Motian is a Dutch recruiter operations web app (Next.js 16 App Router). The primary surface is the authenticated-looking but login-less UI. Pages are not gated. Browser product traffic hits data through server-rendered pages and the BFF; raw `/api/*` writes need `Authorization: Bearer $API_SECRET` when that secret is set.

Secondary surfaces exist and are **out of scope** for this skill unless a feature file says otherwise: `pnpm mcp` (stdio MCP), `pnpm cli`, `pnpm voice-agent:dev` (LiveKit). Do not start them for a web proof.

There is **no disposable database**. `DATABASE_URL` in `.env.local` is a shared Neon Postgres. Two Next processes share the same rows. Port isolation only protects the user's `:3002` session, not the data. Default to **read-only** recipes. Do not scrape, create candidates, send chat, or mutate pipeline unless the user explicitly authorizes writes against this database.

Never drive `http://localhost:3002` or any listener you did not start with `bin/launch.sh`.

## Launch

From the Motian repo root:

```bash
.cursor/skills/verify-motian/bin/launch.sh
```

If the Next process dies the moment that helper returns (common in agent sandboxes that reap the process group), start it in the runner's background and keep that job alive:

```bash
MOTIAN_VERIFY_FOREGROUND=1 .cursor/skills/verify-motian/bin/launch.sh
```

Wait until `/api/gezondheid` answers, then run doctor from a second shell. Do not treat a sandbox-reaped nohup as a product failure.

What it does:

- Requires `.env.local` with a real `DATABASE_URL`. If missing: `vercel env pull .env.local` or copy `.env.example` and fill secrets. Do not invent a URL.
- Requires `node_modules` (`pnpm install --frozen-lockfile`).
- Starts `HOSTNAME=127.0.0.1 PORT=3012 pnpm dev` under `nohup` (override with `MOTIAN_VERIFY_HOST` / `MOTIAN_VERIFY_PORT`).
- Refuses port `3002`.
- Writes `.cursor/skills/verify-motian/state/instance.json` (`pid` + `listenPid`) and logs to `state/next-dev.log`.
- Ready when `GET /api/gezondheid` returns 2xx JSON.

Teardown: `.cursor/skills/verify-motian/bin/cleanup.sh` (kills only the recorded pid; keeps evidence).

If launch fails, run cleanup before retrying so ports and `instance.json` are not stranded.

## Doctor

Run this first whenever anything looks off:

```bash
.cursor/skills/verify-motian/bin/doctor.sh
```

Pass means: `instance.json` exists, the recorded pid is alive, that pid (or its child) owns the verify port, `/api/gezondheid` returns `{ overall: "gezond"|"waarschuwing"|"kritiek" }`, and `/overzicht` HTML contains `Motian` and `Overzicht`.

`overall: waarschuwing` or `kritiek` is still driveable for UI proofs if pages render. A failed curl or missing `instance.json` is not. If doctor fails, stop — do not fall back to the user's `:3002` app.

## Drive

Read `features/README.md`, then the feature file. Start from `/overzicht` unless the file says otherwise.

Harness, in order:

1. **This skill's Playwright helper** (preferred when Chromium can launch; `playwright` is a repo dependency). If Chromium is missing: `pnpm exec playwright install chromium`. If `capture.mjs` dies with `Target crashed`, do not treat that as an app bug — fall through to (2) and still write `meta.json` + `body.txt` + HTML under `evidence/<runId>/`.

   ```bash
   node .cursor/skills/verify-motian/bin/capture.mjs \
     --path /kandidaten \
     --name kandidaten-list \
     --expect-text "Kandidaten"
   ```

   Optional interaction flags: `--fill-selector`, `--fill-value`, `--click-selector`, `--wait-ms`.

2. **Cursor browser / CDP tools** against `baseUrl` from `instance.json` only. Prefer roles and accessible names over coordinates.

3. **HTTP** for public GET checks (`/api/gezondheid`, `GET /api/vacatures/zoeken`). Do not treat Vitest or `pnpm harness:browser-evidence` as a substitute for the mapped user path. The repo harness screenshots `:3002` by default — ignore it here.

Stable handles from this repo (Dutch copy):

| Surface | Route | What to wait for |
| --- | --- | --- |
| Shell nav | all pages | links named `Overzicht`, `Vacatures`, `Kandidaten`, `Pipeline`, `Chat` |
| Overzicht | `/overzicht` | heading `Overzicht`; cards `Pipeline waar je op stuurt`, `Nieuwe vacatures om op te volgen` |
| Vacatures | `/vacatures` | heading `Start je zoektocht`; textbox `Zoek vacature`; placeholder `Zoek vacature...` |
| Vacature detail | `/vacatures/<id>` | job title as heading; compact list still visible |
| Kandidaten | `/kandidaten` | heading `Kandidaten`; searchbox placeholder `Zoek op naam...`; button `Zoeken`; button `Kandidaat toevoegen` |
| Pipeline | `/pipeline` | heading `Pipeline`; links `Kanban` and `Lijst`; columns/labels `Nieuw`, `Screening` |
| Chat | `/chat` | heading `Motian AI`; textbox `Bericht aan Motian AI`; empty title `Waar wil je vandaag op sturen?` |

Vacature search is debounced **300ms** and updates the list without a submit button. Kandidaten search is a GET form (`q`, `beschikbaarheid`, `vaardigheid`).

Do **not** click `Kandidaat toevoegen`, Databronnen scrape actions, or Chat send during a default proof.

## Evidence

Root: `.cursor/skills/verify-motian/evidence/<runId>/` (`runId` is in `instance.json`). Cleanup must not delete this tree.

Proof standards:

- Exercise the real recruiter path in the launched browser, not internal setters or Vitest.
- Capture the action **and** the resulting state (before/after or URL + body dump). A single pretty screenshot of a settled page is not enough when the recipe includes a search or navigation.
- Side effects: for read-only features, prove the list/count/detail from the UI and, where the map says so, from `GET /api/vacatures/zoeken`. For mutations (only if authorized), prove the second view (re-open the record) and then remove the `verify-motian-` fixture.
- Record `runId`, feature id, and entry point in the artifact folder name (`--name`).
- `meta.json` + `body.txt` + `*.png` from `capture.mjs` are the minimum UI proof. Include the `curl` stdout for API checks.

Mocks: none on the product path. Missing `OPENROUTER_API_KEY` makes Chat send fail — that is a real skip, not a pass. Missing `DATABASE_URL` is a launch failure.

## Cleanup

```bash
.cursor/skills/verify-motian/bin/cleanup.sh
```

Kills only the pid in `instance.json` (and leftover listeners that are that pid or its children on the verify port). Never `pkill -f next` / `pkill -f node`. Does not delete `evidence/`. After cleanup, confirm the proof folder still exists.

## Helpers

All executable from the repo root:

| Command | Role |
| --- | --- |
| `.cursor/skills/verify-motian/bin/launch.sh` | Start isolated `pnpm dev` on `:3012` |
| `.cursor/skills/verify-motian/bin/doctor.sh` | Read-only health / ownership check |
| `node .cursor/skills/verify-motian/bin/capture.mjs --path <route> --name <slug> --expect-text <str>` | Drive + screenshot + body dump |
| `.cursor/skills/verify-motian/bin/cleanup.sh` | Stop this instance; keep evidence |

`bin/common.sh` is sourced by the shell helpers; do not invoke it directly.
