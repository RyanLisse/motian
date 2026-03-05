# Motian Architecture

AI-Assisted Recruitment Operations Platform built with Next.js 16, React 19, Drizzle ORM, Neon PostgreSQL + pgvector, Trigger.dev, and multiple AI models (Gemini, GPT-5, Grok).

> **Interactive visual explainer**: Open `app/visual-explainer/page.tsx` or visit `/visual-explainer` for diagrams and flowcharts.

## System Overview

```
External Sources          Trigger.dev (8 scheduled tasks)    Neon PostgreSQL
+--------------+     +-----------------------------+     +-------------------+
| Striive      |---->| scrape-pipeline (4h)        |---->| jobs              |
| Flextender   |---->| embeddings-batch (1h)       |     | candidates        |
| Opdrachtovhd |---->| vacancy-expiry (daily)      |     | job_matches       |
| Indeed (TBD) |     | data-retention (daily)      |     | applications      |
| LinkedIn(TBD)|     | scraper-health (daily)      |     | interviews        |
+--------------+     | candidate-dedup (weekly)     |     | messages          |
                     | match-staleness (weekly)     |     | chat_sessions     |
CV Upload (SSE)      | slack-notification (on-demand)|     | scraper_configs   |
+--------------+     +-----------------------------+     | scrape_results    |
| Upload Blob  |                                         | gdpr_audit_log    |
| Parse Gemini |     3-Layer Matching Engine              +-------------------+
| Dedup        |     +----------------------+
| Auto-Match   |---->| Quick Score (hybrid)  |           Vercel Blob
+--------------+     | Deep Match (Gemini)   |           +------------------+
                     | Judge Verdict (Grok)  |           | CV Files (PDF)   |
                     +----------------------+           +------------------+
```

## Scrapers

| Platform | Method | File | Status |
|----------|--------|------|--------|
| Striive | Playwright browser automation with login | `src/services/scrapers/striive.ts` | Active |
| Flextender | AJAX POST with `widget_config` CSRF token | `src/services/scrapers/flextender.ts` | Active |
| Opdrachtoverheid | Public JSON API with paginated fetch | `src/services/scrapers/opdrachtoverheid.ts` | Active |
| Indeed | — | — | Planned |
| LinkedIn | — | — | Planned |

**Pipeline**: `runScrapePipeline()` → `normalizeAndSaveJobs()` (Zod) → `enrichJobsBatch()` (Gemini) → `generateEmbeddings()` (GPT-5 Nano)

**Error handling**: Scrapers throw on failure (never return `[]`). Pipeline treats `listings.length === 0` as failed. Circuit breaker via `consecutiveFailures` counter in `scraper_configs`.

## CV Analysis Pipeline

Real-time SSE streaming pipeline at `/api/cv-analyse` with **visuele pipeline** Analyse → Grade → Match:

1. **Analyse** — Upload (Vercel Blob) + Parse (Gemini 3 Flash → `ParsedCV`: skills, experience, education)
2. **Grade** — Expliciete beoordelingsfase: heuristische kwaliteitsscore op basis van parsed CV (0–100 + label)
3. **Match** — Deduplicate (bestaande kandidaat vinden/aanmaken) + Auto-match tegen top 3 actieve vacatures (score ≥ 40%)

De frontend toont een **workflow-canvas** (@xyflow/react) met nodes Analyse → Grade → Match en een stap-indicator. Events worden gestreamd als `text/event-stream` (pending → active → complete → error).

## Matching Engine (3 Layers)

### Layer 1: Quick Score
- **60% rule-based**: skills overlap, experience match, location proximity, rate compatibility
- **40% vector similarity**: cosine distance between candidate and job embeddings (pgvector)
- Filters: `MIN_SCORE = 40`, selects `TOP_N = 3`

### Layer 2: Deep Structured Match (Gemini 3 Flash)
Mariënne methodology with three criteria tiers:
- **KNOCKOUT**: Hard requirements → pass/fail (vereiste certificeringen, min. ervaring)
- **GUNNING**: Scored criteria → 1-5 stars (relevante ervaring, skills diepte)
- **PROCESS**: Process requirements → pass/fail (beschikbaarheid, locatie, tarief)

Output: `StructuredMatchOutput` with `overallScore`, `recommendation` (go/no-go/conditional), `criteriaBreakdown`, `riskProfile`, `enrichmentSuggestions`

### Layer 3: Judge Verdict (Grok 4)
Independent AI review of the structured result. Provides own score and motivation, flags discrepancies with primary assessment. Prevents single-model bias.

## Hybrid Search

`hybridSearch()` in `src/services/jobs.ts` combines two strategies via Reciprocal Rank Fusion (RRF):

1. **Text search** (`searchJobsByTitle`): ILIKE with multi-word OR splitting
2. **Vector search** (`findSimilarJobs`): 512d embeddings with pgvector cosine distance

