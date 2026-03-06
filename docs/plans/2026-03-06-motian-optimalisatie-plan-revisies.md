# Plan review: revisies en rationale

Review van `docs/plans/2026-03-06-motian-optimalisatie-baseline-en-uitvoer-plan.md`. Voor elke wijziging: **analyse + reden** en **git-diff style** ten opzichte van het origineel.

---

## Revisie 1 — Success criteria en risico’s expliciet maken

**Analyse:** Het plan beschrijft wat er gebeurt maar niet wanneer een fase “geslaagd” is of wat de risico’s zijn. Expliciete success criteria voorkomen scope creep en geven een duidelijke definitie of done. Risico’s en mitigaties maken het plan robuuster en geschikt voor stakeholders.

**Rationale:** Zonder success criteria kun je Fase 1 eindeloos uitbreiden met extra metrics; met criteria kun je na 2–3 dagen daadwerkelijk afronden. Risico’s (bijv. “CV job-pipeline vergroot complexiteit”) expliciet maken zorgt voor gerichte mitigaties (bijv. feature flag, fallback naar oude route).

**Diff:**

```diff
--- a/docs/plans/2026-03-06-motian-optimalisatie-baseline-en-uitvoer-plan.md
+++ b/docs/plans/2026-03-06-motian-optimalisatie-baseline-en-uitvoer-plan.md
@@ -25,6 +25,22 @@
 - Nieuwe productfeatures; dit plan richt zich op performance, onderhoudbaarheid, kosten en observability.
 - Wijzigingen aan de externe API-contracten voor derden; wel interne refactors die dezelfde API behouden.

+**Success criteria (planbreed)**
+
+- Elke fase eindigt met een werkende applicatie; `pnpm build`, `pnpm test` en `pnpm lint` zijn groen.
+- Geen regressie op bestaande gebruikersflows (opdrachten zoeken, chat, CV upload) zonder gepland fallback of feature flag.
+
+**Risico’s en mitigaties**
+
+| Risico | Mitigatie |
+|--------|-----------|
+| Baseline metrics verdwijnen of zijn niet reproduceerbaar | Metrics vastleggen in een bewaarde artefact (bijv. `docs/metrics/baseline-YYYY-MM-DD.md` of CI artifact) en script/documentatie voor reproduceerbaarheid. |
+| CV job-pipeline introduceert bugs of slechtere UX | Feature flag of parallelle route; oude sync-route blijft beschikbaar tot job-pipeline stabiel is. |
+| Workspace-migratie breekt imports of build | Incrementele migratie per package; CI blijft op elke commit groen; rollback = revert van package-extractie. |
+| Search-refactor verandert ranking gedrag | Golden-set of snapshot-tests voor ranking; A/B of vergelijkingsrun vóór volledige cutover. |
+
 ---
```

---

## Revisie 2 — Tech stack: observability en constraints vermelden

**Analyse:** Sentry en PostHog staan in de codebase; die horen in het plan als onderdeel van de stack. Vercel-functie-limieten (max duration, body size) zijn direct relevant voor CV-analyse en chat; expliciet maken voorkomt verrassingen.

**Rationale:** Een plan dat “AI-cost logging” en “SLO’s” noemt maar niet noemt waar logs en traces naartoe gaan, is incompleet. Bevestigen dat bestaande observability (Sentry, PostHog) wordt gebruikt, maakt Fase 1 en 4 concreet.

**Diff:**

```diff
@@ -36,6 +36,12 @@
 - **Kwaliteit:** Biome (lint/format), Vitest, Playwright (harness/evidence)
 - **Deploy:** Vercel

+**Observability (bestaand):** Sentry (errors, performance), PostHog (events). Dit plan bouwt daarop voort (geen nieuw observability-stack).
+
+**Relevante constraints:** Vercel serverless max duration (bijv. 60s op hobby/pro); body size limits voor uploads. CV-analyse en lange chat-sessies moeten binnen deze grenzen blijven of naar achtergrond-jobs (Trigger) worden verplaatst.
+
 De stack blijft zoals hij is; dit plan wijzigt geen fundamentele keuzes.
```

---

## Revisie 3 — Pijnpunten: security en bestandsverwijzingen

