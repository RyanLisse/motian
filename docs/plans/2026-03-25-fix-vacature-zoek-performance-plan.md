---
title: fix: Improve vacature search performance and request efficiency
type: fix
status: active
date: 2026-03-25
---
---

# fix: Improve vacature search performance and request efficiency

## Overview

Vacature-zoek en lijstweergave zijn in de huidige stack te traag door dure querypatronen, gebrek aan paginatie op meerdere routes, en teveel onnodige UI-verzoeken. Dit plan richt zich op indexvriendelijke zoekpaden, eenduidige paginatie, en vermindering van request-churn.

## Problem Statement / Motivation

- Jobs search bouwt tekst-indexen deels runtime, waardoor indexoptimalisaties minder voorspelbaar zijn.
- De gecombineerde zoekpad-keuze (hybrid) wordt nog te uniform ingezet.
- Open issue motian-o5g (geen pagination) verhoogt latentie op lijst- en zoekroutes.
- Filterverwerking bevat dure stukken in query-filters.ts, inclusief JSONB- en ESCO-subquerypatronen.
- UI stuurt extra requests uit snelle slider- en filterwijzigingen.
- Dedupe en pipeline-samenvattingen gebeuren niet altijd op de kleinste noodzakelijke set.

## Stakeholder Analysis

- Eindgebruikers: snellere respons op vacatures-zoek.
- Recruiters: stabielere resultaten bij complexe filters.
- Developers: voorspelbare query-routing en minder regressies.
- Operations: lagere DB- en applicatiebelasting.

## Proposed Solution

### High-level approach

1. Meet eerst: label querypaden en verzamel baseline metrics.
2. Implementeer consistente paginatie en inputsanitatie.
3. Optimaliseer zware querypaden naar indexvriendelijke patronen.
4. Reduceer UI-request-churn met debounce en abort.
5. Voeg korte-caching toe voor herhalende summary-requests.

## Technical Considerations

- Betrokken bestanden:
  - src/services/jobs.ts
  - src/services/jobs/search.ts
  - src/services/jobs/list.ts
  - src/services/jobs/query-filters.ts
  - src/services/jobs/deduplication.ts
  - src/lib/query-observability.ts
  - components/opdrachten-sidebar.tsx
  - app/opdrachten/layout.tsx
- Migrations in packages/db/drizzle/0004_add_fulltext_search.sql en .../0015_job_search_dedupe_foundation.sql.
- Security: wildcard escaping in LIKE/ILIKE (motian-d5v).
- Performance: onderscheid text-only versus hybrid in logging en routing.

## System-Wide Impact

### Interaction Graph

1. Sidebar/filter verandert state (components/opdrachten-sidebar.tsx).
2. Route-laag roept zoekservice aan (app/opdrachten/page.tsx, app/opdrachten/layout.tsx -> src/services/jobs.ts).
3. Search routing beslist tussen text-only en hybrid (src/services/jobs/search.ts).
4. Filtercondities uit query-filters.ts en dedupe uit deduplication.ts bepalen einddataset.
5. React-render toont resultaten en pipeline summary (app/opdrachten/layout.tsx).

### Error Propagation

- Embedding-fout -> fallback naar tekstpad.
- SQL-fout in dedupe -> log + gecontroleerde foutmelding, geen stil falen.
- Ongeldige filterinput -> sanitize en valideer vroeg.

### State Lifecycle Risks

- Paginatiefouten kunnen dubbele/ontbrekende records veroorzaken.
- Aggressive dedupe-wijziging kan volgorde beïnvloeden.
- Caching van summaries kan stale data tonen.

### API Surface Parity

- Behoud vergelijkbare beslissingen in gerelateerde paden zoals src/services/candidates.ts.

### Integration Test Scenarios

- Tekstquery korte term: text-only pad met paginatie + stable total.
- Lange semantische query: hybrid pad met fallback op embedding-fout.
- Snelle slider updates: alleen laatste request levert resultaat.
- Gecombineerde filters + categories/ESCO: consistente output.
- Lege of problematische input: binnen SLO gecontroleerd gedrag.

## Alternative Approaches Considered

1. Hybrid voor alle queries.
   - Verworpen: onnodig duur bij korte termen.
2. Nieuwe search-service in één keer.
   - Verworpen: te groot migratierisico.
