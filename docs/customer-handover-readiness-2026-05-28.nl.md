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

Voor Striive zijn daarnaast `STRIIVE_USERNAME`, `STRIIVE_PASSWORD`, `MODAL_TOKEN_ID` en `MODAL_TOKEN_SECRET` nodig in de Trigger.dev-runtime. De code faalt nu expliciet wanneer Modal-credentials ontbreken, zodat een Striive-run niet stil als “lege import” kan doorlopen.

Aanbevolen na Trigger.dev deploy:

1. Start handmatig `scraper-health-check` of `scrape-pipeline` vanuit Trigger.dev.
2. Controleer dat geen platform vastzit op `circuit_breaker_open` zonder eigenaar.
3. Controleer dat `scrape_results` nieuwe succesvolle resultaten toont.
4. Monitor de eerstvolgende geplande run.

## Snelle setup voor klant: platforms, credentials en links

Sla echte secrets nooit in Git of docs op. Gebruik Vercel Environment Variables voor de Next.js-app en Trigger.dev environment variables/sync voor scheduled tasks. Lokale developers vullen `.env.local` via de gekozen secret source of truth.

### Provider- en infrastructuurtoegang

| Domein | Nodig voor | Credentials/toegang die de klant moet hebben | Waar instellen of controleren | Docs/link |
| --- | --- | --- | --- | --- |
| GitHub | Broncode, issues, PR's en deploy-trigger naar Vercel | Admin/maintainer op `RyanLisse/motian` | `https://github.com/RyanLisse/motian/settings/access` | GitHub repo: `https://github.com/RyanLisse/motian` |
| Vercel | Productie-app, API routes, previews, Blob storage en rollback | Project admin op project `motian`; env-beheer voor Production/Preview/Development | `https://vercel.com/dashboard` → project `motian` | Dashboard/docs: `https://vercel.com/docs/projects/project-dashboard`, env docs: `https://vercel.com/docs/projects/environment-variables`, rollback: `https://vercel.com/docs/cli/rollback` |
| Neon PostgreSQL | Primaire database + pgvector | Projecttoegang; pooled `DATABASE_URL`; unpooled/migratie-URL waar nodig | Neon console → Connection Details | `https://neon.com/docs/connect/connection-pooling` |
| Trigger.dev | Scrape pipeline, scheduled jobs, CV/embedding/autopilot background tasks | Projecttoegang tot `proj_nqihauooanbnqnbpoybp`, runs, schedules, env vars en deploys | `https://cloud.trigger.dev` → project `proj_nqihauooanbnqnbpoybp` | Env docs: `https://trigger.dev/docs/deploy-environment-variables` |
| Modal | Vercel-veilige Striive browser sandbox | Workspace/account token: `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` | Modal dashboard / CLI token | Token docs: `https://modal.com/docs/reference/cli/token`, config docs: `https://modal.com/docs/reference/modal.config` |
| OpenRouter | AI chat, enrichment, structured outputs en embeddings via één providergateway | `OPENROUTER_API_KEY`, billing/usage-toegang | OpenRouter keys/settings | `https://openrouter.ai/docs/api-keys` |
| Sentry | Runtime errors, Trigger task errors, sourcemaps | `SENTRY_DSN`; optioneel `SENTRY_AUTH_TOKEN`, org/project voor sourcemaps | Sentry project settings | `https://docs.sentry.io/platforms/javascript/guides/nextjs/` |
| PostHog | Productanalytics | `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` en projecttoegang | PostHog project settings | `https://posthog.com/docs/libraries/next-js` |
| Slack | Operationele scrape-alerts | `SLACK_BOT_TOKEN`, `SLACK_CHANNEL_ID` indien alerts actief zijn | Slack app config + workspace kanaal | `https://api.slack.com/apps` |
| LiveKit | Voice-agent, indien ingeschakeld | `LIVEKIT_URL`, `LIVEKIT_API_KEY`, `LIVEKIT_API_SECRET`, `NEXT_PUBLIC_LIVEKIT_URL` | LiveKit Cloud project | `https://docs.livekit.io/home/cloud/` |
| Browserbase | Browser fallback voor scraping/autopilot flows | `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` | Browserbase dashboard | `https://docs.browserbase.com/` |
| Firecrawl | Public-web fallback/extraction | `FIRECRAWL_API_KEY` | Firecrawl dashboard | `https://docs.firecrawl.dev/` |
| Vercel Blob | CV-bestanden en evidence artifacts | Vercel projecttoegang; `BLOB_READ_WRITE_TOKEN` wanneer buiten Vercel nodig | Vercel Storage/Blob | `https://vercel.com/docs/storage/vercel-blob` |

