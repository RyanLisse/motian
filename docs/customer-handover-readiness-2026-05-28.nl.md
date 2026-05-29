# Klant-handover readiness — bijgewerkt 29 mei 2026

Deze notitie is de actuele overdrachtssnapshot voor de klant. De structurele ownership-gidsen blijven:

- `docs/runbooks/project-ownership-transfer-guide.nl.md`
- `docs/runbooks/project-ownership-transfer-checklist.nl.md`
- `docs/deployment-verification-summary.md`

## Huidige staat

- **Branch:** `main`
- **Productie-app:** `https://motian.vercel.app`
- **Gezondheidscheck:** `GET /api/gezondheid`
- **Salesforce XML-feed:** `GET /api/salesforce-feed`
- **Trigger.dev project:** `proj_nqihauooanbnqnbpoybp`
- **Vercel project:** `motian`
- **Canonieke frontendroutes:** `/vacatures`, `/kandidaten`, `/chat`, `/scraper`, `/overzicht`

## Uitgevoerde voorbereiding

- Scraper pipeline-herstel is geland op `main` en blijft te monitoren via Trigger.dev en `scrape_results`.
- Lokale orchestration/runtimebestanden zijn uit Git gehaald of genegeerd: `.omx/`, `.omc/`, `.serena/`, root `dolt/`, Beads/Dolt runtime en lokale screenshots.
- Historische plans, brainstorms, reviews, demo artefacten en oude metrics snapshots zijn verwijderd om documentatiedrift te voorkomen.
- README's, architectuurdoc, ESCO runbook en deployment-verificatie zijn bijgewerkt naar de canonieke routes `/vacatures`, `/kandidaten` en `/api/gezondheid`.

## Validatie voor overdracht

Voor finale overdracht opnieuw uitvoeren:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm tsx scripts/harness/entropy-check.ts
SKIP_ENV_VALIDATION=1 pnpm build
```

Build-notitie: deze checkout bevat bewust geen `.env.local`. `pnpm build` faalt dan vroeg op verplichte env-validatie. Gebruik lokaal alleen `SKIP_ENV_VALIDATION=1 pnpm build` wanneer secrets bewust ontbreken; in Vercel/CI moeten echte hosted secrets aanwezig zijn.

## Deploy- en runtime-afspraken

### Vercel

Push naar `main` triggert de normale Vercel-productiedeploy. Controleer na deploy:

```bash
curl -fsS https://motian.vercel.app/api/gezondheid
curl -fsS "https://motian.vercel.app/api/salesforce-feed?entity=jobs&limit=5"
```

### Trigger.dev

Trigger.dev deployments staan los van de Next.js/Vercel deploy. Als Trigger-tasks gewijzigd zijn of scraper-fallbacks direct actief moeten worden in scheduled jobs:

```bash
set -a && source .env.local && set +a
pnpm dlx trigger.dev deploy
```

Kritieke deploy-time env vars voor Trigger.dev staan in `trigger.config.ts` en moeten aanwezig zijn:

- `DATABASE_URL`
- `BROWSERBASE_API_KEY`
- `BROWSERBASE_PROJECT_ID`
- `FIRECRAWL_API_KEY`

Aanbevolen na Trigger.dev deploy:

1. Start handmatig `scraper-health-check` of `scrape-pipeline` vanuit Trigger.dev.
2. Controleer dat geen platform vastzit op `circuit_breaker_open` zonder eigenaar.
3. Controleer dat `scrape_results` nieuwe succesvolle resultaten toont.
4. Monitor de eerstvolgende geplande run.

## Klant-overdracht checklist

Voor sign-off moet de nieuwe eigenaar minimaal bevestigen:

- [ ] GitHub-repo en branch protections toegankelijk.
- [ ] Vercel-project `motian` toegankelijk inclusief rollbackpad.
- [ ] Neon database toegankelijk inclusief backup/snapshot-proces.
- [ ] Trigger.dev project `proj_nqihauooanbnqnbpoybp` toegankelijk inclusief logs, schedules en deploys.
- [ ] Sentry en PostHog dashboards toegankelijk.
- [ ] Secrets-bron buiten de repo vastgelegd; geen echte secrets in documentatie.
- [ ] `.env.local` lokaal te vullen zonder vorige eigenaar.
- [ ] `/vacatures`, `/kandidaten`, `/chat` en `/scraper` productmatig getest.
- [ ] `/api/gezondheid` reageert succesvol in productie.
- [ ] Trigger.dev scraper-runs zijn recent gezond of hebben een expliciet incident-ticket.
- [ ] Eerste-week stabilisatie-eigenaar aangewezen voor Vercel, Trigger.dev en Sentry monitoring.

## Open risico's voor de nieuwe eigenaar

- `motian-n38`: Modal scraping stub; Striive blijft hoog risico op Vercel zonder afgeronde Modal-route.
- `motian-uml`: schedule observability/coverage verder aanscherpen.
- `motian-scy`: scoring is nog deels rule-based en heeft semantische/vectorverbetering nodig.
- `motian-o5g`: resterende pagination coverage afronden.