3. Alleen frontend debounce.
   - Verworpen: beperkt effect zonder backendoptimalisatie.

## Implementation (A LOT)

### Phase 1 — Stabiliseren en meten (1 tot 3 dagen)

- [x] Label querypaden in src/lib/query-observability.ts
  - text-only, hybrid, hybrid-fallback, list, list-fts.
- [ ] Baseline explain plans vastleggen voor hoofdquery uit src/services/jobs/search.ts.
- [x] Uniforme paginatie op alle relevante lijst/search entrypoints in src/services/jobs.ts en src/services/jobs/list.ts.
- [x] Wildcard escaping in src/services/jobs/search.ts en src/services/candidates.ts.

### Phase 2 — Querypath optimalisatie (2 tot 5 dagen)

- [x] Herzie searchJobIdsByTitle op indexvriendelijkheid; beperk runtime to_tsvector/to_tsquery gebruik.
  - Switched to pre-populated `searchText` column; added GIN index migration (0019).
- [x] Introduceer hybrid-routing policy:
  - korte query: text-only
  - lange semantische query: hybrid met fallback.
  - Already implemented via hybrid-search-policy.ts with env-flag rollout.
- [ ] Vereenvoudig dedupe voor kleinere dataset in memory, met deterministic tie-break.

### Phase 3 — UI request-churn reductie (1 tot 3 dagen)

- [x] Debounce slider- en rangefilters naast zoekveld.
  - Tarief sliders already use useDeferredValue (verified adequate).
- [x] Cancel oude requests bij snelle wijzigingen.
  - Added AbortController signal to searchJobs fetch + React Query queryFn.
- [ ] Versimpel query keys naar stabiele waarden.
- [ ] Minimaliseer per-render werk in app/opdrachten/layout.tsx; cache summary met korte TTL.

### Phase 4 — Indexen en hardening (parallel)

- [x] Review ontbrekende indexen op categorie, deletion-filter en sorteer-/filterkolommen.
  - Added GIN index on categories JSONB + tsvector in drizzle/0019_add_search_gin_indexes.sql.
- [ ] Meet p95/p99 per querypad en monitor regressies.

## Acceptance Criteria

### Functional

- [ ] Alle relevante routes hebben vaste paginatie met geldige limit/offset.
- [ ] Wildcard input is veilig ontsmet.
- [ ] Routing policy text-only/hybrid is voorspelbaar en gedocumenteerd.
- [ ] Dedupe levert stabiele resultaten.

### Non-Functional

- [ ] Search p95 richting < 800ms, target < 400ms.
- [ ] List p95 richting < 500ms.
- [ ] Minder dan 1 op 100 UI-interacties leidt tot stale-resultaat race.

### Quality Gates

- [ ] Unit/integratie tests voor paginatie, sanitization, query routing en dedupe.
- [ ] Observability dashboards tonen querypath labels en foutpercentages.
- [ ] Geen afwijking in Nederlandse routeconventies of API contracten.

## Success Metrics

- Search p95 onder 800 ms binnen 2 weken.
- Verzoekvolume bij snelle filterwijzigingen minimaal 30 procent lager.
- Meetbare daling in DB CPU p95 per search request.

## Dependencies & Risks

- Indexmigraties moeten veilig draaien.
- Logging is nodig om routing regressies te detecteren.
- Fouten in abort/debounce kunnen timing-problemen geven.

## Risk Mitigation

- Feature-flagged rollout van routing policy.
- Gefaseerde invoering met SLO checks per fase.
- Duidelijk rollback pad per fase.

## Documentation Plan

- Update planning/docs indien routingregels of indexkeuzes veranderen.
- Zet runbook uit met queryplan checks en fallback gedrag.

## Sources & References

### Internal References

- docs/architecture.md
- docs/plans/2026-03-06-refactor-unified-vacature-search-parity-plan.md
- src/services/jobs/search.ts
- src/services/jobs.ts
- src/services/jobs/query-filters.ts
- src/services/jobs/deduplication.ts
- components/opdrachten-sidebar.tsx
- app/opdrachten/layout.tsx
- src/lib/query-observability.ts
- packages/db/drizzle/0004_add_fulltext_search.sql
- packages/db/drizzle/0015_job_search_dedupe_foundation.sql
- Open issues: motian-o5g, motian-d5v

### External References

- Geen externe bronnen in dit plan; lokale repository-informatie voldoende.
