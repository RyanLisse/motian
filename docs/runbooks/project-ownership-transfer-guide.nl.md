# Gids voor projectoverdracht en ownership

> Deze Nederlandse gids en `project-ownership-transfer-guide.md` moeten functioneel equivalent blijven. Als een versie wijzigt, moet de andere in dezelfde wijziging mee worden bijgewerkt.

## 1. Samenvatting van het project

### Wat Motian doet

Motian is een AI-assisted recruitment operations platform voor de Nederlandse publieke arbeidsmarkt. Het verzamelt vacatures van meerdere platforms, normaliseert en verrijkt die data, genereert embeddings en ondersteunt recruiter-workflows voor kandidaatintake, matching, berichten, interviews en rapportage.

### Voor wie het bedoeld is

- Recruiters en staffing-operators in de Nederlandse markt
- Interne operators die scraping, matching en candidate workflows beheren
- AI-oppervlakken die dezelfde service-laag gebruiken: chat, MCP, CLI en voice

### Bedrijfskritische stromen

- Vacature-ingestie vanaf externe platforms naar de gedeelde jobs-dataset
- Kandidaatintake en CV-analyse
- Hybride search over vacatures en kandidaten
- AI-assisted matching en recruiter review
- Geplande cleanup-, retentie- en scraper-health-jobs
- Operationele zichtbaarheid via Vercel, Trigger.dev, Sentry en PostHog

### Hoe gezonde operatie eruitziet

- De app laadt en de belangrijkste routes zijn bereikbaar: `/vacatures`, `/kandidaten`, `/chat`, `/scraper`
- `/api/gezondheid` reageert succesvol
- Trigger.dev scheduled tasks zijn zichtbaar en recente runs zijn gezond
- Scrapers importeren nieuwe jobs en circuit breakers blijven niet vast open staan
- Search blijft responsief en fallback-gedrag is bekend als Typesense uit staat
- Sentry ontvangt fouten en Vercel-deployments kunnen snel worden teruggedraaid

## 2. Systeemkaart

| Onderdeel | Wat het doet | Belangrijke referenties |
| --- | --- | --- |
| Next.js app | Hoofdproduct-UI en API-routes | `README.md`, `docs/architecture.md` |
| Neon PostgreSQL | Bron van waarheid voor jobs, kandidaten, matches, sollicitaties, interviews, berichten, scraperconfiguratie, scrape-resultaten en GDPR-audit | `src/db/schema.ts`, `src/db/index.ts`, `docs/architecture.md` |
| Scrapers | Halen data op uit Striive, Flextender en Opdrachtoverheid | `src/services/scrapers/`, `docs/architecture.md`, `docs/runbooks/platform-onboarding.md` |
| Trigger.dev | Scheduled jobs voor scrape-orchestratie, embeddings, retentie, health checks en stale cleanup | `trigger/`, `trigger.config.ts`, `docs/architecture.md` |
| AI chat / MCP / CLI / voice | Meerdere agent-oppervlakken bovenop dezelfde domeinservices | `src/ai/`, `src/mcp/`, `src/voice-agent/`, `src/cli/`, `docs/architecture.md` |
| Typesense (optioneel) | Externe search-versneller voor jobs en kandidaten, terwijl PostgreSQL bron van waarheid blijft | `README.md`, `.env.example` |
| Salesforce feed | Read-only XML-export voor Salesforce pull-integraties | `app/api/salesforce-feed/route.ts`, `src/services/salesforce-feed.ts`, `docs/architecture.md` |
| Autopilot | Browser-based audit evidence en operationele validatietooling | `docs/autopilot-usage.md`, `docs/autopilot-configuration.md` |

## 3. Ownership-domeinen

### 3.1 Applicatie en runtime

De eigenaar is verantwoordelijk voor de gezondheid van de hoofdapp, de API-routes en de gedeelde service-laag achter alle agent-oppervlakken.

- Houd frontend route-conventies stabiel: Nederlandse UI-labels, Engelse code-variabelen, Nederlandse API-paden
- Ken de canonieke user-facing routes: `/vacatures` en `/kandidaten`
- Gebruik `pnpm dev`, `pnpm build`, `pnpm lint`, `pnpm test` en `pnpm exec tsc --noEmit` als basisvalidatie
- Behandel `docs/architecture.md` als de snelste high-level kaart van het draaiende systeem

