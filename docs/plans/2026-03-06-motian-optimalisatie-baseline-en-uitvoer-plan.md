---
title: "Motian optimalisatie — baseline, search, chat, CV-pipeline, workspace en CI"
type: plan
status: revised
date: 2026-03-06
origin: planning-workflow Phase 1 — initial plan voor iteratieve verfijning (GPT Pro)
revised: 2026-03-06 — integratie review (success criteria, risico’s, security, SLO’s, DoD, CORS/ baseline-opslag, CV idempotentie, unified search volgorde, workspace volgorde)
---

# Motian optimalisatie — baseline, search, chat, CV-pipeline, workspace en CI

## 1. Doel en intentie

Motian is een sterk platform in scope en visie, maar de codebasis heeft het klassieke succesprobleem: te veel verantwoordelijkheden zitten in één machinekamer. Web-app, chat-agent, CV-pipeline, scrapers, ESCO, voice, WhatsApp, Trigger jobs en tooling delen dezelfde dependency surface en monolithische structuur. Het doel van dit plan is niet “een beetje opschonen”, maar **gericht optimaliseren in volgorde van impact**: eerst meten, dan de grootste winst (search/match), daarna chat en CV-pipeline, en pas daarna structurele opsplitsing (workspace) en CI/infra.

**Waarom deze volgorde**

- Zonder baseline weet je niet of refactors helpen of schaden.
- Search en match zijn het meest gebruikte pad; daar zit de eerste echte snelheidswinst.
- Chat en CV zijn AI- en kostenintensief; optimalisatie daar verlaagt latency en kosten.
- Workspace-opsplitsing is waardevol voor onderhoud en ownership, maar levert pas na de andere stappen maximale waarde.
- CI en infra-hygiëne verhogen betrouwbaarheid en voorkomen regressie.

**Niet in scope (bewust)**

- Nieuwe productfeatures; dit plan richt zich op performance, onderhoudbaarheid, kosten en observability.
- Wijzigingen aan de externe API-contracten voor derden; wel interne refactors die dezelfde API behouden.

**Success criteria (planbreed)**

- Elke fase eindigt met een werkende applicatie; `pnpm build`, `pnpm test` en `pnpm lint` zijn groen.
- Geen regressie op bestaande gebruikersflows (opdrachten zoeken, chat, CV upload) zonder gepland fallback of feature flag.

**Risico’s en mitigaties**

| Risico | Mitigatie |
|--------|-----------|
| Baseline metrics verdwijnen of zijn niet reproduceerbaar | Metrics vastleggen in een bewaarde artefact (bijv. `docs/metrics/baseline-YYYY-MM-DD.md` of CI artifact) en script/documentatie voor reproduceerbaarheid. |
| CV job-pipeline introduceert bugs of slechtere UX | Feature flag of parallelle route; oude sync-route blijft beschikbaar tot job-pipeline stabiel is. |
| Workspace-migratie breekt imports of build | Incrementele migratie per package; CI blijft op elke commit groen; rollback = revert van package-extractie. |
| Search-refactor verandert ranking gedrag | Golden-set of snapshot-tests voor ranking; A/B of vergelijkingsrun vóór volledige cutover. |

---

## 2. Tech stack (vaststaand)

- **Runtime:** Node 22, pnpm 9.x
- **Frontend:** Next.js 16 (App Router, Turbopack), React 19, Tailwind 4, shadcn/ui, AI SDK Elements
- **Backend:** Next.js API routes (Dutch paden), Drizzle ORM, Neon PostgreSQL (pgvector)
- **AI:** Vercel AI SDK, Gemini (o.a. 2.5 Flash), embeddings (text-embedding-3-small, 512 dims)
- **Jobs:** Trigger.dev v4 (schedules, tasks)
- **Voice:** LiveKit Agents, Gemini 2.5 Flash Native Audio
- **Kwaliteit:** Biome (lint/format), Vitest, Playwright (harness/evidence)
- **Deploy:** Vercel

**Observability (bestaand):** Sentry (errors, performance), PostHog (events). Dit plan bouwt daarop voort (geen nieuw observability-stack).

**Relevante constraints:** Vercel serverless max duration (bijv. 60s op hobby/pro); body size limits voor uploads. CV-analyse en lange chat-sessies moeten binnen deze grenzen blijven of naar achtergrond-jobs (Trigger) worden verplaatst.