**Analyse:** AGENTS.md noemt “LIKE wildcards not escaped” (motian-d5v) als bead; dat is een security-/correctheidspunt dat bij “search” hoort. Concreet bestand/regel noemen maakt het plan traceerbaar en voorkomt dat search-refactor dit vergeet.

**Rationale:** Een plan dat “filtering naar SQL verplaatsen” zegt maar niet “en escape user input voor LIKE” vermeldt, kan tot regressie of security-incident leiden. Eén regel in de pijnpunten-tabel + een expliciete taak in Fase 2 sluit die gap.

**Diff:**

```diff
 | **Search/match** | `jobs.ts` ~507 regels: CRUD, listing, filters, hybrid search en stats in één service. `hybridSearch` doet tekst + vector parallel, `fetchSize = limit * 3`, post-filtering in memory, en een extra DB-roundtrip voor vector-only resultaten. Werkt, maar is een omwegcarrousel. |
+| **Search (security)** | Zoekinput wordt in bestaande paden met `ILIKE` gebruikt zonder escaping van `%`/`_` (zie bead motian-d5v); risico op ongewenst wildcard-gedrag of injectie. |
 | **Chat** | Elke request bouwt een rijke system prompt, resolve’t model, converteert alle berichten en geeft de volledige `recruitmentTools` set mee. Geen tool slicing per route; tot 50 berichten per sessie opgeslagen. |
```

En in Fase 2, bij jobs/search:

```diff
 1. **jobs.ts opsplitsen**
    - Split in minimaal: `jobs.repository.ts`, `jobs.search.ts`, `jobs.filters.ts`, `jobs.stats.ts`.
    - Verplaats zoveel mogelijk filtering naar SQL in plaats van post-filtering in JS.
    - Vectorzoeking: gefilterde IDs direct uit de DB, daarna join; verminder extra roundtrip voor “vector-only” resultaten.
    - Expliciete zoekindex-strategie voor tekstzoeking (bijv. bestaande FTS/btree behouden of vastleggen).
+   - **Zoekinput:** Alle gebruikersinput die in `ILIKE` of FTS-termen terechtkomt moet geëscaped worden (bijv. bestaande `escapeLike` in `src/lib/helpers` consistent gebruiken) om wildcard-injectie te voorkomen.
```

---

## Revisie 4 — Fase 1: waar baseline wordt opgeslagen en CORS-gedrag

**Analyse:** “Document of dashboard” is vaag. Als baseline alleen in een notitie staat, is hij niet reproduceerbaar. CORS: “alle origins” ondersteunen kan betekenen “meerdere waarden in Allow-Origin” (niet toegestaan door de spec) of “dynamisch één origin uit allowlist”; dat moet het plan expliciet maken.

**Rationale:** Baseline in een versioned artefact (bijv. `docs/metrics/baseline-*.md` of CI artifact) maakt vergelijking na Fase 2 mogelijk. CORS-specificatie staat maar één waarde in `Access-Control-Allow-Origin` toe; de bedoeling is dus: per request de request-origin tegen de allowlist checken en die ene origin terugzetten.

**Diff:**

```diff
 1. **Baseline metrics vastleggen**
    - `pnpm build`-tijd (lokaal en in CI).
    - Cold start / p95 latency voor `/api/chat` en `/api/cv-analyse`.
    - DB-queryduur voor zoek- en matchflows (representatieve queries).
    - Trigger job-duur per scraper/enrichment job.
    - AI-kosten per flow: chat, CV-parse, enrichment, matching (logging of bestaande trackers).
+   - **Opslag:** Resultaten vastleggen in een versioned artefact (bijv. `docs/metrics/baseline-YYYY-MM-DD.md` of CI artifact) met exacte omgeving (Node/pnpm versie, datasetgrootte) zodat Fase 2 kan vergelijken.
@@ -72,7 +78,8 @@
 3. **CORS fix**
    - `next.config.ts`: ondersteun alle origins uit `ALLOWED_ORIGINS` (niet alleen de eerste) voor `Access-Control-Allow-Origin`, of gebruik een allowlist-check in plaats van alleen `allowedOrigins[0]`.
+   - **Implementatie:** Per request de `Origin`-header vergelijken met de allowlist; als de request-origin in de lijst staat, zet die ene waarde in `Access-Control-Allow-Origin` (de spec staat maar één origin per response toe). Anders geen CORS-header of 403.
```

