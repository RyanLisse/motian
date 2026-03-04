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
  - **Huidige open beads (20)** — zie sectie 3 hieronder
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
| **Matches** | ✅ Gedeeltelijk | job_matches: structured matching API schrijft weg. Matching-pagina; goedkeuren/afwijzen via API. |
| **Sollicitaties (applications)** | ✅ Lezen + schrijven | applications table. API + pipeline-pagina. |
| **Interviews** | ✅ Lezen + schrijven | interviews table. API (GET/POST/PATCH). Interviews-pagina. |
| **Berichten** | ✅ Lezen + schrijven | messages table. Service createMessage; API /api/berichten. Messages-pagina leest uit DB. |
| **Chat-sessies** | ✅ Schrijven (fire-and-forget) | chat_sessions: wordt gevuld in chat-route; faalt niet als persistence faalt. |
| **Reports** | ✅ Alleen lezen | Genereert rapport uit bestaande match (geen extra persistentie). |
| **Striive scraping** | ⚠️ Stub | scrapeViaModal is stub; Motian-n38: echte scraping moet via Modal (niet Vercel). |
| **Instellingen** | ❌ Alleen UI | Settings-pagina: lege “Binnenkort beschikbaar”-state, geen backend/DB. |
| **AI Grading / CV Beheer** | ❌ Ontbreekt | In sidebar als tab/links; geen aparte “CV Beheer”- of “AI Grading”-pagina’s met eigen flows. |

---

## 3. Wat werkt niet of heeft geen/onvolledige database?

### Geen database / geen persistentie

| Onderdeel | Situatie |
|-----------|----------|
| **Instellingen** | Pagina toont alleen “Binnenkort beschikbaar”. Geen API, geen tabel, geen opslag. |
| **AI Grading (als aparte flow)** | Matching + structured match schrijven wel naar DB; “AI Grading” als aparte feature met eigen opslag ontbreekt. |
| **CV Beheer (als module)** | CV-upload + save schrijven kandidaat naar DB; er is geen aparte “CV Beheer”-module met eigen persistentie. |

### Werkt niet of gedeeltelijk

| Onderdeel | Situatie |
|-----------|----------|
| **Striive scraping** | `scrapeViaModal` is stub. Echte scraping zou via Modal moeten (bead motian-n38); op Vercel niet bruikbaar. |
| **Cron per platform** | Cron negeert per-platform `cronExpression` in DB (motian-uml); één globale cron. |
| **Paginatie** | Nergens geïmplementeerd (motian-o5g); risico op full table scans. |
| **Scoring** | Alleen rule-based (keyword); geen echte semantic/vector matching (motian-scy). |
| **Kandidaat-embeddings** | Alleen jobs hebben embeddings; candidates niet (motian-cyf) → vector matching voor kandidaten onmogelijk. |
| **Zoeken** | LIKE-wildcards niet geëscaped (motian-d5v); geen full-text tsvector/GIN (motian-392). |
| **Sidebar** | Geen directe link naar “Berichten”/Messages (wel Interviews onder Kandidaten) (motian-55q). |

### Wel DB, maar aandachtspunten

| Onderdeel | Situatie |
|-----------|----------|
| **Chat-sessies** | Worden weggeschreven maar fire-and-forget; bij fout merkt gebruiker niets, sessie kan ontbreken. |
| **Normalize upsert** | Twee unique constraints (platform+externalId en platform+externalUrl); risico op conflicten (motian-572). |
| **AI-enrichment** | Geen retry (motian-6ad). |
| **GDPR** | Alleen kandidaten; contacten niet meegenomen, geen audit trail (motian-bxq). |

---

## 4. Open beads (AGENTS.md) — korte referentie

- **P0:** motian-n38 — Modal scraping stub (Striive).
- **P1:** motian-scy (scoring), motian-o5g (paginatie), motian-uml (cron per platform).
- **P2:** o.a. motian-m4a (SSE), motian-572 (dual unique), motian-6ad (retry), motian-bxq (GDPR), motian-cyf (candidate embeddings), motian-d5v (LIKE escape), motian-u4c/k2q (UI-components).
- **P3:** o.a. motian-ocy (proxy), motian-u3r (platformlijst), motian-clg (monitoring), motian-392 (full-text), motian-55q (sidebar), motian-z9l (query waterfall).
- **P4:** motian-1ng — Ontbrekende features (AI Grading, CV Beheer, Settings).

---

## 5. Samenvatting voor de meeting

- **Instructies voor de AI** staan in **AGENTS.md** en **CLAUDE.md** (workflow, stack, conventies, beads).
- **Productbacklog/requirements** komen uit **PRD.md** en het **full implementation plan** in `docs/plans/`.
- **Wel DB en grotendeels werkend:** opdrachten, scraper, kandidaten, matches (structured), sollicitaties, interviews, berichten, chat-sessies (met caveat).
- **Geen of nauwelijks DB/persistentie:** Instellingen; AI Grading/CV Beheer als aparte modules.
- **Niet of gedeeltelijk werkend:** Striive (stub), cron per platform, paginatie, semantic scoring, kandidaat-embeddings, zoeken (escaping/full-text), sidebar Berichten.

Dit document staat in **`docs/meeting-overzicht-ai-instructies-en-backlog.md`** en kan zo in de meeting worden gebruikt.