### Environment checklist

| Variabele/familie | Waar nodig | Status | Opmerking |
| --- | --- | --- | --- |
| `DATABASE_URL` | Vercel + Trigger.dev + lokaal | Verplicht | Gebruik de pooled Neon URL voor serverless runtime; unpooled alleen voor migraties/schema push. |
| `DATABASE_URL_UNPOOLED` | Lokaal/CI migraties | Aanbevolen | Nodig voor `pnpm db:push`/Drizzle workflows wanneer direct DB nodig is. |
| `ENCRYPTION_SECRET` | Vercel + lokaal | Verplicht voor encrypted auth/config | Canonical in `src/env.ts`; hernoem legacy `ENCRYPTION_KEY` indien aanwezig. Waarde moet stabiel blijven voor decryptie van bestaande scraper auth-config. |
| `API_SECRET`, `ALLOWED_ORIGINS` | Vercel | Verplicht voor productie-API hardening | Cross-origin API routes falen gesloten wanneer dit ontbreekt. |
| `OPENROUTER_API_KEY` | Vercel + Trigger.dev | Verplicht voor AI-functies | App gebruikt OpenRouter als app-side providergateway. |
| `STRIIVE_USERNAME`, `STRIIVE_PASSWORD` | Trigger.dev runtime | Verplicht als Striive actief is | Supplier portal account; huidige integratie leest vacatures/opdrachten, schrijft niet terug naar Striive. |
| `MODAL_TOKEN_ID`, `MODAL_TOKEN_SECRET` | Trigger.dev runtime | Verplicht als Striive actief is | Zonder deze waarden faalt Striive nu vroeg met een duidelijke fout. |
| `BROWSERBASE_API_KEY`, `BROWSERBASE_PROJECT_ID` | Trigger.dev deploy/runtime | Verplicht volgens `trigger.config.ts` | Nodig voor browser/geautomatiseerde fallbackpaden. |
| `FIRECRAWL_API_KEY` | Trigger.dev deploy/runtime | Verplicht volgens `trigger.config.ts` | Wordt gesynct naar Trigger.dev. |
| `SENTRY_DSN`, `SENTRY_AUTH_TOKEN`, `SENTRY_ORG`, `SENTRY_PROJECT` | Vercel + Trigger.dev | Aanbevolen | DSN voor runtime events; auth/org/project voor sourcemaps/releases. |
| `NEXT_PUBLIC_POSTHOG_KEY`, `NEXT_PUBLIC_POSTHOG_HOST` | Vercel | Aanbevolen | Alleen public client vars met `NEXT_PUBLIC_` prefix. |
| `LIVEKIT_*` | Vercel + voice-agent runtime | Alleen nodig voor voice | Voice UI valt terug naar tekst als LiveKit niet volledig geconfigureerd is. |
| `SLACK_*` | Trigger.dev/Vercel | Optioneel maar operationeel gewenst | Scrape-alerting werkt alleen als Slack app/kanaal kloppen. |

### Scraperplatforms en activeringsinstructies

