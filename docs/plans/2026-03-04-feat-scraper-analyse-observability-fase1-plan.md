---
title: "feat: Scraper Analyse & Observability — Fase 1"
type: feat
date: 2026-03-04
brainstorm: docs/brainstorms/2026-03-04-scraper-analyse-observability-brainstorm.md
---

# Scraper Analyse & Observability — Fase 1: Cijfers fixen + Basis-charts

## Overview

De huidige `/scraper` pagina toont KPI-cards en een geschiedenistabel, maar:
- De gemiddelde duur is fout berekend (average of averages)
- Er zijn geen tijdlijn-grafieken — alleen totaalcijfers over alle tijd
- Geen datumbereik-filtering
- Error-details uit scrape-runs zijn niet zichtbaar
- Trigger.dev taakstatus is onzichtbaar
- Alles hierboven maakt het onmogelijk om te begrijpen wat er werkelijk gebeurt

## Problem Statement

De `getAnalytics()` functie in `src/services/scrape-results.ts:52-93` bevat twee bugs:

1. **`avgDurationMs` (regel 87-89)**: Berekent het gemiddelde van gemiddelden i.p.v. een gewogen gemiddelde. Platform A met 100 runs à 5s en Platform B met 2 runs à 10s geeft `(5+10)/2 = 7.5s` in plaats van het juiste ~5.1s.

2. **`totalUniqueJobs` subquery (regel 64)**: Draait dezelfde `SELECT count(*) FROM jobs WHERE deleted_at IS NULL` subquery in elke `GROUP BY` rij, maar het resultaat wordt slechts één keer gebruikt (regel 70). Verspild maar niet incorrect.

Daarnaast ontbreekt elke vorm van time-series analyse: geen datum-filtering, geen groepering per dag/week, geen trends.

## Proposed Solution

### Deel A: Bugs fixen in `getAnalytics()`

**Bestand:** `src/services/scrape-results.ts`

**Fix 1 — Gewogen gemiddelde duur:**
```typescript
// VOOR (regel 87-89) — average of averages:
avgDurationMs: byPlatform.length > 0
  ? Math.round(byPlatform.reduce((s, p) => s + p.avgDurationMs, 0) / byPlatform.length)
  : 0,

// NA — weighted average:
avgDurationMs: totalRuns > 0
  ? Math.round(
      byPlatform.reduce((s, p) => s + p.avgDurationMs * p.totalRuns, 0) / totalRuns
    )
  : 0,
```

**Fix 2 — Verplaats `totalUniqueJobs` naar aparte query:**
```typescript
// Verwijder subquery uit GROUP BY query (regel 64)
// Voeg toe als aparte query in getAnalytics():
const [{ count }] = await db
  .select({ count: sql<number>`count(*)::int` })
  .from(jobs)
  .where(isNull(jobs.deletedAt));
```

### Deel B: Nieuwe `getTimeSeriesAnalytics()` functie

**Bestand:** `src/services/scrape-results.ts`

Nieuwe functie die scrape-resultaten groepeert per dag of week:

```typescript
export type TimeSeriesPoint = {
  date: string;           // "2026-03-01"
  platform: string;
  jobsFound: number;
  jobsNew: number;
  duplicates: number;
  successCount: number;
  failedCount: number;
  totalRuns: number;
  avgDurationMs: number;
};

export type GetTimeSeriesOptions = {
  startDate?: Date;       // default: 30 dagen geleden
  endDate?: Date;         // default: vandaag
  platform?: string;      // optioneel: filter op platform
  groupBy?: "day" | "week"; // default: "day"
};
```

**SQL-strategie:** `date_trunc('day', run_at)` met `GROUP BY (date, platform)`. De `runAt` index op `scrape_results` ondersteunt dit efficiënt.

### Deel C: Nieuw API-endpoint

**Bestand:** `app/api/scraper-analyse/route.ts` (NEW)

```
GET /api/scraper-analyse?startDate=2026-02-01&endDate=2026-03-04&platform=striive&groupBy=day
```

**Query params:**
| Param | Type | Default | Beschrijving |
|-------|------|---------|-------------|
| `startDate` | ISO date | 30 dagen geleden | Begin datum |
| `endDate` | ISO date | vandaag | Eind datum |
| `platform` | string | alle | Filter op platform |
| `groupBy` | `day` \| `week` | `day` | Groepering |

**Response:** `{ data: TimeSeriesPoint[] }`

### Deel D: Drie Recharts-charts op `/scraper`

Drie nieuwe client-componenten, gerenderd in een Tabs container onder de KPI-cards:

#### 1. `components/scraper/jobs-timeline-chart.tsx`
- **Type:** Stacked AreaChart
- **X-as:** Datum
- **Y-as:** Aantal jobs
- **Series:** jobsNew (groen), duplicates (amber), jobsFound (grijs, achtergrond)
- **Interactie:** Tooltip met datum + waarden