RRF formula: `score = sum(1 / (k + rank))` with k=60.

## AI Models

| Model | Provider | Purpose | Service |
|-------|----------|---------|---------|
| Gemini 3 Flash | Google AI | CV parsing, job enrichment, structured matching, requirement extraction | `cv-parser.ts`, `enrichment.ts`, `structured-matching.ts` |
| GPT-5 Nano | OpenAI | 512d embeddings, AI chat agent | `embedding.ts`, `api/chat/route.ts` |
| Grok 4 | xAI | Independent judge verdict on match results | `match-judge.ts` |

## AI Agent Surfaces

Motian provides **4 agent surfaces** sharing the same service layer:

| Surface | Tools | Model | Transport | Start |
|---------|-------|-------|-----------|-------|
| **Chat** | 40 | GPT-5 Nano | Vercel AI SDK `streamText` | `/chat` page |
| **MCP Server** | 42 | N/A (client chooses) | stdio (Model Context Protocol) | `pnpm mcp` |
| **Voice Agent** | 35 | Gemini 2.5 Flash Native Audio | LiveKit Agents + Silero VAD | `pnpm voice-agent:dev` |
| **CLI** | — | Interactive | Terminal | `pnpm cli` |

### Chat Agent

- **Model**: GPT-5 Nano via Vercel AI SDK 6 with `streamText()` + `maxSteps: 5`
- **UI**: Full-screen `/chat` page built with **AI SDK Elements** (`PromptInput`, `Conversation`, `Message` with Streamdown)
- **Model Picker**: Gemini 3.1 Flash Lite, Gemini 3 Flash, GPT-5 Nano, Grok 4
- **Features**: Voice mode toggle, session history sidebar, CV upload in chat, GenUI cards, reasoning display
- **System prompt**: Dutch, context-aware (current page + entity ID + workspace summary)
- **Conversation memory**: Persisted to `chat_sessions` table (last 50 messages per session)
- **Rate limit**: 20 requests/minute per IP

### Chat Tools (40)

| Category | Tools | Count |
|----------|-------|-------|
| Kandidaten | zoekKandidaten, getKandidaatDetail, maakKandidaatAan, updateKandidaat, verwijderKandidaat, voegNotitieToe, autoMatchKandidaat | 7 |
| Vacatures | queryOpdrachten, getOpdrachtDetail, updateOpdracht, verwijderOpdracht, matchKandidaten | 5 |
| Matches | zoekMatches, getMatchDetail, maakMatchAan, keurMatchGoed, wijsMatchAf, verwijderMatch | 6 |
| Sollicitaties | zoekSollicitaties, getSollicitatieDetail, maakSollicitatieAan, updateSollicitatieFase, verwijderSollicitatie, getSollicitatieStats | 6 |
| Interviews | zoekInterviews, getInterviewDetail, planInterview, updateInterviewTool, verwijderInterview | 5 |
| Berichten | zoekBerichten, getBerichtDetail, stuurBericht, verwijderBericht | 4 |
| GDPR | exporteerKandidaatData, wisKandidaatData, exporteerContactData, scrubContactGegevens | 4 |
| Operaties | importeerOpdrachtenBatch, runKandidaatScoringBatch, reviewGdprRetentie | 3 |
| **Totaal** | | **40** |

### Voice Agent

- **Model**: Gemini 2.5 Flash Native Audio (`gemini-2.5-flash-native-audio-preview-12-2025`)
- **VAD**: Silero Voice Activity Detection
- **Language**: Dutch (automatic greeting)
- **Architecture**: Direct service imports — no HTTP overhead (35 tools)
- **Location**: `src/voice-agent/main.ts` + `src/voice-agent/agent.ts`
- **Start**: `pnpm voice-agent:dev` (development) or `pnpm voice-agent:start` (production)

### MCP Server (42 tools)

Model Context Protocol server for AI assistants (Claude Code, Cursor, Windsurf). Exposes the same service layer via stdio transport.

Tool modules: kandidaten (9), vacatures (5), matches (6), sollicitaties, interviews, berichten, gdpr-ops (8), advanced-matching (2), analytics, scraping.

Location: `src/mcp/server.ts` + `src/mcp/tools/`

Start: `pnpm mcp`

## Trigger.dev Scheduled Tasks (8 total)

