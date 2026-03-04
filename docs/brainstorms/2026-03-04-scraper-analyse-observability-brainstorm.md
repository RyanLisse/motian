# Scraper Analyse & Observability

**Datum:** 2026-03-04
**Status:** Brainstorm afgerond — klaar voor planning
**Aanleiding:** De huidige scraper-pagina toont alleen totaalcijfers (KPI-cards + tabel). De cijfers lijken niet te kloppen, er is geen trend-inzicht, errors zijn niet zichtbaar, en cross-platform duplicaten worden niet herkend.

---

## Wat we bouwen

Een stapsgewijze verbetering van scraper-observability in drie fasen:

### Fase 1: Cijfers fixen + basis-charts
- **Doel:** Betrouwbare cijfers en visuele trends
- Audit en fix van de `getAnalytics()` aggregatie-query
- Tijdlijn-chart: jobs gescraped per dag/week (area chart)
- Success rate over tijd per platform (line chart)
- Duration trend per platform (line chart)
- Per-platform vergelijkingstabel met ranking

### Fase 2: Error-analyse + job-niveau inzicht
- **Doel:** Begrijpen wat er fout gaat en wat er binnenkomt
- Error-details per scrape-run: parse `errors` jsonb, toon patronen
- Job-niveau overzicht: recent toegevoegde jobs, vervallen jobs, datakwaliteit-indicatoren
- Waarschuwingen bij anomalieën (bijv. 0 nieuwe jobs terwijl normaal 50+)

### Fase 3: Cross-platform duplicaat-detectie
- **Doel:** Dezelfde vacature op meerdere platforms herkennen en inzichtelijk maken
- **Strategie:** Twee-staps aanpak:
  1. **Snelle filter:** Fuzzy match op `title` (trigram similarity via `pg_trgm`) + exact match op `company`
  2. **Bevestiging:** Cosine similarity op bestaande 512-dim embeddings (pgvector `<=>` operator)
- Threshold configureerbaar via instellingen
- Tabel: welke vacatures staan op meerdere platforms, waar en hoe vaak
- Inzicht: welk platform als eerste plaatst, tariefverschillen per platform

---

## Waarom deze aanpak

- **Stapsgewijs** — elke fase levert direct waarde; geen big-bang
- **Bouwt op bestaande infra** — pgvector, pg_trgm, embeddings, scrape_results zijn er al
- **Titel+bedrijf als snelle filter** voorkomt O(n²) embedding-queries; cosine bevestigt alleen kandidaten
- **Recharts/shadcn charts** passen in de bestaande UI-stack (shadcn/ui + Tailwind)

---

## Belangrijke beslissingen

| Beslissing | Keuze | Reden |
|------------|-------|-------|
| Chart library | Recharts (shadcn/ui charts wrapper) | Al beschikbaar in het shadcn ecosysteem, React-native |
| Cross-platform dedup | Titel+bedrijf fuzzy → embedding cosine | Twee-staps: snel + accuraat |
| Scope | Stapsgewijs (3 fasen) | Direct waarde leveren, niet overcompliceren |
| Data-opslag duplicaten | Nieuwe `job_duplicates` tabel of jsonb op jobs | Beslissing in planfase |
| Trend-data | Query direct uit `scrape_results` met date_trunc | Geen aparte aggregatie-tabel nodig |

---

## Open vragen

- **Duplicaat-threshold:** Welke trigram similarity score (0.0-1.0) en cosine threshold? Start met 0.7 trigram + 0.90 cosine?
- **Duplicaat-tabel vs tag:** Aparte `job_duplicates` relatie-tabel of een `duplicate_group_id` kolom op jobs?
- **Historische charts:** Hoeveel dagen/weken terug? 30 dagen default?
- **Real-time:** Moeten charts auto-updaten via SSE of is refresh voldoende?
- **Datakwaliteit-score:** Hoe definiëren we "kwaliteit" van een gescrapete job? (bijv. % velden ingevuld)

---

## Bestaande infrastructuur

| Component | Status | Relevant voor |
|-----------|--------|---------------|
| `scrape_results` tabel | ✅ Bestaat | Fase 1: trend-data |
| `errors` jsonb kolom | ✅ Bestaat, niet gevisualiseerd | Fase 2: error-analyse |
| `jobs.embedding` (512-dim) | ✅ Bestaat | Fase 3: cosine similarity |
| pgvector extensie | ✅ Geïnstalleerd | Fase 3: vector queries |
| pg_trgm extensie | ❓ Moet gecontroleerd worden | Fase 3: trigram similarity |
| `getAnalytics()` service | ✅ Bestaat | Fase 1: audit + uitbreiden |
| SSE events | ✅ Bestaat | Optional: real-time charts |
| shadcn/ui | ✅ Geïnstalleerd | Alle fasen: UI components |

---

## Volgende stap

`/workflows:plan` — Begin met Fase 1 (cijfers fixen + basis-charts).
