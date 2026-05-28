# Klant-handover readiness — 28 mei 2026

Deze notitie is de actuele overdrachtssnapshot voor de klant. De structurele ownership-gidsen blijven:

- `docs/runbooks/project-ownership-transfer-guide.nl.md`
- `docs/runbooks/project-ownership-transfer-checklist.nl.md`

## Huidige staat

- **Branch:** `main`
- **Laatste gecontroleerde commit:** `a56b93a9` (`chore: update workspace metadata`)
- **Productie-app:** `https://motian.vercel.app`
- **Gezondheidscheck:** `GET /api/gezondheid`
- **Salesforce XML-feed:** `GET /api/salesforce-feed`
- **Trigger.dev project:** `proj_nqihauooanbnqnbpoybp`
- **Vercel project:** `motian` (`.vercel/project.json`)

## Uitgevoerde technische voorbereiding

- Scraper pipeline-herstel is geland op `main`:
  - Werkzoeken gebruikt nu bij retrybare failures of lege HTML-resultaten een Browserbase/Firecrawl render-fallbackketen.
  - Flextender laat `positionsAvailable` weg wanneer de bronwaarde `0` of ongeldig is, zodat normalisatie niet meer faalt op de positieve integer-validatie.
- Lokale orchestration-runtimebestanden (`.omx/`, `.omc/`) zijn uit de Git-index gehaald. Ze blijven lokaal genegeerd via `.gitignore` en horen niet in klant-handover/bronbeheer.
- Stale documentatieverwijzingen naar `/api/health` zijn vervangen door de canonieke Nederlandse route `/api/gezondheid`.
- Repo-worktrees zijn opgeschoond. Twee worktrees zijn bewust behouden omdat daar nog niet-geïntegreerd of lokaal gewijzigd werk staat:
  - `/Users/cortex-air/.codex/worktrees/2a64/motian` (`codex/sidebar-menu-direct-nav`)
  - `/Users/cortex-air/.cursor/worktrees/motian/scraper-pages-loading-dxp` (`fix/scraper-pages-loading-dxp`)

## Validatiebewijs

Laatst succesvol uitgevoerd tijdens deze voorbereiding:

```bash
pnpm exec biome check packages/scrapers/src/werkzoeken.ts packages/scrapers/src/flextender.ts tests/werkzoeken-scraper.test.ts tests/flextender-hours.test.ts
pnpm vitest run tests/werkzoeken-scraper.test.ts tests/flextender-hours.test.ts
pnpm lint
pnpm exec tsc --noEmit
pnpm test
```

Voor finale overdracht opnieuw uitvoeren:

```bash
pnpm lint
pnpm exec tsc --noEmit
pnpm test
pnpm build
SKIP_ENV_VALIDATION=1 pnpm build  # alleen als lokale secrets bewust ontbreken
```

Build-notitie: deze checkout bevat bewust geen `.env.local`. `pnpm build` faalt dan vroeg op de verplichte `DATABASE_URL` env-validatie. De overdrachtsbuild is daarom lokaal aanvullend met `SKIP_ENV_VALIDATION=1 pnpm build` gevalideerd; in Vercel/CI moet de echte `DATABASE_URL` uit de hosted secrets komen.

Bekende nuance: `pnpm harness:entropy`/`pnpm tsx scripts/harness/entropy-check.ts` faalt nog op bestaande baseline-issues rond unused exports, ontbrekende servicetests en stale plans. Dit is geen regressie van de scraper-handoverfix, maar wel een open kwaliteitsitem voor de nieuwe eigenaar.

## Deploy- en runtime-afspraken

### Vercel

- Push naar `main` triggert de normale Vercel-productiedeploy.
- Controleer na deploy:

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
2. Controleer dat Werkzoeken niet meer vastzit op `circuit_breaker_open`.
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
- Entropy baseline is nog niet groen; plan aparte cleanup-sprint in.
