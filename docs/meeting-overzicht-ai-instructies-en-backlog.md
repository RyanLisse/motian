# Overzicht voor meeting: AI-instructies, productbacklog en database-persistentie

**Doel:** Eén document met (1) welke instructies/requirements aan de AI zijn gegeven, (2) welke productbacklog deels is uitgewerkt, en (3) welke onderdelen niet werken of geen/onvolledige database-persistentie hebben.

---

## 1. Waar staan de instructies en requirements?

### Agent-instructies (voor AI-agents)

- **`AGENTS.md`** — Hoofddocument voor agents:
  - Projectoverzicht (Next.js 16, Drizzle, Neon, Vercel AI SDK)
  - Architectuurlagen (app/, components/, src/ai/, src/services/, src/db/)
  - Conventies (Nederlandse UI, Engelse variabelen, Dutch API-paden)
  - Workflow (bv/bd, beads, lint, commit)
  - **Alle 146 beads gesloten** — zie sectie 3 voor statusoverzicht
  - Key files reference (schema, services, scrapers, AI tools)

- **`CLAUDE.md`** — Cursor/Claude-specifiek:
  - Parallelle uitvoering, bestandsorganisatie
  - Trigger.dev tasks, SPARC-achtige workflow
  - Zelfde technische stack en conventies

### Productbacklog en requirements (inhoudelijk)

- **`docs/brainstorms/PRD.md`** — Product Requirements Document (framework-agnostisch):
  - Doel: recruitment workflow (multi-source jobs, normalisatie, matching, pipeline, AI-assistent)
  - User stories o.a.: scraper config, normalisatielaag, dashboard, pause/resume
  - Data model: Job, ScraperConfig, ScrapeResult, Candidate, Application, Interview, Message
  - NFRs: uitbreidbaarheid, betrouwbaarheid, observability, security

- **`docs/plans/2026-02-21-feat-recruitment-platform-full-implementation-plan.md`** — Uitgewerkte implementatieplan:
  - 7 vertical slices + Agent-Native layer (CLI + MCP)
  - **Phase 1** (Striive + DB): grotendeels afgevinkt in plan; huidige codebase gebruikt geen Motia Steps maar Next.js API + services
  - **Phase 2–7**: veel taken nog als `[ ]` (niet gedaan)
  - Agent-Native pariteitstabel: UI / REST / CLI / MCP per entity

- **`docs/brainstorms/2026-02-21-recruitment-platform-brainstorm.md`** — Technische brainstorm (schema, Zod, requirements-structuur).

- **`docs/architecture.md`** — Huidige architectuur: tabellen, cron, security, frontend-routes.

---

## 2. Wat is deels gemaakt (productbacklog)?

| Onderdeel | Status | Opmerking |
|-----------|--------|-----------|
| **Jobs/Opdrachten** | ✅ Lezen + schrijven | Scraping → normalize → DB (jobs table). Zoeken via API, opdrachten- en opdracht-detailpagina’s bestaan. |
| **Scraper config + resultaten** | ✅ Lezen + schrijven | scraper_configs, scrape_results. API: configuraties, trigger scrape, gezondheid. Scraper-dashboardpagina. |
| **Kandidaten** | ✅ Lezen + schrijven | candidates table. POST/GET /api/kandidaten, cv-upload + cv-upload/save. Professionals-pagina’s. |
| **Matches** | ✅ Lezen + schrijven | job_matches: structured + hybrid (rule+vector) matching. Matching-pagina; goedkeuren/afwijzen via API. |
| **Sollicitaties (applications)** | ✅ Lezen + schrijven | applications table. API + pipeline-pagina. |
| **Interviews** | ✅ Lezen + schrijven | interviews table. API (GET/POST/PATCH). Interviews-pagina. |
| **Berichten** | ✅ Lezen + schrijven | messages table. Service createMessage; API /api/berichten. Messages-pagina leest uit DB. |
| **Chat-sessies** | ✅ Schrijven (met logging) | chat_sessions: fire-and-forget met error logging; faalt niet als persistence faalt. |
| **Reports** | ✅ Alleen lezen | Genereert rapport uit bestaande match (geen extra persistentie). |
| **Striive scraping** | ✅ Volledig | Playwright-gebaseerd (local + webhook mode). Niet langer stub. |
| **Instellingen** | ❌ Alleen UI | Settings-pagina: lege “Binnenkort beschikbaar”-state, geen backend/DB. |
| **AI Grading / CV Beheer** | ✅ Tabs onder Matching | AI Grading en CV Analyse beschikbaar als tabs op /matching pagina. |