De stack blijft zoals hij is; dit plan wijzigt geen fundamentele keuzes.

---

## 3. Huidige pijnpunten (kort)

| Gebied | Probleem |
|--------|----------|
| **Search/match** | `jobs.ts` ~507 regels: CRUD, listing, filters, hybrid search en stats in één service. `hybridSearch` doet tekst + vector parallel, `fetchSize = limit * 3`, post-filtering in memory, en een extra DB-roundtrip voor vector-only resultaten. Werkt, maar is een omwegcarrousel. |
| **Search (security)** | Zoekinput wordt in bestaande paden met `ILIKE` gebruikt zonder escaping van `%`/`_` (zie bead motian-d5v); risico op ongewenst wildcard-gedrag of injectie. |
| **Chat** | Elke request bouwt een rijke system prompt, resolve’t model, converteert alle berichten en geeft de volledige `recruitmentTools` set mee. Geen tool slicing per route; tot 50 berichten per sessie opgeslagen. |
| **CV-analyse** | Eén streaming route: upload, parse, grading, dedupe, kandidaatcreatie/verrijking en auto-matching in één request met `maxDuration = 60`. Lang en timeout-gevoelig. |
| **Repo** | Eén root package met web, voice-agent, scrapers, ESCO, AI, DB, enz. Geen pnpm workspace; `agent/` is onderdeel van dezelfde tree. |
| **CI** | Lint, typecheck, test, build; browser-evidence alleen bij high-risk. Geen coverage-stap of -gate; vitest één project, node env. |
| **Infra/config** | CORS gebruikt alleen de eerste origin uit `ALLOWED_ORIGINS`. DB pool `max: 20`; Sentry DSN hardcoded in `trigger.config.ts`. |

---

## 4. Uitvoerorde en fases

### Fase 1 — Baseline en quick wins (2–3 dagen)

**Doel:** Meetbare uitgangssituatie en laaghangend fruit; geen grote refactors.

1. **Baseline metrics vastleggen**
   - `pnpm build`-tijd (lokaal en in CI).
   - Cold start / p95 latency voor `/api/chat` en `/api/cv-analyse`.
   - DB-queryduur voor zoek- en matchflows (representatieve queries).
   - Trigger job-duur per scraper/enrichment job.
   - AI-kosten per flow: chat, CV-parse, enrichment, matching (logging of bestaande trackers).
   - **Opslag:** Resultaten vastleggen in een versioned artefact (bijv. `docs/metrics/baseline-YYYY-MM-DD.md` of CI artifact) met exacte omgeving (Node/pnpm versie, datasetgrootte) zodat Fase 2 kan vergelijken.

2. **hybridSearch benchmark**
   - Benchmark voor `hybridSearch(query, filters)` met 10, 100 en 1.000+ jobs (of beschikbare dataset).
   - Doel: referentie voor latere optimalisatie (minder roundtrips, minder in-memory filtering).

3. **CORS fix**
   - `next.config.ts`: ondersteun alle origins uit `ALLOWED_ORIGINS` (niet alleen de eerste) voor `Access-Control-Allow-Origin`, of gebruik een allowlist-check in plaats van alleen `allowedOrigins[0]`.
   - **Implementatie:** Per request de `Origin`-header vergelijken met de allowlist; als de request-origin in de lijst staat, zet die ene waarde in `Access-Control-Allow-Origin` (de spec staat maar één origin per response toe). Anders geen CORS-header of 403.

4. **AI-cost logging**
   - Log (of verrijk bestaande logging) van AI-kosten per flow (chat, CV-parse, enrichment) zodat Fase 2/4 budgetten en SLO’s kunnen bouwen.

5. **Coverage in CI**
   - Vitest coverage aanzetten in de CI-workflow; optioneel een minimum threshold (bijv. per domein of globaal) als gate.

**Deliverables:** Document of dashboard met baseline-cijfers; CORS-fix live; coverage in CI; benchmark-script of -suite voor hybridSearch.

**Definition of done Fase 1:** (1) Baseline-cijfers vastgelegd in versioned artefact; (2) CORS fix gedeployed en getest; (3) Coverage-stap in CI actief; (4) hybridSearch-benchmark draait reproduceerbaar; (5) AI-cost logging (of duidelijke plek in bestaande logging) gedocumenteerd. Build/test/lint groen.

