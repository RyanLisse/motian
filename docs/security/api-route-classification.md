# API route classification

Generated from `app/api/**/route.ts` while hardening the API trust boundary. Keep this
document in sync when adding routes or moving routes between public, first-party-browser,
and service-bearer access. The structural test `tests/api-route-classification.test.ts`
fails when a route file is missing from this ledger, or when a `public` row is absent from
`PUBLIC_PATHS` / `PUBLIC_GET_PATHS` in `proxy.ts`.

**Auth model (user override):** Motian is an internal app with **no login UI**. Non-public
routes admit callers only via server-verifiable `Authorization: Bearer ${API_SECRET}`.
Browser clients must not hold the secret — first-party UI reaches APIs through
`/bff/*` (same-origin catch-all that attaches the bearer), Server Components,
Server Actions, or other BFF/server handlers. Prefer `apiFetch` from
`src/lib/client-api.ts` over raw `fetch("/api/...")`.
Origin / Sec-Fetch-Site remain CSRF isolation only, never admission.

**Owner** is the team accountable for the surface. **Enforced by** is the route-local
`requirePrincipal` / `withApiHandler` check (WP2). The proxy is a pre-filter only.

| Route | Classification | Owner | Enforced by | Reason |
|---|---|---|---|---|
| `/api/agent-events` | service-bearer | platform | `withApiHandler` → `requirePrincipal` | Service events; `API_SECRET` bearer (BFF/server-side). |
| `/api/agent-events/stats` | service-bearer | platform | `withApiHandler` → `requirePrincipal` | Service events stats; `API_SECRET` bearer (BFF/server-side). |
| `/api/autopilot/findings/{id}` | service-bearer | autopilot | `requirePrincipal` | Autopilot finding mutation; `API_SECRET` bearer (BFF/server-side). |
| `/api/autopilot/runs/{runId}/evidence/{journeyId}/{artifactId}` | service-bearer | autopilot | `requirePrincipal` | Autopilot evidence read; `API_SECRET` bearer (BFF/server-side). |
| `/api/berichten/{id}` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Recruiter messages; `API_SECRET` bearer via BFF/server. |
| `/api/berichten` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Recruiter messages; `API_SECRET` bearer via BFF/server. |
| `/api/chat/feedback` | first-party-browser | chat | `withApiHandler` → `requirePrincipal` | Chat feedback; `API_SECRET` bearer via BFF/server. |
| `/api/chat` | first-party-browser | chat | `requirePrincipal` | Chat streaming; `API_SECRET` bearer via BFF/server. |
| `/api/chat-sessies/{id}/a2ui` | first-party-browser | chat | `withApiHandler` → `requirePrincipal` | Chat session A2UI; `API_SECRET` bearer via BFF/server. |
| `/api/chat-sessies/{id}` | first-party-browser | chat | `withApiHandler` → `requirePrincipal` | Chat session detail; `API_SECRET` bearer via BFF/server. |
| `/api/chat-sessies` | first-party-browser | chat | `withApiHandler` → `requirePrincipal` | Chat session list; `API_SECRET` bearer via BFF/server. |
| `/api/commercieel-cv/html` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Commercial CV HTML; `API_SECRET` bearer via BFF/server. |
| `/api/commercieel-cv` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Commercial CV; `API_SECRET` bearer via BFF/server. |
| `/api/cv-analyse` | first-party-browser | recruiting | `requirePrincipal` | CV analysis; `API_SECRET` bearer via BFF/server. Object binding is WP3. |
| `/api/cv-analyse/status/{runId}` | first-party-browser | recruiting | `requirePrincipal` | CV analysis status; `API_SECRET` bearer via BFF/server. |
| `/api/cv-file` | first-party-browser | recruiting | `requirePrincipal` | CV file proxy; principal required. Record binding is WP3. |
| `/api/cv-upload` | first-party-browser | recruiting | `requirePrincipal` | CV upload; `API_SECRET` bearer via BFF/server. Safe error body is WP3. |
| `/api/cv-upload/save` | first-party-browser | recruiting | `requirePrincipal` | CV save; `API_SECRET` bearer via BFF/server. |
| `/api/debug-error` | service-bearer | platform | `requirePrincipal` | Non-production diagnostics behind principal; payload is booleans only (R4). |
| `/api/embeddings/backfill` | service-bearer | platform | `requirePrincipal` | Embedding backfill; `API_SECRET` bearer (BFF/server-side). |
| `/api/enrichment-status` | service-bearer | platform | `withApiHandler` → `requirePrincipal` | Enrichment status; `API_SECRET` bearer (BFF/server-side). |
| `/api/esco/observability` | service-bearer | platform | `requirePrincipal` | ESCO observability; `API_SECRET` bearer (BFF/server-side). |
| `/api/esco/skills` | service-bearer | platform | `requirePrincipal` | ESCO skills; `API_SECRET` bearer (BFF/server-side). |
| `/api/feed/vacatures` | public | integrations | none (public) | Listed in `PUBLIC_PATHS`; no bearer token required. |
| `/api/gdpr/contacten/export` | service-bearer | compliance | `withApiHandler` → `requirePrincipal` | GDPR contacts export; `API_SECRET` bearer (BFF/server-side). |
| `/api/gdpr/contacten/verwijder` | service-bearer | compliance | `withApiHandler` → `requirePrincipal` | GDPR contacts delete; `API_SECRET` bearer (BFF/server-side). |
| `/api/gdpr/export/{kandidaatId}` | service-bearer | compliance | `withApiHandler` → `requirePrincipal` | GDPR candidate export; `API_SECRET` bearer (BFF/server-side). |
| `/api/gdpr/verwijder/{kandidaatId}` | service-bearer | compliance | `withApiHandler` → `requirePrincipal` | GDPR candidate delete; `API_SECRET` bearer (BFF/server-side). |
| `/api/gezondheid` | public | platform | `withApiHandler` `auth: "public"` | Listed in `PUBLIC_PATHS`; no bearer token required. |
| `/api/instellingen` | first-party-browser | platform | `withApiHandler` → `requirePrincipal` | Settings; `API_SECRET` bearer via BFF/server. |
| `/api/interviews/{id}` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Interviews; `API_SECRET` bearer via BFF/server. |
| `/api/interviews` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Interviews; `API_SECRET` bearer via BFF/server. |
| `/api/kandidaten/{id}/geen-match` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Candidate no-match; `API_SECRET` bearer via BFF/server. |
| `/api/kandidaten/{id}/kanaal-aanbod` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Candidate channel offer; `API_SECRET` bearer via BFF/server. |
| `/api/kandidaten/{id}/koppel` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Candidate link; `API_SECRET` bearer via BFF/server. |
| `/api/kandidaten/{id}/match` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Candidate match; `API_SECRET` bearer via BFF/server. |
| `/api/kandidaten/{id}/notities` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Candidate notes; `API_SECRET` bearer via BFF/server. |
| `/api/kandidaten/{id}` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Candidate detail; `API_SECRET` bearer via BFF/server. |
| `/api/kandidaten/{id}/vacature-scores` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Candidate vacancy scores; `API_SECRET` bearer via BFF/server. |
| `/api/kandidaten/intake` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Candidate intake; `API_SECRET` bearer via BFF/server. |
| `/api/kandidaten` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Candidate list/create; `API_SECRET` bearer via BFF/server. |
| `/api/livekit-token` | service-bearer | voice | `requirePrincipal` | LiveKit token; `API_SECRET` bearer (BFF/server-side). |
| `/api/matches/{id}` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Match detail; `API_SECRET` bearer via BFF/server. |
| `/api/matches/auto` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Auto-match; `API_SECRET` bearer via BFF/server. |
| `/api/matches/genereren` | first-party-browser | recruiting | `requirePrincipal` | Match generation; `API_SECRET` bearer via BFF/server. |
| `/api/matches` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Match list; `API_SECRET` bearer via BFF/server. |
| `/api/matches/structured` | first-party-browser | recruiting | `requirePrincipal` | Structured match; `API_SECRET` bearer via BFF/server. |
| `/api/mcp` | service-bearer | platform | `requirePrincipal` wrapper | HTTP MCP transport; `API_SECRET` bearer (BFF/server-side). |
| `/api/opdrachten/{id}/koppel` | service-bearer | recruiting | re-export → `/api/vacatures/{id}/koppel` | Legacy alias; enforcement via vacatures handler. |
| `/api/opdrachten/{id}/match-kandidaten` | service-bearer | recruiting | re-export → `/api/vacatures/{id}/match-kandidaten` | Legacy alias; enforcement via vacatures handler. |
| `/api/opdrachten/{id}/raw` | service-bearer | recruiting | re-export → `/api/vacatures/{id}/raw` | Legacy alias; enforcement via vacatures handler. |
| `/api/opdrachten/{id}` | service-bearer | recruiting | re-export → `/api/vacatures/{id}` | Legacy alias; enforcement via vacatures handler. |
| `/api/opdrachten` | service-bearer | recruiting | re-export → `/api/vacatures` | Legacy alias; enforcement via vacatures handler. |
| `/api/opdrachten/zoeken` | public | recruiting | none (public GET) | Listed in `PUBLIC_GET_PATHS`; GET search without principal. |
| `/api/openapi` | public | platform | none (public) | Listed in `PUBLIC_PATHS`; no bearer token required. |
| `/api/platforms/{slug}/activate` | first-party-browser | scrapers | `requirePrincipal` | Platform activate; `API_SECRET` bearer via BFF/server. |
| `/api/platforms/{slug}/credentials` | first-party-browser | scrapers | `requirePrincipal` | Platform credentials; `API_SECRET` bearer via BFF/server. |
| `/api/platforms/{slug}/status` | first-party-browser | scrapers | `withApiHandler` → `requirePrincipal` | Platform status; `API_SECRET` bearer via BFF/server. |
| `/api/platforms/{slug}/test-import` | first-party-browser | scrapers | `withApiHandler` → `requirePrincipal` | Platform test import; `API_SECRET` bearer via BFF/server. |
| `/api/platforms/{slug}/validate` | first-party-browser | scrapers | `withApiHandler` → `requirePrincipal` | Platform validate; `API_SECRET` bearer via BFF/server. |
| `/api/platforms/analyze` | first-party-browser | scrapers | `withApiHandler` → `requirePrincipal` | Platform analyze; `API_SECRET` bearer via BFF/server. |
| `/api/platforms/auto-setup` | first-party-browser | scrapers | `withApiHandler` → `requirePrincipal` | Platform auto-setup; `API_SECRET` bearer via BFF/server. |
| `/api/platforms` | first-party-browser | scrapers | `withApiHandler` → `requirePrincipal` | Platforms list; `API_SECRET` bearer via BFF/server. |
| `/api/reports` | service-bearer | recruiting | `requirePrincipal` | Report publish/read; `API_SECRET` bearer (BFF/server-side). Local publish returns `/reports/<matchId>` (deterministic regeneration). |
| `/api/revalidate` | service-bearer | platform | `requirePrincipal` | Cache revalidation; `API_SECRET` bearer (BFF/server-side). |
| `/api/salesforce-feed` | first-party-browser | integrations | `withApiHandler` → `requirePrincipal` | Requires `API_SECRET` bearer; Origin/Sec-Fetch-Site are isolation only, never admission. |
| `/api/scrape/starten` | first-party-browser | scrapers | `requirePrincipal` | Scrape start; `API_SECRET` bearer via BFF/server. Outbound URL validation is WP4. |
| `/api/scrape-resultaten/{id}` | service-bearer | scrapers | `withApiHandler` → `requirePrincipal` | Scrape result detail; `API_SECRET` bearer (BFF/server-side). |
| `/api/scrape-resultaten` | service-bearer | scrapers | `withApiHandler` → `requirePrincipal` | Scrape results; `API_SECRET` bearer (BFF/server-side). |
| `/api/scraper-analyse` | service-bearer | scrapers | `withApiHandler` → `requirePrincipal` | Scraper analyse; `API_SECRET` bearer (BFF/server-side). |
| `/api/scraper-configuraties/{id}` | first-party-browser | scrapers | `withApiHandler` → `requirePrincipal` | Scraper config detail; `API_SECRET` bearer via BFF/server. Responses use `PublicScraperConfig` (no credential fields). |
| `/api/scraper-configuraties/platform/{platform}/reset-circuit-breaker` | first-party-browser | scrapers | `withApiHandler` → `requirePrincipal` | Circuit-breaker reset; `API_SECRET` bearer via BFF/server. |
| `/api/scraper-configuraties` | first-party-browser | scrapers | `withApiHandler` → `requirePrincipal` | Scraper configs; `API_SECRET` bearer via BFF/server. List/create return `PublicScraperConfig`; `Cache-Control: private, no-store`. |
| `/api/scraper-dashboard` | service-bearer | scrapers | `withApiHandler` → `requirePrincipal` | Scraper dashboard; `API_SECRET` bearer (BFF/server-side). |
| `/api/screening-calls/{id}` | service-bearer | voice | `withApiHandler` → `requirePrincipal` | Screening call detail; `API_SECRET` bearer (BFF/server-side). |
| `/api/screening-calls/{id}/token` | service-bearer | voice | `withApiHandler` → `requirePrincipal` | Screening call token; `API_SECRET` bearer (BFF/server-side). |
| `/api/screening-calls` | service-bearer | voice | `withApiHandler` → `requirePrincipal` | Screening calls; `API_SECRET` bearer (BFF/server-side). |
| `/api/sollicitaties/{id}` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Applications; `API_SECRET` bearer via BFF/server. |
| `/api/sollicitaties` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Applications; `API_SECRET` bearer via BFF/server. |
| `/api/vaardigheden` | service-bearer | platform | `requirePrincipal` | Skills; `API_SECRET` bearer (BFF/server-side). |
| `/api/vacatures/{id}/koppel` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Vacancy link; `API_SECRET` bearer via BFF/server. |
| `/api/vacatures/{id}/match-kandidaten` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Vacancy match candidates; `API_SECRET` bearer via BFF/server. |
| `/api/vacatures/{id}/raw` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Vacancy raw; `API_SECRET` bearer via BFF/server. |
| `/api/vacatures/{id}` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Vacancy detail; `API_SECRET` bearer via BFF/server. |
| `/api/vacatures` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Vacancy list; `API_SECRET` bearer via BFF/server. |
| `/api/vacatures/zoeken` | public | recruiting | none (public GET) | Listed in `PUBLIC_GET_PATHS`; GET search without principal. |
| `/api/visualisatie/graph` | service-bearer | platform | `withApiHandler` → `requirePrincipal` | Visualization graph; `API_SECRET` bearer (BFF/server-side). |
| `/api/whatsapp/status` | service-bearer | integrations | `requirePrincipal` | WhatsApp status; `API_SECRET` bearer (BFF/server-side). |
| `/api/zoekfilters/{id}` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Search filters; `API_SECRET` bearer via BFF/server. |
| `/api/zoekfilters` | first-party-browser | recruiting | `withApiHandler` → `requirePrincipal` | Search filters; `API_SECRET` bearer via BFF/server. |