---

## Revisie 5 — Fase 2: CV-pipeline — “job” definiëren en idempotentie

**Analyse:** “Job-gebaseerde pipeline” kan betekenen: Trigger.dev tasks, of een eigen job-queue, of DB-rijtjes. Idempotentie en retry zijn genoemd maar niet concreet (bijv. idempotency key per CV-upload of per stap).

**Rationale:** Zonder duidelijke keuze (“elke stap = Trigger task” of “één Trigger task met interne stappen”) lopen implementatiediscussies uit. Idempotency keys (bijv. hash van bestand + stap) voorkomen dubbele verwerking bij retries.

**Diff:**

```diff
 3. **CV-analyse: job-gebaseerde pipeline**
    - Knip de flow in afzonderlijke stappen/jobs: upload → parse → dedupe → enrich → match.
+   - **Definitie “job”:** Elke stap is een aparte Trigger.dev task (of een duidelijke sub-run met eigen status); zo kunnen retries en observability per stap. Alternatief: één orchestrator-task die sub-stappen aanroept met idempotency keys.
    - SSE streamt alleen job-status (geen lange polonaise in één request).
    - Bewaar tussenresultaten expliciet in DB of job-state.
    - Retries idempotent per stap.
+   - **Idempotentie:** Per stap een idempotency key (bijv. `cv-${fileHash}-${stepName}`) zodat dubbele aanroepen geen dubbele AI-kosten of dubbele DB-writes geven.
    - Cache of hash van CV-bestanden zodat hetzelfde document niet dubbel door AI gaat.
```

---

## Revisie 6 — Fase 2: expliciete koppeling met unified search plan

**Analyse:** Het plan verwijst naar het unified-search document maar zegt niet of jobs-refactor vóór, na of samen met dat plan moet. Als dezelfde `jobs.ts` zowel wordt opgesplitst als wordt vervangen door een unified search API, moet de volgorde helder zijn.

**Rationale:** Twee parallelle refactors aan dezelfde laag (search) zonder volgorde leidt tot merge-conflicten en dubbel werk. Expliciet maken: “unified search contract eerst (of gelijktijdig), daarna jobs-modules vullen” voorkomt dat.

**Diff:**

```diff
 **Afhankelijkheden:** Fase 1 baseline (optioneel maar aanbevolen voor vergelijking); unified search plan kan parallel of vooraf (zie bestaand plan in `docs/plans/2026-03-06-refactor-unified-vacature-search-parity-plan.md`).
+
+**Volgorde t.o.v. unified search:** De refactor “unified vacature search parity” introduceert één shared search contract. Aanbevolen: dat contract en de dunne adapters (UI, chat, MCP, voice) eerst implementeren; daarna de implementatie *binnen* dat contract opsplitsen in `jobs.search.ts` / `jobs.filters.ts` en optimaliseren. Zo voorkom je dat twee grote wijzigingen (parity + split) tegelijk in dezelfde bestanden plaatsvinden.
```

---

## Revisie 7 — Fase 3: package-volgorde en shared build

**Analyse:** “Eerst db, dan esco, dan ai/scrapers” is genoemd maar niet onderbouwd. Daarnaast: bij een monorepo horen gedeelde tsconfig/build-afspraken; anders krijg je inconsistente strictheid of output.

**Rationale:** `db` heeft het minste afhankelijkheden naar de rest; `esco` hangt van db en schema af; `ai` en `scrapers` hangen van db (en mogelijk esco) af. Die volgorde minimaliseert circulariteit. Een korte zin over shared build voorkomt dat elke package zijn eigen tsconfig krijgt zonder afstemming.

**Diff:**

```diff
 2. **Migratie-strategie**
    - Incrementeel: eerst packages extraheren die het minst gekoppeld zijn (bijv. `db`, dan `esco`, dan `ai`/`scrapers`).
+   - **Volgorde:** `packages/db` eerst (alleen Drizzle + schema; geen app-logica). Dan `packages/esco` (gebruikt db). Dan `packages/ai` en `packages/scrapers` (beide gebruiken db; scrapers mogelijk esco). `packages/core-domain` kan vroeg (pure types/constants) of samen met db.
+   - **Build:** Gedeelde `tsconfig.base.json` of workspace-level build-afspraken zodat alle packages dezelfde strictheid en target delen; voorkom circulariteit in type-checks.
    - Apps blijven werken tijdens de migratie; imports worden stap voor stap omgezet naar workspace packages.
```