#### 2. `components/scraper/success-rate-chart.tsx`
- **Type:** LineChart met meerdere lijnen
- **X-as:** Datum
- **Y-as:** Percentage (0-100%)
- **Series:** Eén lijn per platform (kleur per platform)
- **Referentielijn:** 80% threshold (stippellijn)

#### 3. `components/scraper/duration-chart.tsx`
- **Type:** LineChart
- **X-as:** Datum
- **Y-as:** Duur (seconden)
- **Series:** Eén lijn per platform

#### Chart wrapper: `components/scraper/analytics-charts.tsx`
- Client component ("use client")
- Tabs: "Vacatures" | "Slagingspercentage" | "Duur"
- Date range selector (7d / 14d / 30d / 90d preset buttons)
- Fetcht data van `/api/scraper-analyse` met geselecteerd datumbereik
- Loading skeleton state

### Deel E: Trigger.dev taakstatus

**In de KPI-cards of als apart blok op de pagina:**
- Laatste uitvoering: datum + tijd + resultaat
- Volgende geschedulde uitvoering: berekend uit cron `0 */4 * * *` + timezone
- Per platform: `isDue()` status, `consecutiveFailures` count

**Implementatie:** Lees `scraperConfigs` (bevat al `lastRunAt`, `lastRunStatus`, `consecutiveFailures`, `cronExpression`) en bereken `nextRunAt` in de page component.

### Deel F: Datumbereik-picker

Preset-buttons (geen datepicker component nodig):
```
[7d] [14d] [30d] [90d]
```
Geselecteerde waarde bepaalt `startDate` voor de API-call. Client-side state.

---

## Acceptance Criteria

### Functioneel
- [ ] `avgDurationMs` in KPI-card toont correct gewogen gemiddelde
- [ ] `totalUniqueJobs` query is efficiënt (aparte query, niet in GROUP BY)
- [ ] Tijdlijn-chart toont jobs per dag/week met stacked areas
- [ ] Success-rate chart toont per-platform lijnen met 80% referentielijn
- [ ] Duur-chart toont per-platform trends
- [ ] Datumbereik-selector werkt (7d/14d/30d/90d)
- [ ] Trigger.dev status zichtbaar: laatste run, volgende run, per-platform status
- [ ] Charts tonen loading skeleton tijdens fetch
- [ ] Charts zijn responsive (mobile: horizontaal scrollbaar of gestapeld)

### Technisch
- [ ] Nieuwe API-route `/api/scraper-analyse` met Zod validatie
- [ ] Bestaande `getAnalytics()` bugs gefixt
- [ ] Nieuwe `getTimeSeriesAnalytics()` functie met tests
- [ ] Biome lint passeert
- [ ] Next.js build slaagt

---

## File Changes

| Bestand | Actie | Beschrijving |
|---------|-------|-------------|
| `src/services/scrape-results.ts` | MODIFY | Fix bugs + add `getTimeSeriesAnalytics()` |
| `src/schemas/scraper-analyse.ts` | NEW | Zod schema voor API query params |
| `app/api/scraper-analyse/route.ts` | NEW | GET endpoint voor time-series data |
| `components/scraper/analytics-charts.tsx` | NEW | Client wrapper met Tabs + date picker |
| `components/scraper/jobs-timeline-chart.tsx` | NEW | Stacked area chart |
| `components/scraper/success-rate-chart.tsx` | NEW | Multi-line chart |
| `components/scraper/duration-chart.tsx` | NEW | Duration line chart |
| `app/scraper/page.tsx` | MODIFY | Voeg charts + trigger status toe |

---

## Edge Cases

- **Geen scrape data:** Charts tonen "Nog geen data" empty state
- **Slechts 1 platform:** Charts vereenvoudigen naar single-line (geen legenda nodig)
- **Extreem korte periode (1 dag):** Groepering per uur of toon enkele punten
- **Null durationMs:** Uitsluiten uit duur-aggregatie (`COALESCE` / `FILTER`)
- **Platform zonder recente runs:** Toon in legenda maar met "geen data" indicator
- **Timezone:** `runAt` is UTC in DB; weergave in `Europe/Amsterdam` (nl-NL locale)

---

## References

- Bug locatie: `src/services/scrape-results.ts:87-89` (avgDurationMs), `:64` (subquery)
- Bestaande chart pattern: `components/matching/criteria-breakdown-chart.tsx`
- Chart colors: `app/globals.css:27-31` (oklch variabelen `--chart-1` t/m `--chart-5`)
- Recharts: al geïnstalleerd (`package.json:73`, `recharts@^3.7.0`)
- Scraper pagina: `app/scraper/page.tsx` (308 regels)
- Trigger.dev task: `trigger/scrape-pipeline.ts` (cron: `0 */4 * * *`, timezone: Europe/Amsterdam)
- Brainstorm: `docs/brainstorms/2026-03-04-scraper-analyse-observability-brainstorm.md`