---

## 3. Wat werkt niet of heeft geen/onvolledige database?

### Geen database / geen persistentie

| Onderdeel | Situatie |
|-----------|----------|
| **Instellingen** | Pagina toont alleen “Binnenkort beschikbaar”. Geen API, geen tabel, geen opslag. (P4 — backlog) |
| ~~**AI Grading (als aparte flow)**~~ | ✅ **OPGELOST** — AI Grading beschikbaar als tab op /matching. Structured matching schrijft naar DB. |
| ~~**CV Beheer (als module)**~~ | ✅ **OPGELOST** — CV Analyse beschikbaar als tab op /matching. CV-upload schrijft kandidaat naar DB. |

### ~~Werkt niet of gedeeltelijk~~ → Opgelost

| Onderdeel | Situatie |
|-----------|----------|
| ~~**Striive scraping**~~ | ✅ **OPGELOST** — Playwright-gebaseerde scraper (local + webhook mode). Geen stub meer. |
| ~~**Cron per platform**~~ | ✅ **OPGELOST** — `isDue()` functie in Trigger.dev task checkt per-config `cronExpression` en `lastRunAt`. |
| ~~**Paginatie**~~ | ✅ **OPGELOST** — `parsePagination()` helper gebruikt in 6 API routes (opdrachten, kandidaten, sollicitaties, matches, interviews, berichten). |
| ~~**Scoring**~~ | ✅ **OPGELOST** — Hybride scoring: 60% rule-based (skills/locatie/tarief/rol) + 40% vector cosine similarity. |
| ~~**Kandidaat-embeddings**~~ | ✅ **OPGELOST** — Candidates tabel heeft `embedding` kolom (512-dim vector), net als jobs. |
| ~~**Zoeken**~~ | ✅ **OPGELOST** — `escapeLike()` voor ILIKE + full-text search via `to_tsvector('dutch', ...)` in services. |
| ~~**Sidebar**~~ | Bewust uitgesteld — Berichten bereikbaar via Chat en /messages route. |

### ~~Wel DB, maar aandachtspunten~~ → Opgelost

| Onderdeel | Situatie |
|-----------|----------|
| ~~**Chat-sessies**~~ | ✅ **OPGELOST** — Fire-and-forget met error logging. Fouten worden gelogd maar blokkeren chat niet. |
| ~~**Normalize upsert**~~ | ✅ **OPGELOST** — Enkele unique index op `(platform, externalId)`. `externalUrl` index is non-unique. |
| ~~**AI-enrichment**~~ | ✅ **OPGELOST** — `withRetry()` wrapper met exponential backoff (max 3 pogingen). |
| ~~**GDPR**~~ | ✅ **OPGELOST** — Kandidaten + contacten (scrub/export). Audit trail via `gdpr_audit_log` tabel. API routes: `/api/gdpr/contacten/export` en `/api/gdpr/contacten/verwijder`. |

---

## 4. Beads status — alle 146 gesloten

Alle 146 beads zijn gesloten (gemiddelde doorlooptijd: 3.0 uur). Enige resterende backlog-items:

- **Instellingen (Settings)** — P4: pagina is placeholder, geen backend. Bewust uitgesteld.
- **Berichten in sidebar** — Bewust uitgesteld; bereikbaar via /messages route.

---

## 5. Samenvatting voor de meeting

- **Instructies voor de AI** staan in **AGENTS.md** en **CLAUDE.md** (workflow, stack, conventies, beads).
- **Productbacklog/requirements** komen uit **PRD.md** en het **full implementation plan** in `docs/plans/`.
- **Alle 146 beads gesloten** — gemiddelde doorlooptijd 3.0 uur.
- **Volledig werkend met DB:** opdrachten, scraper (Playwright), kandidaten, matches (hybride scoring), sollicitaties, interviews, berichten, chat-sessies (met error logging), GDPR (kandidaten + contacten + audit trail), AI enrichment (met retry), paginatie (6 routes), full-text search (tsvector), zoeken (LIKE-escape), cron per platform, kandidaat-embeddings.
- **AI features:** AI Matching, AI Grading en CV Analyse als tabs onder /matching.
- **Enige openstaande items:** Instellingen-pagina (P4, placeholder) en Berichten-link in sidebar (bewust uitgesteld).

Dit document is bijgewerkt op **2026-03-04** en staat in **`docs/meeting-overzicht-ai-instructies-en-backlog.md`**.