**Afhankelijkheden:** Geen; kan direct starten.

---

### Fase 2 — Search, chat, CV (ca. 1 week)

**Doel:** Minder DB-work en in-memory filtering; lagere chat-latency en -kosten; CV-pipeline robuuster en goedkoper.

1. **jobs.ts opsplitsen**
   - Split in minimaal: `jobs.repository.ts`, `jobs.search.ts`, `jobs.filters.ts`, `jobs.stats.ts`.
   - Verplaats zoveel mogelijk filtering naar SQL in plaats van post-filtering in JS.
   - Vectorzoeking: gefilterde IDs direct uit de DB, daarna join; verminder extra roundtrip voor “vector-only” resultaten.
   - Expliciete zoekindex-strategie voor tekstzoeking (bijv. bestaande FTS/btree behouden of vastleggen).
   - **Zoekinput:** Alle gebruikersinput die in `ILIKE` of FTS-termen terechtkomt moet geëscaped worden (bijv. bestaande `escapeLike` in `src/lib/helpers` consistent gebruiken) om wildcard-injectie te voorkomen.

2. **Chat: tool slicing en prompt**
   - Tool slicing per route/context: op `/opdrachten` niet alle kandidaat-, GDPR- en interviewtools injecteren.
   - Cache onderdelen van `buildSystemPrompt()` die niet per request veranderen.
   - Samenvattingslogica voor oudere chatgeschiedenis in plaats van alleen “laatste N berichten” (bijv. samenvatting van oudere context, recente berichten voluit).
   - Optioneel: meting van tool-call ratio, token usage en gemiddelde step count; hard budget per chat-sessie (Fase 4 kan hierop voortbouwen).

3. **CV-analyse: job-gebaseerde pipeline**
   - Knip de flow in afzonderlijke stappen/jobs: upload → parse → dedupe → enrich → match.
   - **Definitie “job”:** Elke stap is een aparte Trigger.dev task (of een duidelijke sub-run met eigen status); zo kunnen retries en observability per stap. Alternatief: één orchestrator-task die sub-stappen aanroept met idempotency keys.
   - SSE streamt alleen job-status (geen lange polonaise in één request).
   - Bewaar tussenresultaten expliciet in DB of job-state.
   - Retries idempotent per stap.
   - **Idempotentie:** Per stap een idempotency key (bijv. `cv-${fileHash}-${stepName}`) zodat dubbele aanroepen geen dubbele AI-kosten of dubbele DB-writes geven.
   - Cache of hash van CV-bestanden zodat hetzelfde document niet dubbel door AI gaat.

**Deliverables:** Nieuwe job-modules; hybridSearch met minder roundtrips en meer SQL-filtering; chat met minder tools en (optioneel) prompt-cache; CV als async job-pipeline met SSE-status.

**Afhankelijkheden:** Fase 1 baseline (optioneel maar aanbevolen voor vergelijking); unified search plan kan parallel of vooraf (zie bestaand plan in `docs/plans/2026-03-06-refactor-unified-vacature-search-parity-plan.md`).

**Volgorde t.o.v. unified search:** De refactor “unified vacature search parity” introduceert één shared search contract. Aanbevolen: dat contract en de dunne adapters (UI, chat, MCP, voice) eerst implementeren; daarna de implementatie *binnen* dat contract opsplitsen in `jobs.search.ts` / `jobs.filters.ts` en optimaliseren. Zo voorkom je dat twee grote wijzigingen (parity + split) tegelijk in dezelfde bestanden plaatsvinden.

**Definition of done Fase 2:** (1) jobs opgesplitst in repository/search/filters/stats; (2) hybridSearch met minder roundtrips en meer SQL-filtering; (3) Chat tool slicing per route actief; (4) CV-pipeline als async jobs met SSE-status en fallback of feature flag; (5) Zoekinput escaping toegepast. Geen regressie op bestaande search/chat/CV-flows (binnen SLO of met gedocumenteerde uitzondering).

---

### Fase 3 — Workspace en packages (1–2 weken)

**Doel:** Kleinere install surface per app, snellere builds, minder accidental coupling, duidelijkere ownership.