| Platformslug | Bronpagina/docs | Auth/credentials | Runtime dependency | Activeren/testen | Belangrijkste risico |
| --- | --- | --- | --- | --- | --- |
| `striive` | Login: `https://login.striive.com`; supplier portal: `https://supplier.striive.com/jobrequests/list`; repo-onderzoek: `docs/research/striive-write-api.md` | `STRIIVE_USERNAME`, `STRIIVE_PASSWORD` plus Modal token | Modal sandbox met Playwright; Trigger.dev env sync | In `/scraper`: platform actief zetten → `test-import` met limit 1 → daarna `scrape-pipeline` handmatig starten in Trigger.dev | Accountrol is supplier/inbox; geen write-permissions. Modal credentials ontbreken = expliciete runtime failure. |
| `flextender` | `https://www.flextender.nl/opdrachten/` | Geen | Direct HTTP/HTML adapter | Activeer config met default baseUrl en draai smoke import | HTML/widget markup kan wijzigen. |
| `opdrachtoverheid` | `https://www.opdrachtoverheid.nl/` | Geen | Publieke JSON API | Activeer config en draai smoke import; adapter ondersteunt pagination/maxPages | API-contract/velden kunnen wijzigen. |
| `nationalevacaturebank` | `https://www.nationalevacaturebank.nl/vacatures/branche/ict` | Geen login; consent bootstrap-config | Browser/bootstrap + HTTP harvest; mogelijk Browserbase nodig bij blokkades | Start met lage `maxPages`/`detailLimit`, check consent/captcha blocker in `/scraper` | DPG consent/anti-bot kan imports blokkeren. |
| `werkzoeken` | `https://www.werkzoeken.nl/vacatures-voor/techniek/`; publisher docs: `https://www.werkzoeken.nl/doc/` | Geen voor scrape; publisher API-key alleen voor eventuele write/publisher flow | Direct HTML + Firecrawl fallback | Smoke import met beperkte `maxPages`; monitor zero-listing silent-failure alerts | Zeer diepe pagination; parserdrift geeft lege imports. |
| `mipublic` | `https://mipublic.nl/vacature-sitemap.xml` | Geen | Sitemap + detail HTML/JSON-LD | Smoke import; controleer sitemap child URLs en detail extraction | Sitemap/detailpagina's kunnen anti-bot of lege JobPosting data geven. |
| `starapple-nl` | `https://www.starapple.nl/vacancy-sitemap.xml` | Geen | Sitemap + HTML detail extraction | Smoke import; controleer dat detailpagina's vacaturetitels hebben | Sitemap of HTML-structuur kan wijzigen. |
| `monsterboard` | `https://www.monsterboard.nl/vacatures/` | Geen | Public job board HTML/JSON-LD | Smoke import; let op blockerKind/evidence bij anti-bot | Anti-bot of consentpagina's kunnen scraping blokkeren. |

### Eerste productiecheck na credentialoverdracht

1. Vul Vercel Production/Preview env vars en Trigger.dev env vars/sync in; kopieer geen secrets naar docs.
2. Deploy app via merge/push naar `main`; deploy Trigger.dev apart met `pnpm dlx trigger.dev deploy` wanneer `trigger/` of `trigger.config.ts` is gewijzigd.
3. Controleer `https://motian.vercel.app/api/gezondheid` en `https://motian.vercel.app/scraper`.
4. Run in Trigger.dev handmatig `scrape-pipeline` of `scraper-health-check`.
5. Open `/scraper`, controleer per platform: laatste status, `jobsFound`, `consecutiveFailures`, schedule/next run en eventuele `blockerKind`.
6. Voor Striive specifiek: eerst `test-import` met limit 1; verwacht bij ontbrekende Modal-token een duidelijke fout over `MODAL_TOKEN_ID`/`MODAL_TOKEN_SECRET`, niet een stille lege import.
7. Leg de eerste gezonde run per platform vast in de klantchecklist.

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

- Striive is codematig Vercel-veilig gemaakt via Modal guardrails en bounded smoke-imports, maar live productieherstel blijft afhankelijk van klanttoegang tot `STRIIVE_*` en `MODAL_*` secrets.
- Schedule-observability is aangescherpt in de Trigger-resultaten; de klant moet na credentialoverdracht nog minimaal één echte scheduled run per actief platform bevestigen.
- Semantische/vector scoring is robuuster gemaakt voor embeddings; de klant moet blijven monitoren dat kandidaat- en vacature-embeddings gevuld blijven.
- Resterende pagination coverage is uitgebreid voor scraperconfiguraties en skill-filter endpoints; nieuwe lijst-endpoints moeten dit patroon blijven volgen.
