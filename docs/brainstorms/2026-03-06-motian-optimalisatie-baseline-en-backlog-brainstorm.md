---
date: 2026-03-06
topic: motian-optimalisatie-baseline-en-backlog
---

# Motian optimalisatie — baseline en backlog

## What we're building

Motian verkleinen van “alles-in-één-machinekamer” naar meetbare, onderhoudbare verbetering. Web-app, chat-agent, CV-pipeline, scrapers, ESCO, voice, WhatsApp, Trigger jobs en tooling delen nu dezelfde dependency surface en monolithische structuur. Het doel is gericht optimaliseren via een vaste volgorde: eerst baseline en quick wins, dan search/match en chat/CV, daarna structurele opsplitsing (workspace) en CI/infra-hygiëne — geen “verf op de muur” zonder meetbare uitgangssituatie.

## Why this approach

Eerst meten; dan de grootste winst (search/match) en chat/CV; daarna workspace en CI/infra. Zonder baseline weet je niet of refactors helpen of schaden. Search en match zijn het meest gebruikte pad en bieden de eerste echte snelheidswinst. Chat en CV zijn AI- en kostenintensief; optimalisatie daar verlaagt latency en kosten. Workspace-opsplitsing is waardevol voor onderhoud en ownership maar levert pas na de andere stappen maximale waarde. CI en infra-hygiëne verhogen betrouwbaarheid en voorkomen regressie.

## Key decisions

- **Uitvoerorde:** Fase 1 (baseline + CORS + coverage) → Fase 2 (jobs-split, tool slicing, CV-jobs) → Fase 3 (workspace) → Fase 4 (SLO’s, observability).
- **Drie hefboomen (eerst aanpakken):** (1) hybridSearch/match optimaliseren — minder DB-roundtrips, meer SQL-filtering, stabielere ranking; (2) CV-analyse naar async/job-pipeline — robuustere UX, minder timeouts, betere retry en observability; (3) repo naar workspace-packages — onderhoudbaarheid, duidelijkere grenzen, snellere builds op termijn.

## Concrete P0/P1/P2-backlog

Deze backlog staat alleen in dit document; er worden geen GitHub-issues aangemaakt.

### P0 – Blocker / must-have

- **Baseline metrics: build, API latency, DB, Trigger, AI-cost** — Vastleggen van meetbare uitgangssituatie: `pnpm build`-tijd, cold start / p95 latency voor `/api/chat` en `/api/cv-analyse`, DB-queryduur voor zoek- en matchflows, Trigger job-duur per scraper/enrichment, AI-kosten per flow. Zonder baseline is effect van latere refactors niet te beoordelen.

- **CORS: alle ALLOWED_ORIGINS ondersteunen** — Momenteel wordt alleen de eerste origin uit `ALLOWED_ORIGINS` gebruikt voor `Access-Control-Allow-Origin`. Ondersteun alle origins uit de allowlist (per request de request-origin vergelijken met de lijst en die ene waarde terugzetten; de CORS-spec staat maar één origin per response toe).

- **hybridSearch: benchmark 10/100/1000 jobs, minder roundtrips en in-memory filter** — Referentiebenchmark voor `hybridSearch(query, filters)` met 10, 100 en 1.000+ jobs (of beschikbare dataset). Daarna optimaliseren: minder DB-roundtrips, meer filtering in SQL, minder post-filtering in memory; direct merkbaar voor alle surfaces die zoeken.

### P1 – High

- **jobs.ts opsplitsen in repository, search, filters, stats** — Split van de ~507-regels service in minimaal `jobs.repository.ts`, `jobs.search.ts`, `jobs.filters.ts`, `jobs.stats.ts`. Verplaats zoveel mogelijk filtering naar SQL; vectorzoeking met gefilterde IDs direct uit de DB en daarna join om extra roundtrip te verminderen.

- **Chat: tool slicing per route, prompt-cache, history-samenvatting** — Per route/context niet alle kandidaat-, GDPR- en interviewtools injecteren; cache onderdelen van `buildSystemPrompt()` die niet per request veranderen; samenvattingslogica voor oudere chatgeschiedenis in plaats van alleen “laatste N berichten”. Verlaagt latency en AI-kosten.

- **CV-analyse: async job-pipeline met SSE status** — Knip de flow in afzonderlijke stappen/jobs: upload → parse → dedupe → enrich → match. SSE streamt alleen job-status; tussenresultaten expliciet in DB of job-state; retries idempotent per stap; cache/hash van CV-bestanden tegen dubbele AI-verwerking. Robuuster dan één lange sync-route met `maxDuration = 60`.

- **CI: coverage-gate en testprojecten (unit, component, integration)** — Vitest coverage aanzetten in de CI-workflow met optioneel minimum threshold. Overweeg splitsing in unit-, component- en integration-testprojecten voor snellere feedback en duidelijkere grenzen.

### P2 – Medium

- **Repo: pnpm workspace met apps/ en packages/** — Root wordt workspace met o.a. `apps/web`, `apps/voice-agent`, `packages/core-domain`, `packages/db`, `packages/ai`, `packages/scrapers`, `packages/esco`, `packages/ui`. Incrementele migratie; eerst packages die het minst gekoppeld zijn (db, esco, ai/scrapers).

- **Config: Sentry en overige config uit env/layers** — Sentry DSN niet hardcoded in `trigger.config.ts`; gevoelige config via environment of gecentraliseerde config-laag. Align met “geen secrets in repo”.

- **DB: pool-size evalueren voor Neon serverless** — Onderzoek of `max: 20` voor de pool op Neon serverless moet worden herzien (bijv. lager of connection pooler); documentatie en eventuele incidenten meenemen.

- **CI: Playwright smoke op elke PR; zware evidence conditioneel** — Playwright smoke-tests standaard op elke PR; zwaardere browser-evidence alleen bij high-risk of op verzoek, zodat CI snel blijft.

## Open questions

- **Coverage-thresholds:** Welk minimum (globaal of per package) is haalbaar en zinvol? Bijv. eerst alleen rapporteren, later optionele gate op 40%.
- **SLO-targets:** Concreet getal voor chat p95 (bijv. &lt; 4s) en voor CV-pipeline (bijv. &lt; 90s eind-tot-eind); te valideren met baseline-data.
- **Neon serverless:** Gebruik van connection pooler versus directe pool; impact op cold starts en max connections documenteren vóór wijziging.

## Next steps

Wanneer een concreet onderdeel wordt opgepakt (bijv. alleen “baseline metrics” of “jobs.ts splitsen”), gebruik **`/workflows:plan`** om een gedetailleerd implementatieplan voor dat onderdeel te maken. Het volledige uitvoerplan met fases en definition-of-done staat in `docs/plans/2026-03-06-motian-optimalisatie-baseline-en-uitvoer-plan.md`.