---

## Revisie 8 — Fase 4: concrete SLO-voorbeelden en error budget

**Analyse:** “Bijv. p95 latency” is te vaag om te implementeren. Een concreet getal (bijv. “chat p95 &lt; 4s”) maakt SLO’s meetbaar. Error budget (bijv. “max 1% van requests mag boven 4s”) koppelt SLO’s aan prioriteit van fixes.

**Rationale:** Teams kunnen pas “SLO’s vastleggen” doen als er een voorstel is; anders blijft het abstract. Error budget maakt duidelijk wanneer je moet stoppen met features en moet stabiliseren.

**Diff:**

```diff
 1. **SLO’s**
    - Doelcijfers voor chat (bijv. p95 latency, max tokens per sessie), search (p95, throughput), CV-pipeline (eind-tot-eind duur, slagingspercentage).
+   - **Voorbeelden (te valideren met data):** Chat: p95 &lt; 4s voor eerste token; search: p95 &lt; 800ms voor hybridSearch; CV-pipeline: eind-tot-eind &lt; 90s, slagingspercentage &gt; 95%. Max tokens per chat-sessie (bijv. 50k) om kosten te begrenzen.
+   - **Error budget:** Definieer een acceptabel percentage van requests dat buiten de SLO mag vallen (bijv. 1% of 5%); overschrijding triggert focus op stabiliteit in plaats van nieuwe features.
```

---

## Revisie 9 — Architectuurprincipes: security en agent parity

**Analyse:** Het plan noemt geen security-principes; inputvalidatie en config (geen secrets in repo) horen bij “geen breaking changes” en betrouwbaarheid. Agent parity (wat de gebruiker kan, kan de agent ook) staat in AGENTS.md en is relevant voor chat/search/API-design.

**Rationale:** Refactors die “geen breaking changes” beloven maar wel nieuwe API’s of tools toevoegen, kunnen per ongeluk agent-parity breken. Eén expliciet principe zorgt dat nieuwe endpoints en tools agent-vriendelijk blijven.

**Diff:**

```diff
 - **Incrementeel en testbaar:** Elke fase levert werkende software; tests en lint blijven groen.
+
+- **Security en config:** Geen secrets in repo; gevoelige config via environment. Alle gebruikersinput die in zoek- of DB-context komt valideren en escapen (zie Fase 2 search).
+- **Agent parity:** Nieuwe of gewijzigde flows (chat, search, CV) zo ontwerpen dat wat een gebruiker via de UI kan, ook via agent-tools/MCP/API kan; geen “alleen UI”-features zonder programmeerbare tegenhanger.
```

---

## Revisie 10 — Open vragen: aanbevolen antwoorden en extra vraag

**Analyse:** Open vragen blijven open; een korte “aanbeveling” per vraag maakt het plan uitvoerbaar zonder extra workshop. Neon connection pooler (bijv. PgBouncer of Neon’s eigen pooler) is relevant voor “DB pool” en verdient een expliciete vraag.

**Rationale:** “Welk minimum voor coverage” kan eindeloos worden bediscussieerd; een voorstel (bijv. 40% globaal in Fase 1, zonder gate) maakt dat Fase 1 toch kan starten. Idem voor SLO-getallen en pool: aanbeveling + “te valideren” is voldoende.

**Diff:**