| Task ID | Schedule | Purpose | File |
|---------|----------|---------|------|
| `scrape-pipeline` | Every 4h | Orchestrate all scraper runs with circuit breaker | `trigger/scrape-pipeline.ts` |
| `embeddings-batch` | Hourly (:15) | Backfill missing job + candidate embeddings | `trigger/embeddings-batch.ts` |
| `vacancy-expiry` | Daily 3:00 AM | Soft-delete expired jobs past deadline | `trigger/vacancy-expiry.ts` |
| `data-retention-cleanup` | Daily 2:00 AM | GDPR auto-erasure of expired candidate data | `trigger/data-retention.ts` |
| `scraper-health-check` | Daily 6:00 AM | Auto-reset circuit breakers after 72h clean window | `trigger/scraper-health.ts` |
| `candidate-dedup` | Weekly Sun 4:00 AM | Detect duplicate candidates by email/name | `trigger/candidate-dedup.ts` |
| `match-staleness-purge` | Weekly Mon 5:00 AM | Archive pending matches older than 30 days | `trigger/match-staleness.ts` |
| `slack-notification` | On-demand | Reliable Slack delivery with 5x retry | `trigger/slack-notifications.ts` |

## Security & Rate Limiting

- **CORS**: Environment-based origin whitelist via `ALLOWED_ORIGINS` (no wildcard)
- **Rate limiting**: Applied to all sensitive endpoints (GDPR 5/min, CV upload 10/min, matching 10/min, chat 20/min, scraping 5/5min)
- **Auth**: CRON_SECRET bearer token on internal endpoints; `x-requested-by` header on GDPR routes
- **Zod validation**: All API inputs validated with typed schemas (no `z.any()`)
- **Encryption**: Scraper auth configs encrypted at rest via `src/lib/crypto.ts`

## Database

Neon PostgreSQL with pgvector extension. 10 tables in `src/db/schema.ts`:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `jobs` | Vacatures with 512d embeddings | platform, external_id, title, company, requirements, embedding |
| `candidates` | Professionals with embeddings | name, email, skills, resume_raw, embedding, consent_granted |
| `job_matches` | AI match scores + reasoning | match_score, recommendation, criteria_breakdown, risk_profile |
| `applications` | Pipeline: new → screening → interview → offer → hired | stage, job_id, candidate_id, match_id |
| `interviews` | Scheduled with feedback + rating (1-5) | application_id, scheduled_at, type, status, rating |
| `messages` | Communication log | application_id, direction, channel, body |
| `chat_sessions` | Conversation memory persistence | session_id, messages (JSONB), context, message_count |
| `scraper_configs` | Platform config + cron + circuit breaker | platform, is_active, cron_expression, consecutive_failures |
| `scrape_results` | Run history | jobs_found, jobs_new, duplicates, status |
| `gdpr_audit_log` | GDPR compliance audit trail | action, subject_type, subject_id, requested_by |

## Frontend

Next.js 16 App Router with Tailwind CSS v4, Radix UI (shadcn/ui), React 19.

### Pages

| Route | Purpose |
|-------|---------|
| `/opdrachten` | Filterable job listing with platform/province/rate filters |
| `/opdrachten/[id]` | Job detail with formatted descriptions and competence badges |
| `/professionals` | Candidate directory with CV upload/delete |
| `/matching` | AI matching: CV Analyse tab (drag-and-drop) + Koppelen tab |
| `/pipeline` | Scrape history and status |
| `/scraper` | Scraper configuration and manual triggers |
| `/overzicht` | Overview dashboard with KPIs |
| `/chat` | Full-screen AI chat with model picker, voice mode, session history, GenUI cards |
| `/settings` | Platform settings (matching, data management, notifications) |

### Key UI Components

| Component | Purpose |
|-----------|---------|
| `PipelineProgress` | Step stepper (Analyse → Grade → Match) with animated status icons (pending/active/complete/error) |
| `PipelineWorkflowCanvas` | @xyflow/react workflow diagram: nodes Analyse, Grade, Match met edges; toont actieve stap |
| `CriteriaBreakdownChart` | Recharts bar chart voor criteria-scores per match |
| `CvProfileCard` | Parsed CV display with skill proficiency bars, experience, education |
| `CvMatchCard` | Match result card with ScoreRing, recommendation badge, criteria breakdown + chart, reasoning & judge panel |
| `ScoreRing` | SVG circular progress with color-coded scores (top 3 prominent) |
| `CvDocumentViewer` | Split-screen PDF viewer for CV review |

### Theme System

- `next-themes` with class-based switching
- Semantic CSS variables via Tailwind CSS v4 `@theme`
- Light mode defaults, `.dark` overrides

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 16 (App Router, Server Components) |
| UI | React 19 + Tailwind CSS v4 + Radix UI (shadcn/ui) |
| Database | Neon PostgreSQL + pgvector |
| ORM | Drizzle ORM |
| Background Jobs | Trigger.dev v4 (cron, long-running tasks) |
| File Storage | Vercel Blob |
| AI - Parsing/Matching | Gemini 3 Flash |
| AI - Embeddings/Chat | GPT-5 Nano (text-embedding-3-small, 512d) |
| AI - Judging | Grok 4 |
| Validation | Zod |
| Linting | Biome (not ESLint/Prettier) |
| Testing | Vitest |
| Monitoring | Sentry + PostHog |
| Deployment | Vercel |
