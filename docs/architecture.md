# Motian Architecture

AI-Assisted Recruitment Operations Platform built with Next.js 16, React 19, Drizzle ORM, Neon PostgreSQL + pgvector, Trigger.dev, and multiple AI models (Gemini, GPT-5, Grok).

> **Interactive visual explainer**: Open `docs/visual-explainer.html` in a browser for diagrams and flowcharts.

## System Overview

```
External Sources          Trigger.dev (cron 4h)        Neon PostgreSQL
+--------------+     +----------------------+     +------------------+
| Striive      |---->| scrape()             |---->| jobs             |
| Flextender   |---->| normalize (Zod)      |     | candidates       |
| Opdrachtovhd |---->| enrich (Gemini)      |     | job_matches      |
| Indeed (TBD) |     | embed (GPT-5 Nano)   |     | applications     |
| LinkedIn(TBD)|     +----------------------+     | interviews       |
+--------------+                                  | messages         |
                                                  | scraper_configs  |
CV Upload (SSE)       3-Layer Matching Engine      | scrape_results   |
+--------------+     +----------------------+     | gdpr_audit_log   |
| Upload Blob  |---->| Quick Score (hybrid)  |     +------------------+
| Parse Gemini |     | Deep Match (Gemini)   |
| Dedup        |     | Judge Verdict (Grok)  |     Vercel Blob
| Auto-Match   |     +----------------------+     +------------------+
+--------------+                                  | CV Files (PDF)   |
                                                  +------------------+
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

Real-time SSE streaming pipeline at `/api/cv-analyse`:

1. **Upload** → File to Vercel Blob storage
2. **Parse** → Gemini 3 Flash extracts `ParsedCV` (skills with proficiency 1-5, experience, education, languages, certifications)
3. **Deduplicate** → Check for existing candidate by email/name; enrich or create new
4. **Match** → Auto-match against top 3 active jobs (score ≥ 40%)

Events streamed as `text/event-stream` with step status updates (pending → active → complete → error).

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

## AI Chat Agent

- **Model**: GPT-5 Nano via Vercel AI SDK 6 with `streamText()` + `maxSteps: 5`
- **System prompt**: Dutch, context-aware (current page + entity ID)
- **Toggle**: `Cmd+J` keyboard shortcut

### Tools

| Tool | Purpose | Service |
|------|---------|---------|
| `queryOpdrachten` | Hybrid search + filtered listing | `hybridSearch()`, `listJobs()` |
| `getOpdrachtDetail` | Full job details by ID | `getJobById()` |
| `matchKandidaten` | Vector similarity matching | `findSimilarJobs()` |
| `analyseData` | Aggregate DB statistics | Direct Drizzle queries |
| `triggerScraper` | Start scrape pipeline | `runScrapePipeline()` |

## Database

Neon PostgreSQL with pgvector extension. 9 tables in `src/db/schema.ts`:

| Table | Purpose | Key Fields |
|-------|---------|------------|
| `jobs` | Vacatures with 512d embeddings | platform, external_id, title, company, requirements, embedding |
| `candidates` | Professionals with embeddings | name, email, skills, resume_raw, embedding, consent_granted |
| `job_matches` | AI match scores + reasoning | match_score, recommendation, criteria_breakdown, risk_profile |
| `applications` | Pipeline: new → screening → interview → offer → hired | stage, job_id, candidate_id, match_id |
| `interviews` | Scheduled with feedback + rating (1-5) | application_id, scheduled_at, type, status, rating |
| `messages` | Communication log | application_id, direction, channel, body |
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

### Key UI Components

| Component | Purpose |
|-----------|---------|
| `PipelineProgress` | Step stepper with animated status icons (pending/active/complete/error) |
| `CvProfileCard` | Parsed CV display with skill proficiency bars, experience, education |
| `CvMatchCard` | Match result card with score ring, recommendation badge, criteria breakdown |
| `ScoreRing` | SVG circular progress with color-coded scores |
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