### 3.2 Deployments en rollback

Productie draait op Vercel.

- Vercel-projectnaam: `motian`
- Vercel-projectmetadata staat momenteel in `.vercel/project.json`
  - `projectId`: `prj_hxmxjdF2WhabGU4qc29KOCR4Y4g6`
  - `orgId`: `team_ouqYH7cF2UfVWN6dDhryMSEM`
- Gebruik `docs/deployment-verification-summary.md` als hoofdreferentie voor deploy- en rollback-denken
- Rollbackverwachting: snelle Vercel promote/rollback met minimale operationele vertraging
- De nieuwe eigenaar moet productie, preview en de vorige goede deployment zelfstandig kunnen aanwijzen

### 3.3 Database en dataretentie

Neon PostgreSQL is de bron van waarheid.

- Bekijk de schema-opzet in `src/db/schema.ts`
- Begrijp soft-delete- en retentiegedrag voordat datamutaties worden gedaan
- Retentie en cleanup horen bij project ownership en zijn geen bijzaak
- GDPR- en auditverwachtingen horen bij normale operatie, vooral rond kandidaten en retention cleanup

### 3.4 Scraping operations en platform onboarding

Scraping is centraal voor productwaarde en een van de risicovolste ownership-domeinen.

- Bestaande platforms zijn onder andere Striive, Flextender en Opdrachtoverheid
- Gebruik `docs/runbooks/platform-onboarding.md` voor de gedeelde onboardingflow en recovery states
- Behandel scraper failures, consent walls, auth drift, anti-bot-wijzigingen en lege imports als operationele incidenten
- Activatie is pas klaar als een platform een succesvolle run heeft en toekomstige schedules gezond blijven
- Modal, Browserbase, Firecrawl en platformcredentials horen allemaal bij het ownership-oppervlak

### 3.5 Monitoring en incidentrespons

De eigenaar is verantwoordelijk voor zowel user-visible betrouwbaarheid als operator-zichtbaarheid.

- SLO- en observability-richtlijnen staan in `docs/slo-and-observability.md`
- Sentry is het belangrijkste oppervlak voor fouten en releases
- PostHog dekt productanalytics
- Vercel dekt deployment-, runtime- en Speed Insights-zichtbaarheid
- Trigger.dev dekt scheduled task execution en failures
- Incidenten moeten worden getriageerd met logs, recente deployments, task-runs en providerstatus in samenhang

### 3.6 Vendors en accounts

De eigenaar moet niet alleen weten welke providers bestaan, maar ook welke providers nodig zijn voor normale operatie versus optionele versnelling.

- Verplichte kernproviders: GitHub, Vercel, Neon, Trigger.dev
- Verplichte AI/runtime-providers voor de volledige feature-set: OpenAI, Google AI, xAI
- Optionele of situationele providers: Anthropic, Typesense, Browserbase, Modal, Firecrawl, LiveKit, LangSmith, Slack, PostHog, Sentry
- Billing-zichtbaarheid hoort bij ownership, vooral voor AI-provider-kosten en usage-pieken

### 3.7 Security en secrets

Secrets mogen niet in repo-documentatie worden gekopieerd.

- Gebruik `.env.example` als inventaris van secret-families, niet als bron van waarheid voor echte waarden
- Huidige repo-richtlijnen impliceren dat lokale development `.env.local` gebruikt
- Opmerkingen in `.env.example` laten zien dat sommige lokale waarden uit Vercel worden ververst via `vercel env pull .env.local`
- Trigger.dev synchroniseert ook geselecteerde env vars vanuit `trigger.config.ts`
- Leg de echte secret source of truth tijdens de overdracht buiten de repo vast als dat nodig is
- Roteer waar praktisch mogelijk risicovolle secrets na de overdracht, vooral provider-tokens met schrijfrechten

## 4. Operationele commando's

