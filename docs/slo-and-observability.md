# SLO's en observability (Fase 4)

Doel: voorspelbare kwaliteit en kosten; snelle detectie van regressie.

## 1. SLO-doelen (te valideren met data)

| Gebied        | Doel                                      | Error budget |
|---------------|-------------------------------------------|--------------|
| **Chat**      | p95 eerste token < 4s                     | 5% requests mag buiten SLO |
| **Search**    | p95 hybridSearch / listJobs < 800ms       | 5% requests mag buiten SLO |
| **CV-pipeline** | Eind-tot-eind < 90s, slagingspercentage > 95% | 5% |
| **Chat tokens** | Max ~50k tokens per sessie (kostenbeheersing) | N.v.t. (harde cap) |

Overschrijding error budget → prioriteit op stabiliteit i.p.v. nieuwe features.

## 2. Query-observability

- **Trage queries:** Logging van hybridSearch en listJobs duur (zie `src/services/jobs.search.ts`, `src/services/jobs.list.ts`). Bij duur > drempel (bijv. 800ms) wordt gelogd.
- **Drempels:** Search 800ms, list 500ms (configuratie via env of constanten).
- Optioneel: tracing (OpenTelemetry) of dashboard op basis van logs.

## 3. AI-budgetten

- **Hard budget:** Max tokens per chat-sessie. Stel `CHAT_MAX_TOKENS_PER_SESSION` (bijv. `50000`) in om het budget per sessie te begrenzen. Bij overschrijding: HTTP 429 + melding "Je sessie heeft het tokenbudget bereikt. Start een nieuw gesprek."
- **Tracking:** `chat_sessions.tokens_used` wordt na elke stream bijgewerkt met prompt + completion tokens.
- **Fallback:** Goedkopere modellen of kleinere context voor niet-kritieke paden waar mogelijk.

## 4. Regressietests

- **Search/ranking:** Golden set of snapshot-tests voor hybridSearch/listJobs zodat refactors geen stille gedragsregressie veroorzaken.
- In CI: regressietests voor search en matching draaien.

## 5. Client-side Web Vitals (Vercel Speed Insights)

Client-side Core Web Vitals monitoring is active via the `@vercel/speed-insights` package. The `<SpeedInsights />` component is rendered in `app/layout.tsx` (after `{children}`, inside `<body>`). It automatically reports the following metrics to the Vercel dashboard with zero configuration:

| Metric | Description |
|--------|-------------|
| **LCP** | Largest Contentful Paint — perceived load speed |
| **FID** | First Input Delay — interactivity responsiveness |
| **CLS** | Cumulative Layout Shift — visual stability |
| **INP** | Interaction to Next Paint — responsiveness (replaces FID in CWV 2024) |
| **FCP** | First Contentful Paint — time to first visible content |
| **TTFB** | Time to First Byte — server response time |

No extra configuration is required. Data is visible in the Vercel project dashboard under the **Speed Insights** tab after deploying.

## Definition of done Fase 4

- [x] SLO's en error budget gedocumenteerd (dit document)
- [x] Query-observability (logging/tracing) actief — `src/lib/query-observability.ts`; trage hybridSearch/listJobs worden gelogd
- [x] AI-budget of fallback geïmplementeerd — optioneel `CHAT_MAX_TOKENS_PER_SESSION` (env); `chat_sessions.tokens_used`; 429 + melding bij overschrijding
- [x] Regressietests voor search/ranking in CI — `tests/search-ranking-regression.test.ts`, `tests/query-observability.test.ts`
