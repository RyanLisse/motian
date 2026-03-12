# Baseline metrics (Fase 1)

Meetbare uitgangssituatie voor optimalisatie. Resultaten vastleggen in `baseline-YYYY-MM-DD.md` of als CI-artifact.

## hybridSearch benchmark

Reproduceerbare run (with `DATABASE_URL` set, e.g. from `.env.local`):

```bash
pnpm benchmark:hybrid-search
# or from repo root:
just benchmark-hybrid-search
```

The script writes a summary to `docs/metrics/hybrid-search-benchmark-latest.json`. Use this as a reference for regression after search changes. Optionally copy or rename to `hybrid-search-benchmark-YYYY-MM-DD.json` when recording a baseline. If the benchmark has not been run yet, this file will be created on first successful run.

## ESCO rollout snapshot

Reproduceerbare run (with `DATABASE_URL` set, e.g. from `.env.local`):

```bash
pnpm metrics:esco-rollout
```

The script writes a summary to `docs/metrics/esco-rollout-snapshot-latest.json`. It captures:

- recent `job_matches` model distribution
- guardrail fallback count from ESCO reasoning
- guardrail fallback rate across recent matches
- mapping confidence distribution, summary stats, and review backlog
- representative search latency snapshots (`p50` / `p95`)
- top-3 candidate snapshots per job for rollout comparison

Copy or rename this artifact to `esco-rollout-snapshot-YYYY-MM-DD.json` when recording a baseline or post-cutover checkpoint.

To compare a stored baseline against the latest snapshot and fail when any shared
scenario regresses more than 15% at `p95`:

```bash
pnpm metrics:esco-rollout:compare docs/metrics/esco-rollout-snapshot-YYYY-MM-DD.json
```

## Wat vastleggen

| Metric | Hoe |
|--------|-----|
| `pnpm build`-tijd | `just baseline-metrics` of `pnpm tsx scripts/baseline-metrics.ts` (lokaal) of CI build job duration |
| Cold start / p95 latency | App draaien; herhaalde requests naar `/api/chat` en `/api/cv-analyse`; p95 uit percentielen |
| DB-queryduur | Representatieve zoek- en matchqueries; logging of tracing (Sentry, PostHog) |
| Trigger job-duur | Per scraper/enrichment job in Trigger dashboard of job metadata |
| AI-kosten per flow | Bestaande trackers of logging (chat, CV-parse, enrichment, matching); zie AI-cost logging |

## Omgeving

Vermeld bij elke baseline: Node/pnpm versie, datasetgrootte (bijv. aantal jobs in DB), en datum.

## AI-cost logging

Plek in codebase voor kosten per flow:

- **Chat:** `app/api/chat/route.ts` — na `streamText` of in `after()`: token usage uit response metadata loggen.
- **CV-parse / enrichment:** `app/api/cv-analyse/route.ts` of relevante services — log usage per stap.
- **Embedding/matching:** `src/services/embedding.ts` en aanroepers — log embedding API usage.

Optioneel: structured logging (bijv. `logger.info({ flow: 'chat', inputTokens, outputTokens })`) zodat Fase 4 budgetten en SLO’s kunnen bouwen.