| Commando | Doel | Wanneer de eigenaar het moet gebruiken |
| --- | --- | --- |
| `pnpm dev` | De hoofdapp lokaal draaien | Lokale debugging en productrondgang |
| `pnpm lint` | Biome lint check | Voor commits en na wijzigingen |
| `pnpm test` | Vitest-suite | Basis regressiecheck |
| `pnpm build` | Productie-buildvalidatie | Voor het shippen van risicovolle wijzigingen |
| `pnpm exec tsc --noEmit` | TypeScript-validatie | Voor merge en tijdens overdrachtsvalidatie |
| `pnpm harness:pre-pr` | Gecombineerde lint, typecheck, test en risk gate | Pre-PR kwaliteitscheck |
| `pnpm harness:smoke` | Smoke-level harness-validatie | Checks in de eerste week van ownership |
| `pnpm harness:entropy` | Entropy- en cleanup-check | Kwaliteitscontrole voor afronding van de overdracht |
| `pnpm mcp` | De MCP-server draaien | Agent-integraties valideren |
| `pnpm cli` | De CLI-agent draaien | Operationele parity valideren |
| `pnpm voice-agent:dev` | De voice agent in development draaien | Voice-oppervlak valideren wanneer ingeschakeld |

## 5. Toegangs- en leveranciersinventaris

| Provider | Waarom deze bestaat | Toegang die de nieuwe eigenaar moet hebben | Waar te verifieren |
| --- | --- | --- | --- |
| GitHub | Broncodebeheer, PR's en CI-zichtbaarheid | Repo-admin of gelijkwaardige maintainer-toegang | Repository settings, branch protections, CI-runs |
| Vercel | Productie- en preview-deployments | Project/team-toegang met deploy- en rollbackrechten | `.vercel/project.json`, Vercel-dashboard |
| Neon | Primaire database | Projecttoegang met read/write operationele zichtbaarheid | Neon-console, schema- en queryzichtbaarheid |
| Trigger.dev | Scheduled jobs en long-running tasks | Projecttoegang tot runs, schedules, env en logs | `trigger.config.ts`, Trigger.dev-dashboard |
| Sentry | Error tracking en release-zichtbaarheid | Projecttoegang plus release-zichtbaarheid | Sentry-projectdashboard |
| PostHog | Productanalytics en usage-signalen | Projecttoegang | PostHog-dashboard |
| LiveKit | Voice-runtime, indien ingeschakeld | Projecttoegang voor runtime en credentials | LiveKit-dashboard, `.env.example` |
| Typesense | Optionele search-versnelling | Toegang als externe indexering actief is | `.env.example`, reindex-workflow |
| Browserbase | Browserautomatisering voor authenticated scraping | Credentialtoegang als platformscraping hiervan afhangt | `.env.example` |
| Modal | Sandbox-execution voor scraping op Vercel | Credentialtoegang als Striive of vergelijkbare scraping hiervan afhangt | `.env.example` |
| Firecrawl | Public-web scraping en extraction | Credentialtoegang indien ingeschakeld | `.env.example` |
| OpenAI | Embeddings en chatmodeltoegang | Billing- en API-toegangszichtbaarheid | `.env.example`, providerdashboard |
| Google AI | CV parsing, enrichment, structured matching en voice plugin-gebruik | Billing- en API-toegangszichtbaarheid | `.env.example`, providerdashboard |
| xAI | Judge-model | Billing- en API-toegangszichtbaarheid | `.env.example`, providerdashboard |
| Anthropic | Aanwezig in env-inventaris voor AI SDK-gebruik | Billing- en API-toegangszichtbaarheid als nog operationeel gebruikt | `.env.example`, providerdashboard |
| LangSmith | Optionele tracing/observability | Projecttoegang als tracing aan staat | `.env.example` |
| Slack | Notificaties en operationele berichtgeving | Workspace/app-token-eigenaarschap als gebruikt | `.env.example`, Slack app-config |

## 6. Environment contract

