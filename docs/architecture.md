# Motian Architecture

AI-Assisted Recruitment Operations Platform built with Next.js 15, Drizzle ORM, Neon PostgreSQL + pgvector, and Vercel AI SDK 6.

## System Overview

```
External Sources          Scrape Pipeline          Neon PostgreSQL
+--------------+     +-------------------+     +----------------+
| Flextender   |---->| scrape()          |---->| jobs           |
| Striive      |---->| normalize (Zod)   |     | candidates     |
| Opdrachtovhd |---->| enrich (Gemini)   |     | job_matches    |
+--------------+     | embed (OpenAI)    |     | applications   |
                     +-------------------+     +----------------+
                                                      |
                     +-------------------+             |
                     | Hybrid Search     |<------------+
                     | Text (ILIKE)      |
                     | Vector (pgvector) |
                     | RRF merge (k=60)  |
                     +-------------------+
                              |
                     +-------------------+
                     | AI Agent          |
                     | GPT-5 Nano        |
                     | 5 tools, maxSteps |
                     | /api/chat stream  |
                     +-------------------+
                              |
                     +-------------------+
                     | Next.js Frontend  |
                     | 7 pages           |
                     | Chat sidepanel    |
                     | Dark/light theme  |
                     +-------------------+
```

## Scrapers

| Platform | Method | File |
|----------|--------|------|
| Flextender | AJAX POST with `widget_config` CSRF token + detail page enrichment | `src/services/scrapers/flextender.ts` |
| Striive | Playwright browser automation with login | `src/services/scrapers/striive.ts` |
| Opdrachtoverheid | Public JSON API with paginated fetch | `src/services/scrapers/opdrachtoverheid.ts` |

Pipeline: `runScrapePipeline()` -> `normalizeAndSaveJobs()` (Zod) -> `enrichJobsBatch()` (Gemini) -> `generateEmbeddings()` (OpenAI)

## Hybrid Search

`hybridSearch()` in `src/services/jobs.ts` combines two search strategies via Reciprocal Rank Fusion (RRF):

1. **Text search** (`searchJobsByTitle`): ILIKE with multi-word OR splitting on the title column
2. **Vector search** (`findSimilarJobs`): OpenAI `text-embedding-3-small` (512d) with pgvector cosine distance

RRF formula: `score = sum(1 / (k + rank))` with k=60. Jobs appearing in both result lists rank highest.

## AI Agent

- **Model**: GPT-5 Nano (`gpt-5-nano-2025-08-07`)
- **SDK**: Vercel AI SDK 6 with `streamText()` + `maxSteps: 5`
- **System prompt**: Dutch, context-aware (current page + entity ID)

### Tools

| Tool | Purpose | Service |
|------|---------|---------|
| `queryOpdrachten` | Hybrid search + filtered listing | `hybridSearch()`, `listJobs()` |
| `getOpdrachtDetail` | Full job details by ID | `getJobById()` |
| `matchKandidaten` | Vector similarity matching | `findSimilarJobs()` |
| `analyseData` | Aggregate DB statistics | Direct Drizzle queries |
| `triggerScraper` | Start scrape pipeline | `runScrapePipeline()` |

## Database

Neon PostgreSQL with pgvector extension. 8 tables defined in `src/db/schema.ts`:

- `jobs` — Core assignments with 512d vector embeddings
- `candidates` — Professional profiles with embeddings
- `job_matches` — AI-generated match scores with reasoning
- `applications` — Application pipeline (new -> screening -> interview -> offer -> hired)
- `interviews` — Scheduled interviews with feedback
- `messages` — Communication log (inbound/outbound)
- `scraper_configs` — Platform configuration with cron schedules
- `scrape_results` — Run history with success/failure tracking

## Frontend

Next.js 15 App Router with Tailwind CSS 4 and shadcn/ui components.

### Pages

| Route | Purpose |
|-------|---------|
| `/opdrachten` | Filterable job listing with platform/province/rate filters |
| `/opdrachten/[id]` | Job detail with formatted descriptions and competence badges |
| `/professionals` | Candidate directory |
| `/matching` | AI-powered matching dashboard |
| `/pipeline` | Scrape history and status |
| `/scraper` | Scraper configuration and manual triggers |
| `/overzicht` | Overview dashboard |

### Chat Sidepanel

- Toggle: `Cmd+J` keyboard shortcut
- Width: 400px (full-width on mobile)
- Context: auto-detects current route and entity ID
- Streaming: `useChat()` from `@ai-sdk/react`
- Tool visualization: collapsible cards with spinner -> checkmark states

### Theme System

- `next-themes` with class-based switching (`attribute="class"`)
- Semantic CSS variables via Tailwind CSS 4 `@theme`
- Light mode defaults, `.dark` overrides
- Toggle in sidebar header

## Tech Stack

| Layer | Technology |
|-------|-----------|
| Framework | Next.js 15 (App Router) |
| Database | Neon PostgreSQL + pgvector |
| ORM | Drizzle ORM |
| AI SDK | Vercel AI SDK 6.0.97 |
| Chat Model | GPT-5 Nano |
| Embeddings | OpenAI text-embedding-3-small (512d) |
| Enrichment | Gemini 2.0 Flash |
| Styling | Tailwind CSS 4 + shadcn/ui |
| Validation | Zod |
| Deployment | Vercel (Hobby plan with daily cron) |