1. **pnpm workspace**
   - Root wordt workspace met o.a.:
     - `apps/web` — Next.js app (huidige app/, components/, huidige API).
     - `apps/voice-agent` — LiveKit voice agent (uit `src/voice-agent` of bestaande agent-setup).
     - `packages/core-domain` — gedeelde domeinlogica (types, constanten, pure business rules).
     - `packages/db` — Drizzle schema, connection, migrations.
     - `packages/ai` — agent, tools, prompts, model config.
     - `packages/scrapers` — scraper-implementaties en -config.
     - `packages/esco` — ESCO-koppeling.
     - `packages/ui` — gedeelde UI-componenten (of behoud in apps/web tot nadere beslissing).

2. **Migratie-strategie**
   - Incrementeel: eerst packages extraheren die het minst gekoppeld zijn (bijv. `db`, dan `esco`, dan `ai`/`scrapers`).
   - **Volgorde:** `packages/db` eerst (alleen Drizzle + schema; geen app-logica). Dan `packages/esco` (gebruikt db). Dan `packages/ai` en `packages/scrapers` (beide gebruiken db; scrapers mogelijk esco). `packages/core-domain` kan vroeg (pure types/constants) of samen met db.
   - **Build:** Gedeelde `tsconfig.base.json` of workspace-level build-afspraken zodat alle packages dezelfde strictheid en target delen; voorkom circulariteit in type-checks.
   - Apps blijven werken tijdens de migratie; imports worden stap voor stap omgezet naar workspace packages.

3. **Frontend bundles**
   - Na workspace: imports en barrel-exports opschonen; controle op dubbele dependencies en bundle-grootte.

**Deliverables:** Werkende pnpm workspace; minimaal `apps/web` en `packages/db` (en optioneel andere packages) gemigreerd; build en tests groen.

**Definition of done Fase 3:** (1) pnpm workspace met `apps/web` en `packages/db` werkend; (2) gedeelde tsconfig/build-afspraken; (3) alle bestaande tests en build groen; (4) geen regressie op deploy.

**Afhankelijkheden:** Fase 2 niet strikt noodzakelijk, maar voorkomt dat je twee grote refactors tegelijk doet; aanbevolen na of parallel aan de belangrijkste search/chat/cv-wijzigingen.

---

### Fase 4 — SLO’s en observability (doorlopend)

**Doel:** Voorspelbare kwaliteit en kosten; snelle detectie van regressie.

1. **SLO’s**
   - Doelcijfers voor chat (bijv. p95 latency, max tokens per sessie), search (p95, throughput), CV-pipeline (eind-tot-eind duur, slagingspercentage).
   - **Voorbeelden (te valideren met data):** Chat: p95 &lt; 4s voor eerste token; search: p95 &lt; 800ms voor hybridSearch; CV-pipeline: eind-tot-eind &lt; 90s, slagingspercentage &gt; 95%. Max tokens per chat-sessie (bijv. 50k) om kosten te begrenzen.
   - **Error budget:** Definieer een acceptabel percentage van requests dat buiten de SLO mag vallen (bijv. 1% of 5%); overschrijding triggert focus op stabiliteit in plaats van nieuwe features.

2. **Query-observability**
   - Logging of tracing van trage queries; optioneel dashboard of alerts op drempels.

3. **AI-budgetten en fallback**
   - Hard budget per chat-sessie of per tenant; fallback bij overschrijding (bijv. kortere context of “budget op” melding).
   - Waar mogelijk: goedkopere modellen of kleinere context voor niet-kritieke paden.

4. **Regressietests**
   - Tests voor ranking en matching (bijv. golden set of snapshot) zodat search-refactors geen stille gedragsregressie veroorzaken.

**Deliverables:** Gedocumenteerde SLO’s; basis voor query-observability; AI-budget (en eventueel fallback) in code; regressietests voor search/match.

**Definition of done Fase 4:** (1) SLO’s en error budget gedocumenteerd; (2) query-observability (logging/tracing) actief; (3) AI-budget of fallback geïmplementeerd; (4) regressietests voor search/ranking in CI.

**Afhankelijkheden:** Fase 1 baseline; Fase 2 chat/CV-wijzigingen voor zinvolle SLO’s en budgetten.

---

## 5. Drie hefboomen (prioriteit als je maar weinig mag doen)

1. **hybridSearch en match-flow optimaliseren** — minder DB-roundtrips, meer filtering in SQL, stabielere ranking; direct merkbaar voor alle surfaces die zoeken.
2. **CV-analyse naar async/job-gebaseerde pipeline** — robuustere UX, minder timeouts, betere retry en observability, lagere AI-kosten door dedupe/cache.
3. **Repo opsplitsen naar workspace packages** — onderhoudbaarheid, duidelijkere grenzen, snellere builds op termijn.