## Residuals

Routes left without a route-local principal check, with reason and owner:

| Route | Reason | Owner | Revisit |
|---|---|---|---|
| `/api/feed/vacatures` | Public feed by design (`PUBLIC_PATHS`). | integrations | If feed must become authenticated partner access. |
| `/api/gezondheid` | Public health probe (`PUBLIC_PATHS`); `auth: "public"`. | platform | Keep public for uptime monitors. |
| `/api/openapi` | Public OpenAPI document (`PUBLIC_PATHS`). | platform | Keep public for developer portal. |
| `/api/vacatures/zoeken` | Public GET search (`PUBLIC_GET_PATHS`). | recruiting | Revisit if search should require bearer. |
| `/api/opdrachten/zoeken` | Public GET search alias (`PUBLIC_GET_PATHS`). | recruiting | Same as vacatures/zoeken. |
| `/api/cv-file` URL-possession path | Principal is required (WP2); binding caller URL to a persisted candidate/file record is WP3. | recruiting | WP3 |
| `/api/cv-upload` failure body | Principal is required (WP2); replace exception text with fixed Dutch message is WP3 (R9). | recruiting | WP3 |
| `/api/scrape/starten` CRON_SECRET rate-limit bypass | Admission is `requirePrincipal` (`API_SECRET` bearer); `CRON_SECRET` only skips IP rate limit. Cron callers must present `API_SECRET`. | scrapers | Align cron env to `API_SECRET` if any caller still sends only `CRON_SECRET`. |
| Browser `fetch("/api/...")` without BFF | High-traffic shell paths use `apiFetch` → `/bff/*` (server attaches bearer). Remaining raw client call sites: scraper platform forms, screening-calls, agent-events feed, interview feedback editor, vacatures raw, public zoeken (OK). | platform | Convert remaining sites to `apiFetch` or Server Actions. |
| `/reports/[id]` page | Not in proxy matcher (WP1: pages ungated, no login). Renders candidate PII via `fetchMatchReport` + `generateReport`. Shareable signed/expiring/revocable links are a deferred product direction. | recruiting | Product: signed links or explicit page gating if external share is required. |
| `revokeReport` (markdown.fast) | Exported; no production callers. External DELETE only when `MARKDOWN_FAST_TOKEN` set. Local reports have no store — match/candidate erasure removes the source. | recruiting | Product: wire into GDPR Art.17 `eraseCandidateData` or drop the unused export. |
