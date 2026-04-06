# Checklist voor projectoverdracht en ownership

> Deze Nederlandse checklist en `project-ownership-transfer-checklist.md` moeten functioneel equivalent blijven. Als een versie wijzigt, moet de andere in dezelfde wijziging mee worden bijgewerkt.

## 1. Metadata van de overdracht

- [ ] Overdrachtsdatum vastgelegd
- [ ] Huidige technische eigenaar vastgelegd
- [ ] Inkomende technische eigenaar vastgelegd
- [ ] Ondersteunende stakeholder of fallback-operator vastgelegd
- [ ] Scope bevestigd als volledige project ownership transfer

## 2. Voorbereiding

- [ ] `docs/architecture.md`, `docs/slo-and-observability.md`, `docs/autopilot-usage.md`, `docs/autopilot-configuration.md`, `docs/runbooks/platform-onboarding.md` en `docs/deployment-verification-summary.md` doorgenomen
- [ ] Bevestigd dat de nieuwe eigenaar de laatste versie van deze gids en checklist heeft
- [ ] Huidige providerinventaris in `.env.example` bekeken
- [ ] Repo-metadata voor Vercel-projectownership uit `.vercel/project.json` bevestigd
- [ ] Huidige open risico's en prioriteitsbeads vastgelegd:
  - [ ] `motian-n38` Modal scraping stub
  - [ ] `motian-scy` scoring is nog te rule-based
  - [ ] `motian-o5g` pagination-gap
  - [ ] `motian-uml` issue rond per-platform cron expression
- [ ] Eventuele extra overdrachtsrisico's zo nodig buiten de repo vastgelegd

## 3. Toegang migreren

- [ ] Nieuwe eigenaar heeft admin of gelijkwaardige toegang tot GitHub
- [ ] Nieuwe eigenaar heeft admin of gelijkwaardige toegang tot Vercel-project `motian`
- [ ] Nieuwe eigenaar heeft de vereiste Neon-projecttoegang
- [ ] Nieuwe eigenaar heeft de vereiste Trigger.dev-projecttoegang
- [ ] Nieuwe eigenaar heeft de vereiste Sentry-toegang
- [ ] Nieuwe eigenaar heeft de vereiste PostHog-toegang
- [ ] Nieuwe eigenaar heeft billing- en usage-zichtbaarheid voor OpenAI, Google AI en xAI
- [ ] Nieuwe eigenaar heeft toegang tot Browserbase als authenticated scraping daarvan afhangt
- [ ] Nieuwe eigenaar heeft toegang tot Modal als Vercel-veilige scraping daarvan afhangt
- [ ] Nieuwe eigenaar heeft toegang tot Firecrawl als public scraping daarvan afhangt
- [ ] Nieuwe eigenaar heeft toegang tot LiveKit als het voice-oppervlak actief is
- [ ] Nieuwe eigenaar heeft toegang tot Slack-integraties als notificaties aan staan
- [ ] Domein- of billing-ownership is beoordeeld waar relevant

## 4. Secrets en security

- [ ] Bron van waarheid voor secrets is zo nodig buiten de repo gedocumenteerd
- [ ] Nieuwe eigenaar weet hoe `.env.local` voor lokale development wordt gevuld
- [ ] Nieuwe eigenaar weet welke waarden via `vercel env pull .env.local` komen
- [ ] Nieuwe eigenaar weet dat Trigger.dev geselecteerde env vars uit `trigger.config.ts` synchroniseert
- [ ] Er zijn tijdens de overdracht geen secrets in repo-documentatie gekopieerd
- [ ] Te roteren high-risk secrets zijn gelijst
- [ ] Secret-rotatie is uitgevoerd of expliciet ingepland
- [ ] Plan voor verwijderen van toegang van de vorige eigenaar is vastgelegd

## 5. Operationele validatie

- [ ] Nieuwe eigenaar kan `pnpm lint` draaien
- [ ] Nieuwe eigenaar kan `pnpm test` draaien
- [ ] Nieuwe eigenaar kan `pnpm exec tsc --noEmit` draaien
- [ ] Nieuwe eigenaar kan `pnpm build` draaien
- [ ] Nieuwe eigenaar kan `pnpm harness:smoke` draaien
- [ ] Nieuwe eigenaar kan productie, preview en rollbackpad in Vercel aanwijzen
- [ ] Nieuwe eigenaar kan Trigger.dev-runs en schedules inspecteren
- [ ] Nieuwe eigenaar kan `/api/gezondheid` verifieren
- [ ] Nieuwe eigenaar kan minimaal een kernflow voor recruiters verifieren
  - [ ] `/vacatures`
  - [ ] `/kandidaten`
  - [ ] een van `/chat` of `/scraper`
- [ ] Nieuwe eigenaar heeft scraper/platform onboarding en failure triage doorgenomen
- [ ] Nieuwe eigenaar begrijpt het optionele Typesense-searchpad en het PostgreSQL-fallback-gedrag

## 6. Kennistransfersessie

- [ ] Architectuur-walkthrough afgerond
- [ ] Deployment- en rollback-walkthrough afgerond
- [ ] Verantwoordelijkheden rond database, retentie en GDPR doorgenomen
- [ ] Scraper- en platform-onboarding-risico's doorgenomen
- [ ] Verwachtingen rond monitoring en incidentrespons doorgenomen
- [ ] AI-provider-kosten en usage-oppervlakken doorgenomen
- [ ] Canonieke route- en taalconventies doorgenomen
  - [ ] Nederlandse UI-strings
  - [ ] Engelse code-variabelen
  - [ ] voorkeursroutes `/vacatures` en `/kandidaten`
  - [ ] Nederlandse API-paden zoals `/api/gezondheid`
- [ ] Huidige roadmap en belangrijkste open prioriteiten doorgenomen

## 7. Stabilisatie in de eerste week

- [ ] De zevendaagse stabilisatieperiode heeft een eigenaar
- [ ] Nieuwe eigenaar monitort Vercel, Trigger.dev en Sentry in de eerste week
- [ ] Nieuwe eigenaar valideert minimaal een deployment of rollback-veilige operationele wijziging
- [ ] Nieuwe eigenaar bevestigt in de eerste week doorlopende scraper health
- [ ] Nieuwe eigenaar bevestigt dat normale operatie niet meer afhankelijk is van de vorige eigenaar

## 8. Finale sign-off

- [ ] Nieuwe eigenaar bevestigt dat toegang voldoende is
- [ ] Nieuwe eigenaar bevestigt dat het systeem zonder vorige eigenaar beheerd kan worden
- [ ] Toegang van de vorige eigenaar is verwijderd of er is een verwijderdatum gepland
- [ ] Secret-rotatiestatus is vastgelegd
- [ ] Finale sign-off-datum is vastgelegd
- [ ] Definitieve verantwoordelijke persoon is vastgelegd