| Subsystem | Belangrijke env-families | Verwachte bron van waarheid | Opmerkingen |
| --- | --- | --- | --- |
| Database | `DATABASE_URL` | Hosted env plus lokale `.env.local` | Verplicht voor app en Trigger.dev |
| App-auth en API-exposure | `API_SECRET`, `ALLOWED_ORIGINS` | Hosted env | Gedeeld `/api/*` bearer-gedrag is operationeel relevant |
| Search | `TYPESENSE_*` | Hosted env wanneer ingeschakeld | Optionele versneller, PostgreSQL blijft bron van waarheid |
| Encryptie | `ENCRYPTION_KEY` | Hosted env en veilige lokale development storage | Nodig voor versleutelde scraper-authconfiguratie |
| Scraping providers | `BROWSERBASE_*`, `FIRECRAWL_API_KEY`, `MODAL_*`, platformcredentials | Veilige provider secret store | Hoog-risico ownership-domein |
| AI-providers | `OPENAI_API_KEY`, `GOOGLE_*`, `X_AI_API_KEY`, `ANTHROPIC_API_KEY` | Provider-managed secrets in hosted env | Billing-zichtbaarheid is vereist |
| Monitoring | `SENTRY_*`, `LANGSMITH_*`, `OTEL_ENABLED`, `NEXT_PUBLIC_POSTHOG_*` | Hosted env | Controleer dat deze aansluiten op de actieve dashboards |
| Voice | `LIVEKIT_*`, `NEXT_PUBLIC_LIVEKIT_URL` | Hosted env | Alleen nodig als voice-oppervlak actief is |
| Notificaties | `SLACK_*` | Hosted env | Optioneel, maar operationeel belangrijk wanneer ingeschakeld |
| Autopilot | `AUTOPILOT_*` | Hosted env plus lokale debug-setup | Wordt gebruikt voor evidence capture en operationele audits |

## 7. Runbooks en escalatie

| Scenario | Eerste checks | Primaire referenties | Escaleren wanneer |
| --- | --- | --- | --- |
| Deployment failure of slechte release | Bekijk laatste deployment, vergelijk met vorige goede deployment, check runtime-logs, bevestig rollbackpad | `docs/deployment-verification-summary.md` | Productiegezondheid verslechtert of rollback is geblokkeerd |
| Scraper failure of lege imports | Check scraperconfigstatus, recente scrape-resultaten, auth/providerstatus en circuit breaker-state | `docs/runbooks/platform-onboarding.md`, `docs/architecture.md` | Een platform over meerdere schedules kapot blijft of auth/provider-toegang onduidelijk is |
| Trigger.dev task failure | Bekijk falende run, recente schedule-historie, gesynchroniseerde env en gerelateerde providerafhankelijkheden | `trigger.config.ts`, `docs/architecture.md` | Scheduled jobs herhaaldelijk falen of retentie/scrape-jobs vastlopen |
| Search- of indexdegradatie | Check of Typesense actief is, vergelijk fallback-gedrag en inspecteer responstijden en logs | `README.md`, `docs/slo-and-observability.md` | Search-kwaliteit of latency recruiter-workflows merkbaar raakt |
| Sentry- of PostHog-anomalie | Bekijk recente deployments, nieuwe issues, user-impactpatronen en provider-configuratie-drift | `docs/slo-and-observability.md`, `docs/deployment-verification-summary.md` | Er een nieuwe kritieke foutklasse is of een onverklaarbare usage-daling optreedt |

## 8. Huidige risico's en eerste prioriteiten

De nieuwe eigenaar moet starten met de nu bekende hoge-prioriteitsrisico's in plaats van met een lege roadmap.

- `motian-n38`: Modal scraping stub blokkeert een complete Vercel-veilige route voor Striive-achtige flows
- `motian-scy`: scoring is nog te rule-based en heeft sterkere semantic/vector matching nodig
- `motian-o5g`: paginationdekking is nog onvolledig op sommige oppervlakken, ook al pagineren de belangrijkste recruiter-views al
- `motian-uml`: cron due checks respecteren nu per-platform `cronExpression`; het resterende risico zit in schedule-observability en coverage-drift
- Scraperbetrouwbaarheid blijft een terugkerend operationeel aandachtspunt, vooral waar auth, browserautomatisering of provider-markup wijzigt
- Platform onboarding blijft een kritieke operator-workflow en is geen eenmalige setup

Aanvullende context die tijdens de overdracht behouden moet blijven:

- Nederlandse UI-strings en Nederlandse API-paden zijn bewuste productconventies
- Code-variabelen blijven Engels, ook als user-facing copy Nederlands is
- De repo bevat nog historische route- en naamgevingscontext; de huidige voorkeursroutes zijn `/vacatures` en `/kandidaten`

## 9. Uitvoeringsnotities voor de overdracht

Gebruik `project-ownership-transfer-checklist.nl.md` om de live overdracht uit te voeren. Deze gids is het referentiedocument; de checklist is het operationele bewijs dat de handoff echt is afgerond.

Leg zo nodig buiten de repo vast:

- huidige technische eigenaar
- inkomende technische eigenaar
- fallback-operator of stakeholder
- billing owners per provider
- secret-management source of truth
- datum waarop toegang van de vorige eigenaar is ingetrokken
