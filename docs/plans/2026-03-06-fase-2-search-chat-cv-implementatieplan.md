---
title: "Fase 2 — jobs split, chat tool slicing, CV job-pipeline, zoekinput escaping"
type: plan
status: active
date: 2026-03-06
parent: docs/plans/2026-03-06-motian-optimalisatie-baseline-en-uitvoer-plan.md
---

# Fase 2 Implementatieplan — Search, Chat, CV

**Doel:** Minder DB-work en in-memory filtering; lagere chat-latency en -kosten; CV-pipeline robuuster.

**Definition of done:** (1) jobs opgesplitst in repository/search/filters/stats; (2) hybridSearch met minder roundtrips en meer SQL-filtering; (3) Chat tool slicing per route actief; (4) CV-pipeline als async jobs met SSE-status en fallback of feature flag; (5) Zoekinput escaping overal toegepast. Geen regressie op bestaande flows.

---

## 1. Zoekinput escaping (security, quick win)

**Rationale:** `escapeLike` bestaat in `src/lib/helpers.ts`; `jobs.ts` gebruikt het al in `searchJobsByTitle`. Alle paden die gebruikersinput in ILIKE of FTS stoppen moeten het consistent gebruiken (bead motian-d5v).

**Taken:**
- [x] Audit: grep op `ilike(`, `ILIKE`, `to_tsquery` en alle plekken waar zoek-/filterinput uit request/body komt.
- [x] In `src/services/jobs.ts`: controleren dat elke user-facing zoekstring via `escapeLike` (ILIKE) of `toTsQueryInput` (FTS) gaat; `listJobs` filterparams (platform, province, etc.) waar die uit query params komen escapen indien ze in LIKE/FTS terechtkomen.
- [x] In `src/services/candidates.ts` en andere services met zoekfuncties:zelfde regel toepassen.
- [x] **esco.ts** en **gdpr.ts**: ILIKE-patterns met gebruikersinput nu via `escapeLike` (rawSkill, identifier).
- [x] Unit test: `tests/helpers-escape-like.test.ts` — zoekinput met `%`, `_`, `\` geëscaped.

**Bestanden:** `src/services/jobs.ts`, `src/services/candidates.ts`, `src/lib/helpers.ts`, `tests/` (nieuwe test).

---

## 2. jobs.ts opsplitsen

_Status: afgerond._

**Rationale:** 507 regels in één bestand; CRUD, listing, filters, hybrid search en stats samen. Split verbetert leesbaarheid en maakt latere optimalisatie (minder roundtrips) eenvoudiger.

**Module-indeling:**
- **jobs.repository.ts** — CRUD: `getJobById`, `updateJob`, `updateJobEnrichment`, `deleteJob`. Alleen DB-access voor één job.
- **jobs.filters.ts** — Filter-normalisatie en -helpers: `normalizeJobStatusFilter`, `normalizeListJobsSortBy`, `deriveJobStatus`, sort/comparator helpers, `getSortComparator`. Geen DB.
- **jobs.stats.ts** — `getJobStats`, `getActivePipelineCount`. Queries voor aggregaties.
- **jobs.search.ts** — `searchJobsByTitle`, `searchJobs`, `hybridSearch`. Alle zoeklogica.
- **jobs.list.ts** (of blijft in jobs.ts) — `listJobs`, `listActiveJobs`. Paginering en listing.
- **jobs.ts** — Re-exporteert alles; of blijft als barrel en intern imports uit de nieuwe modules. API van jobs blijft hetzelfde (geen breaking changes voor aanroepers).

**Volgorde:**
1. Nieuwe bestanden aanmaken en functies verplaatsen (één module per keer: repository → filters → stats → search → list).
2. `jobs.ts` aanpassen: imports uit nieuwe modules, re-exports. Bestaande imports in de codebase (`from "@/src/services/jobs"`) blijven werken.
3. Tests laten groen blijven; bestaande tests in `tests/*.test.ts` die jobs service gebruiken blijven ongewijzigd of worden alleen import-pad geüpdatet indien nodig.

**Afhankelijkheid:** Zoekinput escaping (sectie 1) kan vóór of tijdens de split; bij verplaatsen van `searchJobsByTitle` / `hybridSearch` naar `jobs.search.ts` escaping daar afdwingen.

---

## 3. hybridSearch optimalisatie (minder roundtrips)

_Status: afgerond, benchmarkstap nog optioneel open._

**Rationale:** Huidige flow: tekst + vector parallel, fetchSize = limit*3, post-filter in memory, daarna extra DB-roundtrip voor vector-only IDs. Doel: gefilterde IDs direct uit DB, join in één of minder roundtrips.

**Taken:**
- [x] In `jobs.search.ts` (na split): filter-condities (platform, province, rate, etc.) zoveel mogelijk naar SQL verplaatst via één gefilterde candidate-fetch over alle RRF-IDs.
- [x] Aparte roundtrip voor "vector-only" resultaten verwijderd: alle unieke IDs uit RRF worden nu in één batch opgehaald met filters.
- [ ] Benchmark na wijziging: `pnpm benchmark:hybrid-search` en resultaat vergelijken met baseline.

**Bestanden:** `src/services/jobs.search.ts` (na split), `src/services/embedding.ts` (indien filter-ondersteuning).

---

## 4. Chat: tool slicing per route

_Status: afgerond, prompt-cache blijft optioneel._

**Rationale:** Elke request krijgt nu de volledige `recruitmentTools`; op contexten zoals `/opdrachten` zijn kandidaat-, GDPR- en interviewtools overbodig. Minder tools = minder tokens en minder model-twijfel.

**Taken:**
- [x] In `src/ai/agent.ts`: tools gegroepeerd in contextuele sets (`opdrachtTools`, `kandidaatTools`, `matchTools`, `sollicitatieTools`, `interviewTools`, `berichtTools`, `gdprTools`) plus `getRecruitmentTools(context)`.
- [x] In `app/api/chat/route.ts`: op basis van `ctx.route` of `ctx.entityType` de juiste subset tools kiezen via `getRecruitmentTools(ctx)`.
- [x] Geen breaking change: bestaande clients zonder context krijgen de volledige `recruitmentTools` als default.
- [ ] Optioneel: cache voor onderdelen van `buildSystemPrompt()` die niet per request variëren (bijv. capability-lijst, workspace-info). Kan in een latere iteratie.

**Bestanden:** `src/ai/agent.ts`, `app/api/chat/route.ts`.

---

## 5. Chat: history-samenvatting (optioneel in Fase 2)

**Rationale:** Nu tot 50 berichten opgeslagen en waarschijnlijk allemaal meegestuurd; oudere context samenvatten vermindert tokens.

**Taken:**
- [ ] Beleid: bijv. laatste N berichten voluit (bijv. 10), oudere als één samenvatting (via AI-summary of vaste template).
- [ ] Implementatie in `app/api/chat/route.ts` of in `buildSystemPrompt`: voor het opbouwen van `messages` de opgeslagen sessie ophalen, oudere berichten samenvatten, alleen recente + samenvatting meesturen.
- [ ] Kan uitgesteld worden als tool slicing al voldoende winst geeft.

---

## 6. CV-analyse: job-gebaseerde pipeline

_Status: kernpad afgerond via Trigger-task + status-endpoint; verdere UI-integratie kan hierop voortbouwen._

**Rationale:** Huidige flow: upload → parse → dedupe → enrich → match in één request met maxDuration 60. Eén lange polonaise; timeout-gevoelig. Doel: aparte Trigger-tasks per stap, SSE voor status, idempotency per stap.

**Hoofdkeuze:** Elke stap = aparte Trigger task, of één orchestrator-task die sub-stappen aanroept met idempotency keys. Plan: **één orchestrator-task** die intern stappen aanroept (of inline uitvoert) maar status per stap naar DB/SSE schrijft; later kunnen stappen naar aparte tasks als nodig.

**Taken:**
- [x] Nieuwe Trigger task: `cv-analysis-pipeline` met payload `{ fileUrl, fileName, mimeType, fileHash, sessionId? }`. Stappenstatus wordt in Trigger metadata bijgehouden; route gebruikt `cv-${fileHash}-pipeline` als idempotency key.
- [x] `POST /api/cv-analyse` ondersteunt nu `?async=1`: start de Trigger task en retourneert `{ runId, statusUrl }`. Bestaande sync-SSE flow blijft intact als fallback.
- [x] CV-hash: bij async upload wordt een SHA-256 hash berekend en gebruikt als idempotency key voor de pipeline.
- [x] Tussenresultaten: stapstatus, grade-info en kandidaat/match-summary worden in Trigger metadata en task output bewaard voor polling en afronding.

**Bestanden:** `trigger/` (nieuwe task), `app/api/cv-analyse/route.ts`, eventueel `app/api/cv-analyse/status/route.ts` voor SSE/polling.

---

## Uitvoerorde aanbevolen

1. **Zoekinput escaping** (sectie 1) — klein, security, geen grote refactor.
2. **jobs.ts opsplitsen** (sectie 2) — mechanische split, daarna optimalisatie eenvoudiger.
3. **hybridSearch optimalisatie** (sectie 3) — na split in jobs.search.ts.
4. **Chat tool slicing** (sectie 4) — onafhankelijk, kan parallel na 1.
5. **CV job-pipeline** (sectie 6) — grootste wijziging; feature flag of parallelle route.
6. **Chat history-samenvatting** (sectie 5) — optioneel, na tool slicing.

---

## Referenties

- Uitvoerplan: `docs/plans/2026-03-06-motian-optimalisatie-baseline-en-uitvoer-plan.md`
- Unified search: `docs/plans/2026-03-06-refactor-unified-vacature-search-parity-plan.md`
- Helpers: `src/lib/helpers.ts` (`escapeLike`, `toTsQueryInput`)
