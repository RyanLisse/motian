# Planstatus — wat ontbreekt (2026-03-06)

Korte checklist tegen de plannen; bijgewerkt na Fase 3 en Fase 4.

---

## Hoofdplan: `2026-03-06-motian-optimalisatie-baseline-en-uitvoer-plan.md`

### Fase 1 — Baseline en quick wins

| Item | Status | Opmerking |
|------|--------|-----------|
| Baseline metrics vastgelegd in versioned artefact | **Gereed** | `docs/metrics/baseline-2026-03-06.md` aangemaakt (Node, datum; build-tijd via script invullen). |
| hybridSearch-benchmark reproduceerbaar | **Open** | Geen `pnpm benchmark:hybrid-search` of vastgelegde benchmark-suite. |
| CORS-fix (alle origins uit ALLOWED_ORIGINS) | **Gereed** | `proxy.ts`: allowlist-check per request, `getAllowedOrigin(request)` gebruikt alle entries. |
| Coverage-stap in CI | **Gereed** | `.github/workflows/ci.yml`: `pnpm test:coverage` + upload artifact. |
| AI-cost logging gedocumenteerd/actief | **Deels** | Chat: token usage in DB (`tokens_used`) voor budget; geen aparte structured cost-log (chat/CV/embedding) voor analytics. Zie `docs/metrics/README.md`. |

**DoD Fase 1:** (1) Baseline-artefact ontbreekt; (2) CORS ✅; (3) Coverage ✅; (4) Benchmark open; (5) AI-cost logging deels (DB bij chat, geen algemene cost-log).

---

### Fase 2 — Search, chat, CV

| Item | Status |
|------|--------|
| jobs opgesplitst (repository/search/filters/stats) | **Gereed** |
| hybridSearch minder roundtrips, meer SQL-filtering | **Gereed** |
| Chat tool slicing per route | **Gereed** |
| CV-pipeline async jobs + SSE-status / fallback | **Gereed** |
| Zoekinput escaping overal | **Gereed** |

**DoD Fase 2:** Voldaan. Optioneel open: hybridSearch-benchmark run, prompt-cache, chat history-samenvatting (zie Fase 2-implementatieplan).

---

### Fase 3 — Workspace en packages

| Item | Status |
|------|--------|
| pnpm workspace | **Gereed** |
| packages/db, packages/esco, packages/scrapers | **Gereed** |
| packages/ai | **Uitgesteld** (complexe afhankelijkheden) |
| apps/web als aparte app | **Nee** — app blijft in root; packages geëxtraheerd. |

**DoD Fase 3:** Workspace + db/esco/scrapers gedaan; build/tests groen.

---

### Fase 4 — SLO’s en observability

| Item | Status |
|------|--------|
| SLO’s en error budget gedocumenteerd | **Gereed** — `docs/slo-and-observability.md` |
| Query-observability (trage queries loggen) | **Gereed** — `src/lib/query-observability.ts`, hybridSearch/listJobs |
| AI-budget of fallback | **Gereed** — `CHAT_MAX_TOKENS_PER_SESSION`, `chat_sessions.tokens_used`, 429-melding |
| Regressietests search/ranking in CI | **Gereed** — `tests/search-ranking-regression.test.ts`, `tests/query-observability.test.ts` |

**DoD Fase 4:** Voldaan.

---

## Fase 2-implementatieplan: `2026-03-06-fase-2-search-chat-cv-implementatieplan.md`

| Sectie | Nog open (optioneel) |
|--------|----------------------|
| 3. hybridSearch optimalisatie | Benchmark na wijziging: `pnpm benchmark:hybrid-search` + vergelijking met baseline. |
| 4. Chat tool slicing | Optioneel: cache voor onderdelen van `buildSystemPrompt()`. |
| 5. Chat history-samenvatting | Beleid + implementatie (laatste N voluit, oudere samenvatten); kan uitgesteld. |

---

## Unified vacature search: `2026-03-06-refactor-unified-vacature-search-parity-plan.md`

**Status:** Phase 1 + Phase 2 gedaan.

- **Phase 1:** `searchJobsUnified(opts)` in `src/services/jobs.ts`; types `UnifiedJobSearchOptions` (incl. company, category, status voor list) en `UnifiedJobSearchResult`; service-tests in `tests/unified-search.test.ts`.
- **Phase 2:** Alle adapters gebruiken nu `searchJobsUnified`: `GET /api/opdrachten`, `GET /api/opdrachten/zoeken` (dunne adapter), chat tool `query-opdrachten`, MCP `zoek_vacatures`, voice-agent zoek-opdrachten, CLI `vacatures:zoek`. Zelfde input op alle surfaces → zelfde volgorde/resultaat.

---

## Aanbevolen volgorde “wat nu”

1. **Baseline-artefact (Fase 1):** Draai `pnpm tsx scripts/baseline-metrics.ts`, bewaar `docs/metrics/baseline-YYYY-MM-DD.md`; vul desnoods handmatig aan met API/DB/Trigger/AI (zie README daar).
2. **Unified search Phase 1:** Eén gedeeld search-contract in jobs, adapters later migreren (Phase 2).
3. **Optioneel:** hybridSearch-benchmark script, prompt-cache, of chat history-samenvatting als er tijd is.

---

## Referenties

- Hoofdplan: `docs/plans/2026-03-06-motian-optimalisatie-baseline-en-uitvoer-plan.md`
- Fase 2-detail: `docs/plans/2026-03-06-fase-2-search-chat-cv-implementatieplan.md`
- Unified search: `docs/plans/2026-03-06-refactor-unified-vacature-search-parity-plan.md`
- SLO/observability: `docs/slo-and-observability.md`
- Metrics: `docs/metrics/README.md`