De rest (CORS, coverage, tool slicing, prompt-cache, SLO’s) is belangrijk maar volgt logisch uit deze drie of uit Fase 1.

---

## 6. Architectuurprincipes (voor alle fases)

- **Meet voor je refactort:** Geen grote wijzigingen aan search of chat zonder baseline en (waar mogelijk) benchmark.
- **Eén bron van waarheid voor zoeken:** Zoek- en filterlogica hoort in de (nieuwe) search-laag; UI, chat, MCP en voice zijn dunne adapters (sluit aan bij bestaand unified-search plan).
- **Geen breaking changes voor eindgebruikers:** API-contracten en Nederlandse URL’s blijven; wijzigingen zijn intern (modules, jobs, prompt/tool-selectie).
- **Incrementeel en testbaar:** Elke fase levert werkende software; tests en lint blijven groen.
- **Security en config:** Geen secrets in repo; gevoelige config via environment. Alle gebruikersinput die in zoek- of DB-context komt valideren en escapen (zie Fase 2 search).
- **Agent parity:** Nieuwe of gewijzigde flows (chat, search, CV) zo ontwerpen dat wat een gebruiker via de UI kan, ook via agent-tools/MCP/API kan; geen “alleen UI”-features zonder programmeerbare tegenhanger.

---

## 7. Open vragen voor verfijning

**Aanbevolen antwoorden (te valideren):**

- **Coverage-thresholds:** Fase 1: coverage alleen rapporteren in CI (geen gate). Na stabilisatie: optionele gate op 40% globaal of per package; per-domein thresholds in een latere iteratie.
- **SLO-targets:** Zie Fase 4 (chat p95 &lt; 4s, search p95 &lt; 800ms, CV &lt; 90s); te meten na Fase 1 baseline en bij te stellen met echte data.
- **DB pool:** Neon serverless: documentatie raadplegen voor aanbevolen pool size; bij twijfel lager (bijv. 10) of Neon’s connection pooler gebruiken om connection pressure te beperken. Geen wijziging zonder meting of incident.
- **Workspace-volgorde:** Zie Fase 3: `db` → `esco` → `ai` / `scrapers`; `core-domain` vroeg.

**Open punt:** Gebruik van Neon connection pooler (of PgBouncer) versus directe pool: impact op serverless cold starts en max connections documenteren vóór wijziging.

---

## 8. Volgende stap in de planning-workflow

1. **Phase 2 (iteratieve verfijning):** Neem dit volledige document over naar **GPT Pro met Extended Reasoning** en gebruik de exacte prompt uit de planning-workflow skill:
   - *"Carefully review this entire plan for me and come up with your best revisions in terms of better architecture, new features, changed features, etc. to make it better, more robust/reliable, more performant, more compelling/useful, etc. For each proposed change, give me your detailed analysis and rationale/justification for why it would make the project better along with the git-diff style change versus the original plan shown below:"*
   - Plak daarna het volledige plan (dit document) onder die prompt.

2. **Integratie van revisies:** Na 4–5 ronden met GPT Pro, integreer de wijzigingen in dit plan (bijv. in Claude Code met de “integrate these revisions in-place” prompt uit de skill).

3. **Optioneel — Multi-model blending:** Laat concurrerende plannen maken (bijv. Gemini, Grok, Opus 4.5) en gebruik GPT Pro als arbiter om het plan verder te versterken.

4. **Convert to beads:** Als het plan stabiel is, omzetten naar beads met afhankelijkheden zodat agents met `bv` en `bd` kunnen werken.

---

## 9. Referenties

- **Planrevisies (rationale en diffs):** `docs/plans/2026-03-06-motian-optimalisatie-plan-revisies.md`
- **Unified job search (brainstorm):** `docs/brainstorms/2026-03-06-unified-job-search-brainstorm.md`
- **Unified vacature search (implementatieplan):** `docs/plans/2026-03-06-refactor-unified-vacature-search-parity-plan.md`
- **AGENTS.md:** Beads-workflow, conventies, key files
- **CLAUDE.md / workspace rules:** File layout, Trigger.dev, kwaliteitsregels