```diff
 ## 7. Open vragen voor verfijning

-- **Coverage-thresholds:** Welk minimum (globaal of per package) is haalbaar en zinvol in Fase 1?
-- **SLO-targets:** Concreet getal voor chat p95 (bijv. &lt; 3s) en voor CV-pipeline (bijv. &lt; 90s eind-tot-eind)?
-- **DB pool:** Moet `max: 20` op Neon serverless worden herzien (bijv. lager of connection pooler)? Onderzoek of incidenten bekend zijn.
-- **Workspace-volgorde:** Eerst `db` en `core-domain`, of eerst `ai` en `scrapers`? Afhankelijk van welke coupling het meest pijn doet.
+**Aanbevolen antwoorden (te valideren):**
+
+- **Coverage-thresholds:** Fase 1: coverage alleen rapporteren in CI (geen gate). Na stabilisatie: optionele gate op 40% globaal of per package; per-domein thresholds in een latere iteratie.
+- **SLO-targets:** Zie Fase 4 revisie (chat p95 &lt; 4s, search p95 &lt; 800ms, CV &lt; 90s); te meten na Fase 1 baseline en bij te stellen met echte data.
+- **DB pool:** Neon serverless: documentatie raadplegen voor aanbevolen pool size; bij twijfel lager (bijv. 10) of Neon’s connection pooler gebruiken om connection pressure te beperken. Geen wijziging zonder meting of incident.
+- **Workspace-volgorde:** Zie Fase 3 revisie: `db` → `esco` → `ai` / `scrapers`; `core-domain` vroeg.
+
+**Open punt:** Gebruik van Neon connection pooler (of PgBouncer) versus directe pool: impact op serverless cold starts en max connections documenteren vóór wijziging.
```

---

## Revisie 11 — Sectie “Definition of done” per fase

**Analyse:** “Deliverables” bestaan al, maar een korte “DoD” (bijv. “alle items afgevinkt, baseline gedocumenteerd, CI groen”) maakt handoff en acceptatie eenduidig.

**Rationale:** Voorkomt dat Fase 1 “bijna klaar” blijft omdat er geen duidelijke eindstreep is. Handig voor beads: elke bead kan naar zo’n DoD verwijzen.

**Diff:**

```diff
 **Afhankelijkheden:** Geen; kan direct starten.

+**Definition of done Fase 1:** (1) Baseline-cijfers vastgelegd in versioned artefact; (2) CORS fix gedeployed en getest; (3) Coverage-stap in CI actief; (4) hybridSearch-benchmark draait reproduceerbaar; (5) AI-cost logging (of duidelijke plek in bestaande logging) gedocumenteerd. Build/test/lint groen.
+
 ---
 ### Fase 2 — Search, chat, CV (ca. 1 week)
@@ -107,6 +111,8 @@
 **Afhankelijkheden:** Fase 1 baseline (optioneel maar aanbevolen voor vergelijking); unified search plan kan parallel of vooraf (zie bestaand plan in `docs/plans/2026-03-06-refactor-unified-vacature-search-parity-plan.md`).
```

En voor Fase 2:

```diff
 **Volgorde t.o.v. unified search:** ...
+
+**Definition of done Fase 2:** (1) jobs opgesplitst in repository/search/filters/stats; (2) hybridSearch met minder roundtrips en meer SQL-filtering; (3) Chat tool slicing per route actief; (4) CV-pipeline als async jobs met SSE-status en fallback of feature flag; (5) Zoekinput escaping toegepast. Geen regressie op bestaande search/chat/CV-flows (binnen SLO of met gedocumenteerde uitzondering).
```

(Vergelijkbare DoD’s voor Fase 3 en 4 kunnen in dezelfde stijl worden toegevoegd.)

---

## Samenvatting van revisies

| # | Onderwerp | Doel |
|---|-----------|------|
| 1 | Success criteria + risico’s | Duidelijke eindstreep en mitigaties |
| 2 | Tech stack: observability + constraints | Compleetheid en Vercel-limieten |
| 3 | Security (LIKE-escaping) + traceerbaarheid | Geen security-regressie bij search |
| 4 | Baseline-opslag + CORS-implementatie | Reproduceerbaarheid en correcte CORS |
| 5 | CV “job” + idempotency keys | Eenduidige implementatiekeuzes |
| 6 | Koppeling unified search | Volgorde en geen dubbel werk |
| 7 | Package-volgorde + shared build | Stuurwerk workspace-migratie |
| 8 | SLO-voorbeelden + error budget | Meetbare SLO’s en prioritering |
| 9 | Security- en agent-parityprincipes | Consistente architectuur |
| 10 | Open vragen: aanbevelingen | Plan uitvoerbaar zonder extra workshop |
| 11 | Definition of done per fase | Duidelijke acceptatie en handoff |

Alle diffs zijn bedoeld om **in-place** in `docs/plans/2026-03-06-motian-optimalisatie-baseline-en-uitvoer-plan.md` te worden geïntegreerd. Na integratie: status in frontmatter bijwerken (bijv. `status: revised`) en eventueel versienummer of datum toevoegen.
