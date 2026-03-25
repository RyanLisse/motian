<div align="center">

# 🏢 Motian

**AI-Assisted Recruitment Operations Platform**

_Scrape → Normalize → Enrich → Match → Hire_

> **Interactive visual documentation**: Open [`docs/visual-explainer.html`](docs/visual-explainer.html) in a browser for diagrams and flowcharts.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Neon PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-00e599?logo=postgresql)](https://neon.tech)
[![Vercel AI SDK](https://img.shields.io/badge/AI%20SDK-6.0-blue?logo=vercel)](https://sdk.vercel.ai)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-c5f74f)](https://orm.drizzle.team)
[![Qlty](https://img.shields.io/badge/Qlty-Code%20Quality-7c3aed)](https://qlty.sh)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-f69220?logo=pnpm)](https://pnpm.io)

[🇳🇱 Nederlands](README.md) · 🇬🇧 **English**

</div>

---

## Overview

Motian is a **Dutch recruitment operations platform** that automates vacancy sourcing from multiple government and staffing portals, enriches listings with AI, and provides intelligent candidate matching through hybrid vector + text search.

Built for recruiters and staffing agencies operating in the Dutch public sector market.

---

## Architecture

### System Overview

```mermaid
graph TB
    subgraph Sources["🌐 External Sources"]
        FX[Flextender]
        ST[Striive]
        OO[Opdrachtoverheid]
    end

    subgraph Pipeline["⚙️ Scrape Pipeline — Trigger.dev"]
        SC[Scraper Engine]
        NR[Normalize — Zod]
        EN[Enrich — Gemini 3 Flash]
        EM[Embed — GPT-5 Nano 512d]
    end

    subgraph DB["🗄️ Neon PostgreSQL + pgvector"]
        JOBS[(jobs)]
        CAND[(candidates)]
        MATCH[(job_matches)]
        APP[(applications)]
        INT[(interviews)]
        MSG[(messages)]
        SCFG[(scraper_configs)]
        SRES[(scrape_results)]
        GDPR[(gdpr_audit_log)]
    end

    subgraph Matching["🎯 3-Layer Matching Engine"]
        QS[Quick Score — 60% rules + 40% vector]
        DM[Deep Match — Gemini 3 Flash]
        JV[Judge Verdict — Grok 4]
    end

    subgraph CVPipeline["📄 CV Analysis — SSE Stream"]
        UP[Upload → Vercel Blob]
        PA[Parse → Gemini 3 Flash]
        DD[Deduplicate]
        AM[Auto-Match → Top 3]
    end

    subgraph Search["🔍 Hybrid Search"]
        TXT[Text — ILIKE]
        VEC[Vector — pgvector cosine]
        RRF[RRF Merge k=60]
    end

    subgraph AI["🤖 AI Chat Agent"]
        AGENT[GPT-5 Nano]
        TOOLS[40 Tools]
        STREAM[streamText + maxSteps]
    end

    subgraph MCP["🔌 MCP Server"]
        MCPS[42 Tools — Stdio Protocol]
        CLI[CLI & IDE Integration]
    end

    subgraph Voice["🎙️ Voice Agent — LiveKit"]
        VLLM[Gemini 2.5 Flash Native Audio]
        VTOOLS[35 Tools — Direct Service Imports]
        VAD[Silero VAD]
    end

    subgraph Frontend["🖥️ Next.js 16 Frontend"]
        PAGES[8 Pages — App Router]
        CHAT[Chat — Full Screen + AI Elements]
        THEME[Dark/Light Theme]
    end

    subgraph Integrations["🔁 External Integrations"]
        FEED["/api/salesforce-feed<br/>Read-only XML export"]
        SF[Salesforce]
    end

    FX --> SC
    ST --> SC
    OO --> SC
    SC --> NR --> EN --> EM --> JOBS

    JOBS --> TXT
    JOBS --> VEC
    TXT --> RRF
    VEC --> RRF
    RRF --> AGENT

    AGENT --> TOOLS
    TOOLS --> JOBS
    TOOLS --> CAND
    TOOLS --> MATCH

    CAND --> QS --> DM --> JV --> MATCH

    UP --> PA --> DD --> AM --> MATCH

    AGENT --> STREAM --> CHAT
    MCPS --> CLI
    VLLM --> VTOOLS
    VAD --> VLLM
    CHAT --> PAGES
    PAGES --> THEME

    JOBS --> FEED
    CAND --> FEED
    APP --> FEED
    FEED --> SF
```

### Data Flow — Scrape-to-Search Pipeline

```mermaid
sequenceDiagram
    participant Cron as ⏰ Trigger.dev Cron (4h)
    participant Pipeline as ⚙️ runScrapePipeline()
    participant Scraper as 🕷️ Platform Scraper
    participant Zod as ✅ Zod Normalize
    participant Gemini as 🧠 Gemini 3 Flash
    participant OpenAI as 🔢 GPT-5 Nano Embed
    participant DB as 🗄️ Neon DB

    Cron->>Pipeline: Every 4 hours
    Pipeline->>Scraper: Fetch active configs

    loop Each Platform
        Scraper->>Scraper: Fetch listings (throws on failure)
        Scraper->>Zod: Raw vacancy data
        Zod->>DB: Upsert (platform, externalId)
        Zod-->>Gemini: Batch enrich
        Gemini->>DB: AI summary, skills, seniority
        Gemini-->>OpenAI: Generate embedding text
        OpenAI->>DB: 512d vector embedding
    end

    Note over DB: Jobs now searchable via<br/>text ILIKE + vector cosine
```

### Multi-Surface Agent Architecture

Motian offers **4 agent surfaces** sharing the same service layer:

```mermaid
graph TB
    subgraph Surfaces["🎯 Agent Surfaces"]
        direction LR
        CHAT["💬 Chat Agent<br/>40 tools — GPT-5 Nano<br/>Web UI + AI Elements"]
        MCP["🔌 MCP Server<br/>42 tools — Stdio Protocol<br/>IDE & CLI integration"]
        VOICE["🎙️ Voice Agent<br/>35 tools — Gemini 2.5 Flash<br/>LiveKit + Silero VAD"]
        CLIA["⌨️ CLI Agent<br/>Interactive terminal"]
    end

    subgraph Services["📦 Shared Service Layer"]
        S1[Candidates & CV]
        S2[Jobs & Search]
        S3[Matching Engine]
        S4[Applications & Interviews]
        S5[GDPR & Messages]
        S6[Scraping & Analytics]
    end

    subgraph DB["🗄️ Neon PostgreSQL + pgvector"]
        DATA[(All tables)]
    end

    CHAT --> S1 & S2 & S3 & S4 & S5 & S6
    MCP --> S1 & S2 & S3 & S4 & S5 & S6
    VOICE --> S1 & S2 & S3 & S4 & S5 & S6
    CLIA --> S1 & S2 & S3 & S4 & S5 & S6

    S1 & S2 & S3 & S4 & S5 & S6 --> DATA

    style CHAT fill:#3b82f6,color:#fff
    style MCP fill:#8b5cf6,color:#fff
    style VOICE fill:#10b981,color:#fff
    style CLIA fill:#f59e0b,color:#000
```

### AI Chat Tool Architecture

```mermaid
graph LR
    subgraph Agent["🤖 Chat Agent — GPT-5 Nano"]
        SYS[System Prompt — Dutch]
        CTX[Page Context Detection]
    end

    subgraph Tools["🔧 40 Tools"]
        T1[Kandidaten — 7 tools]
        T2[Vacatures — 5 tools]
        T3[Matches — 6 tools]
        T4[Sollicitaties — 6 tools]
        T5[Interviews — 5 tools]
        T6[Berichten — 4 tools]
        T7[GDPR — 4 tools]
        T8[Operaties — 3 tools]
        T9[Analyse & Search — 3 tools]
        T10[Structured Match — 2 tools]
    end

    subgraph Services["📦 Service Layer"]
        S1[searchJobsUnified / hybridSearch]
        S2[getJobById]
        S3[findSimilarJobs]
        S4[Drizzle Queries]
        S5[runScrapePipeline]
    end

    Agent --> T1 --> S1
    Agent --> T2 --> S2
    Agent --> T3 --> S3
    Agent --> T4 --> S4
    Agent --> T5 --> S5
    Agent --> T6
    Agent --> T7
    Agent --> T8
    Agent --> T9
    Agent --> T10
```

### Hybrid Search — Reciprocal Rank Fusion

```mermaid
graph TD
    Q[User Query] --> A[Text Search — ILIKE]
    Q --> B[Vector Search — pgvector cosine]

    A --> |Rank by relevance| RA[Text Results]
    B --> |Rank by similarity| RB[Vector Results]

    RA --> RRF["RRF Merge<br/>score = Σ 1/(k + rank)<br/>k = 60"]
    RB --> RRF

    RRF --> FINAL[Final Ranked Results]

    style RRF fill:#4f46e5,color:#fff
```

### Database Schema — Entity Relationships

```mermaid
erDiagram
    scraper_configs ||--o{ scrape_results : "tracks"
    jobs ||--o{ job_matches : "matched to"
    jobs ||--o{ applications : "applied for"
    candidates ||--o{ job_matches : "matched with"
    candidates ||--o{ applications : "applies"
    applications ||--o{ interviews : "scheduled"
    applications ||--o{ messages : "communication"

    jobs {
        uuid id PK
        text platform
        text external_id
        text title
        text company
        text description
        text province
        real hourly_rate_min
        real hourly_rate_max
        text contract_type
        jsonb requirements
        jsonb competences
        text ai_summary
        vector embedding "512d"
        timestamp deleted_at "soft-delete"
    }

    candidates {
        uuid id PK
        text name
        text email
        text function_title
        text province
        jsonb skills
        text resume_raw
        text resume_url
        vector embedding "512d"
        timestamp deleted_at
    }

    job_matches {
        uuid id PK
        uuid job_id FK
        uuid candidate_id FK
        real match_score
        text recommendation "go/no-go/conditional"
        jsonb criteria_breakdown
        jsonb risk_profile
        jsonb enrichment_suggestions
        text assessment_model
        text judge_score
        text judge_motivation
    }

    applications {
        uuid id PK
        uuid job_id FK
        uuid candidate_id FK
        uuid match_id FK
        text stage "new-screening-interview-offer-hired"
    }

    interviews {
        uuid id PK
        uuid application_id FK
        timestamp scheduled_at
        text type
        text status
        text feedback
        integer rating "1-5"
    }

    messages {
        uuid id PK
        uuid application_id FK
        text direction "inbound/outbound"
        text channel
        text body
    }

    scraper_configs {
        uuid id PK
        text platform UK
        text base_url
        text cron_expression
        boolean is_active
        integer consecutive_failures "circuit breaker"
    }

    scrape_results {
        uuid id PK
        uuid config_id FK
        text platform
        text status "success/failed"
        integer jobs_found
        integer jobs_new
        integer duplicates
    }

    gdpr_audit_log {
        uuid id PK
        text action
        text subject_type
        uuid subject_id
        text requested_by
        timestamp created_at
    }
```

### Application Pipeline

```mermaid
stateDiagram-v2
    [*] --> New: Application created
    New --> Screening: Recruiter reviews
    Screening --> Interview: Candidate selected
    Interview --> Offer: Interview passed
    Offer --> Hired: Offer accepted
    Offer --> Rejected: Offer declined

    Screening --> Rejected: Not qualified
    Interview --> Rejected: Interview failed

    Rejected --> [*]
    Hired --> [*]
```

### CV Analysis Pipeline (SSE)

```mermaid
sequenceDiagram
    participant User as 👤 Recruiter
    participant UI as 🖥️ CV Analyse Tab
    participant API as 📡 /api/cv-analyse (SSE)
    participant Blob as 📦 Vercel Blob
    participant Gemini as 🧠 Gemini 3 Flash
    participant DB as 🗄️ Neon DB
    participant Match as 🎯 Matching Engine

    User->>UI: Drop CV (PDF/DOCX)
    UI->>API: POST FormData

    API->>Blob: Upload file
    API-->>UI: SSE: upload ✓
    API->>Gemini: Parse CV
    API-->>UI: SSE: parse ✓ (name, role)
    API->>DB: Deduplicate (email/name)
    API-->>UI: SSE: deduplicate ✓
    API->>Match: Auto-match top 3 jobs
    API-->>UI: SSE: match ✓ (N matches)
    API-->>UI: SSE: done + full result

    UI->>UI: Full-screen result view
```

### 3-Layer Matching Engine

```mermaid
graph LR
    subgraph Layer1["⚡ Layer 1: Quick Score"]
        RULES[60% Rule-based<br/>skills, experience, location, rate]
        VECTOR[40% Vector Similarity<br/>pgvector cosine 512d]
    end

    subgraph Layer2["🧠 Layer 2: Deep Match — Gemini"]
        KO[KNOCKOUT<br/>Hard requirements — pass/fail]
        GUN[GUNNING<br/>Scored criteria — 1-5 stars]
        PROC[PROCESS<br/>Process requirements — pass/fail]
    end

    subgraph Layer3["⚖️ Layer 3: Judge — Grok 4"]
        JUDGE[Independent Review<br/>Own score + motivation]
    end

    RULES --> QS[Quick Score ≥ 40%]
    VECTOR --> QS
    QS --> |Top 3| KO
    KO --> GUN --> PROC --> REC[Recommendation<br/>go / no-go / conditional]
    REC --> JUDGE --> FINAL[Final Result<br/>+ risk profile]

    style QS fill:#f59e0b,color:#000
    style REC fill:#4f46e5,color:#fff
    style FINAL fill:#10b981,color:#000
```

### Cron Job Schedule

```mermaid
gantt
    title Automated Tasks — Trigger.dev
    dateFormat HH:mm
    axisFormat %H:%M

    section Maintenance
    Data Retention Cleanup    :02:00, 30min
    Vacancy Expiry Check      :03:00, 15min

    section Scraping (every 4 hours)
    Platform Scrape Pipeline  :00:00, 45min
    Platform Scrape Pipeline  :04:00, 45min
    Platform Scrape Pipeline  :08:00, 45min
```

---

## Tech Stack

| Layer               | Technology                      | Purpose                                        |
| ------------------- | ------------------------------- | ---------------------------------------------- |
| **Framework**       | Next.js 16 (App Router)         | Server Components, API Routes, Turbopack       |
| **Database**        | Neon PostgreSQL + pgvector      | Serverless Postgres with vector similarity     |
| **ORM**             | Drizzle ORM                     | Type-safe schema and queries                   |
| **AI Chat**         | GPT-5 Nano via Vercel AI SDK 6  | Streaming agent with 40 tools                  |
| **Chat UI**         | AI SDK Elements                 | Pre-built chat components (PromptInput, Conversation, Message) |
| **Voice Agent**     | LiveKit Agents + Gemini 2.5 Flash Native Audio | Realtime voice AI with 35 tools via Silero VAD |
| **MCP Server**      | Model Context Protocol (stdio)  | 42 tools for IDE/CLI integration               |
| **Embeddings**      | GPT-5 Nano `text-embedding-3-small` | 512-dimensional job/candidate vectors     |
| **CV Parsing & Matching** | Gemini 3 Flash            | CV parsing, enrichment, structured matching    |
| **Judge Verdict**   | Grok 4                          | Independent AI review of match results         |
| **Background Jobs** | Trigger.dev v4                  | Cron (every 4h), long-running scrape tasks     |
| **File Storage**    | Vercel Blob                     | CV files (PDF/DOCX)                            |
| **Styling**         | Tailwind CSS 4 + shadcn/ui      | Design system with dark/light themes           |
| **Validation**      | Zod                             | Schema validation for scraped data             |
| **Linting**         | Biome                           | Fast linting and formatting                    |
| **Code Quality**    | [Qlty CLI](https://qlty.sh)     | Universal quality gate for AI agents           |
| **Testing**         | Vitest + Playwright             | Unit tests + browser automation                |
| **Deployment**      | Vercel                          | Edge deployment + Trigger.dev workers          |
| **Package Manager** | pnpm 9.15                       | Fast, disk-efficient installs                  |

---

## Project Structure

```
motian/
├── agent/                        # Standalone LiveKit voice agent package
├── app/                          # Next.js App Router
│   ├── api/                      # 22 API route groups (Dutch paths)
│   │   ├── chat/                 # AI chat streaming endpoint
│   │   ├── cron/                 # Scheduled tasks (scrape, expiry, retention)
│   │   ├── gdpr/                 # GDPR Art 15/17 endpoints
│   │   ├── opdrachten/           # Job CRUD
│   │   ├── kandidaten/           # Candidate CRUD
│   │   ├── matches/              # AI match operations
│   │   ├── sollicitaties/        # Application pipeline
│   │   ├── interviews/           # Interview scheduling
│   │   ├── berichten/            # Messaging
│   │   ├── scrape/               # Manual scrape triggers
│   │   ├── scraper-configuraties/# Platform config management
│   │   ├── cv-file/              # CV file retrieval
│   │   ├── cv-upload/            # CV upload to Vercel Blob
│   │   ├── embeddings/           # Embedding backfill
│   │   ├── events/               # SSE event stream
│   │   ├── reports/              # Platform reports
│   │   └── gezondheid/           # Health check
│   ├── opdrachten/               # Job listing & detail pages
│   ├── professionals/            # Candidate directory
│   ├── matching/                 # AI matching dashboard
│   ├── pipeline/                 # Scrape history
│   ├── scraper/                  # Scraper configuration UI
│   ├── interviews/               # Interview management
│   ├── messages/                 # Communication center
│   └── overzicht/                # Overview dashboard
├── components/                   # React components
│   ├── ui/                       # shadcn/ui primitives (24 components)
│   ├── chat/                     # Full-screen chat page
│   └── *.tsx                     # App-specific components
├── src/
│   ├── ai/
│   │   ├── agent.ts              # AI agent config + system prompt
│   │   └── tools/                # 40 tool definitions (chat)
│   ├── components/ai-elements/   # AI SDK Elements (PromptInput, Conversation, Message)
│   ├── mcp/                      # MCP server (42 tools, stdio protocol)
│   │   ├── server.ts             # MCP server entry point
│   │   └── tools/                # Tool modules (matching, gdpr-ops, etc.)
│   ├── voice-agent/              # LiveKit voice agent (35 tools)
│   │   ├── main.ts               # Entry point — Gemini 2.5 Flash + Silero VAD
│   │   └── agent.ts              # MotianAgent with direct service imports
│   ├── db/
│   │   ├── schema.ts             # 9 tables with pgvector
│   │   └── index.ts              # Neon serverless connection
│   ├── services/
│   │   ├── scrapers/             # Platform-specific scrapers
│   │   │   ├── flextender.ts     # AJAX + CSRF token scraping
│   │   │   ├── striive.ts        # Playwright browser automation
│   │   │   └── opdrachtoverheid.ts # Public JSON API
│   │   ├── scrape-pipeline.ts    # Orchestration
│   │   ├── normalize.ts          # Zod validation + upsert
│   │   ├── ai-enrichment.ts      # Gemini-powered enrichment
│   │   ├── embedding.ts          # OpenAI vector generation
│   │   ├── jobs.ts               # Barrel: job API (searchJobsUnified, listJobs, hybridSearch)
│   │   ├── jobs/                 # Job service modules (repository, filters, stats, list, search)
│   │   ├── auto-matching.ts      # 3-layer matching engine
│   │   ├── structured-matching.ts # Gemini structured matching
│   │   ├── match-judge.ts        # Grok independent judge verdict
│   │   ├── cv-parser.ts          # Gemini CV parsing
│   │   ├── scoring.ts            # Candidate-job scoring
│   │   ├── gdpr.ts               # GDPR compliance (Art 15/17)
│   │   └── ...                   # Other domain services
│   ├── lib/                      # Utilities (rate-limit, etc.)
│   └── schemas/                  # Zod validation schemas
├── .qlty/qlty.toml               # Committed Qlty CLI configuration
├── tests/                        # Vitest test suites
├── scripts/                      # CLI utilities & backfill scripts
├── docs/                         # Architecture documentation
├── drizzle/                      # Database migrations
├── extension/                    # Standalone WXT browser extension
├── fumadocs/                     # Standalone Fumadocs/Next.js docs site
├── Justfile                      # Task runner commands
└── vercel.json                   # Cron job configuration
```

---

## Scrapers

| Platform             | Method                                                             | Auth              | Source                                      |
| -------------------- | ------------------------------------------------------------------ | ----------------- | ------------------------------------------- |
| **Flextender**       | AJAX POST with `widget_config` CSRF token + detail page enrichment | None (public)     | `src/services/scrapers/flextender.ts`       |
| **Striive**          | Playwright browser automation                                      | Login credentials | `src/services/scrapers/striive.ts`          |
| **Opdrachtoverheid** | Public JSON API with pagination                                    | None (public)     | `src/services/scrapers/opdrachtoverheid.ts` |

### Scrape Pipeline

```mermaid
graph LR
    A[Platform Config] --> B[Scrape Raw Data]
    B --> C[Zod Normalize]
    C --> D[Upsert to DB]
    D --> E[Gemini Enrich]
    E --> F[OpenAI Embed]
    F --> G[Ready for Search]

    style A fill:#f59e0b,color:#000
    style G fill:#10b981,color:#000
```

Each scraper implements a common interface and is orchestrated by `runScrapePipeline()`:

1. Fetches active configs from `scraper_configs`
2. Runs the platform-specific scraper
3. Normalizes data through Zod schemas
4. Upserts via `(platform, externalId)` composite unique key
5. Enriches with Gemini (AI summary, skills, seniority)
6. Generates 512d OpenAI embeddings for vector search

---

## Frontend Pages

| Route              | Page           | Description                                                        |
| ------------------ | -------------- | ------------------------------------------------------------------ |
| `/overzicht`       | Dashboard      | KPI overview with aggregate statistics                             |
| `/opdrachten`      | Vacancies      | Filterable job listing with platform, province, and rate filters   |
| `/opdrachten/[id]` | Vacancy Detail | Full job details with formatted descriptions and competence badges |
| `/professionals`   | Candidates     | Candidate directory and profiles                                   |
| `/matching`        | AI Matching    | CV Analyse (drag-and-drop SSE) + Koppelen tab with 3-layer matching |
| `/pipeline`        | Pipeline       | Scrape run history and status monitoring                           |
| `/scraper`         | Configuration  | Platform scraper settings and manual triggers                      |
| `/chat`            | AI Chat        | Full-screen chat with model picker, voice mode, session history    |
| `/settings`        | Settings       | Platform settings (matching, data management, notifications)       |

### Key UI Components

| Component | Description |
|-----------|------------|
| `PipelineProgress` | Step stepper with animated status icons (pending/active/complete/error) |
| `CvProfileCard` | Parsed CV display with skill proficiency bars, experience, education |
| `CvMatchCard` | Match result card with score ring, recommendation badge, criteria breakdown |
| `ScoreRing` | SVG circular progress indicator with color-coded scores |
| `CvDocumentViewer` | Split-screen PDF viewer for CV review |

### Chat (`/chat`)

Full-screen AI chat built with **AI SDK Elements** components:

- **Model Picker**: Gemini 3.1 Flash Lite, Gemini 3 Flash, GPT-5 Nano, Grok 4
- **Voice Mode**: speech input toggle for hands-free interaction
- **Session History**: sidebar with previous conversations
- **CV Upload**: upload CVs directly in chat for analysis
- **GenUI Cards**: rich visualizations for jobs, candidates, and matches
- **Reasoning**: collapsible AI model thinking steps
- **40 Tools**: full access to all platform operations
- **AI Elements**: `PromptInput`, `Conversation`, `Message` with Streamdown (CJK/code/math/mermaid)

### Voice Agent

Realtime voice AI agent via **LiveKit Agents**:

- **Model**: Gemini 2.5 Flash Native Audio (`gemini-2.5-flash-native-audio-preview-12-2025`)
- **VAD**: Silero Voice Activity Detection
- **Language**: Dutch (automatic greeting)
- **35 Tools**: direct service imports — no HTTP overhead
- **Start**: `pnpm voice-agent:dev` (development) or `pnpm voice-agent:start` (production)

### MCP Server

Model Context Protocol server for IDE and CLI integration:

- **Protocol**: stdio transport
- **42 Tools**: candidates, jobs, matches, applications, interviews, messages, GDPR, operations, analytics, scraping
- **Integration**: works with Claude Code, Cursor, Windsurf, and other MCP-compatible clients
- **Start**: `pnpm mcp`

---

## Code Quality with Qlty

[Qlty CLI](https://qlty.sh) gives your AI coding tools a universal "quality gate" for code linting, auto-formatting, and maintainability checks. When you let your coding agent run Qlty as part of its workflow, it can automatically clean up code, catch issues early, and ship changes that pass the same standards you expect from human contributors.

### How It Works

```mermaid
graph LR
    subgraph Agent["🤖 AI Coding Agent"]
        CODE[Generate Code]
        FMT["qlty fmt"]
        CHECK["qlty check --fix"]
    end

    subgraph Quality["✅ Qlty Quality Gate"]
        LINT[Linting]
        FORMAT[Auto-formatting]
        MAINTAIN[Maintainability]
    end

    subgraph Output["📦 Result"]
        CLEAN[Clean Code]
        COMMIT[Git Commit]
    end

    CODE --> FMT --> FORMAT
    FMT --> CHECK --> LINT
    CHECK --> MAINTAIN
    FORMAT --> CLEAN
    LINT --> CLEAN
    MAINTAIN --> CLEAN
    CLEAN --> COMMIT

    style CLEAN fill:#10b981,color:#000
```

### Requirements

- Qlty CLI installed and available on `$PATH`, or install it with `INSTALL_QLTY=1 bash ./scripts/setup-codex-cloud.sh`
- Repo-specific Qlty configuration lives in committed `.qlty/qlty.toml`; the rest of generated `.qlty/` output is excluded

### AI Agent Integration

Qlty integrates with most AI coding agents that can run shell commands:

| Agent          | Instructions File                 |
| -------------- | --------------------------------- |
| Claude Code    | `CLAUDE.md`                       |
| Cursor         | `AGENTS.md`                       |
| OpenAI Codex   | `AGENTS.md`                       |
| GitHub Copilot | `.github/copilot-instructions.md` |

#### Project Memory Integration

Add the following instructions to your agent configuration file:

```
1. Before committing, ALWAYS run auto-formatting with `qlty fmt`
2. Before finishing, ALWAYS run `qlty check --fix --level=low` and fix any lint errors
```

#### Git Hooks Integration

Qlty can be run through Git hooks to enforce quality gates for both human and AI commits:

- **Pre-commit hook**: `qlty fmt` — automatic code formatting
- **Pre-push hook**: `qlty check` — full lint and quality check

See the [Qlty Git Hooks documentation](https://docs.qlty.sh/cli/git-hooks) for more details.

> 📖 Learn more: [Coding with AI Agents](https://docs.qlty.sh/cli/coding-with-ai-agents)

---

## Getting Started

### Prerequisites

- **Node.js** available on `$PATH` (**22.x recommended / CI-validated**)
- **corepack** available on `$PATH` (bootstrap activates the pinned `pnpm@9.15.0`)
- **[Just](https://github.com/casey/just)** task runner (optional but recommended)
- **[Qlty CLI](https://qlty.sh)** code quality (optional but recommended)
- **Neon** PostgreSQL database with `pgvector` extension
- API keys for OpenAI, Anthropic (or Google)

### Installation

```bash
# Clone the repository
git clone https://github.com/RyanLisse/motian.git
cd motian

# Install dependencies and create .env.local via the repo-pinned pnpm version
bash ./scripts/setup-codex-cloud.sh
```

The script expects Node and corepack to already be available, then bootstraps the `pnpm` version pinned in `package.json`.

Add `INSTALL_QLTY=1` if you also want bootstrap to install the Qlty CLI when it is missing. `INSTALL_PLAYWRIGHT=1` also installs Chromium for browser tests.

### Standalone subprojects

- `pnpm install` from the repo root now bootstraps `agent/`, `fumadocs/`, and `extension/` through `pnpm-workspace.yaml`.
- `agent/` and `fumadocs/` keep their own `pnpm-lock.yaml` files for fully standalone installs.
- `extension/` intentionally uses the root `pnpm-lock.yaml` as its pinned dependency source.
- See each subproject README for build/typecheck commands and install-generated artifacts such as `extension/.wxt/tsconfig.json`.

### Environment Variables

```bash
# Database
DATABASE_URL=postgres://user:pass@host.neon.tech/dbname?sslmode=verify-full

# AI — Chat & Embeddings
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Scraping — Authenticated Platforms
STRIIVE_USERNAME=...
STRIIVE_PASSWORD=...

# Google AI (Gemini — CV parsing & enrichment)
GOOGLE_GENERATIVE_AI_API_KEY=AIza...

# xAI Grok (Judge — independent match review)
X_AI_API_KEY=xai-...

# Security
ENCRYPTION_KEY=...   # openssl rand -base64 32
API_SECRET=...       # Bearer token for external API clients
ALLOWED_ORIGINS=http://localhost:3002,http://127.0.0.1:3002

# Sentry (error tracking)
SENTRY_DSN=https://xxx@xxx.ingest.sentry.io/xxx

# PostHog (product analytics)
NEXT_PUBLIC_POSTHOG_KEY=phc_...

# Slack (recruiter notifications — optional)
SLACK_BOT_TOKEN=xoxb-...
SLACK_CHANNEL_ID=C0...

# LiveKit (voice agent — optional)
LIVEKIT_URL=wss://your-project.livekit.cloud
LIVEKIT_API_KEY=API...
LIVEKIT_API_SECRET=...

# Public API / docs base URL (optional, otherwise request origin)
PUBLIC_API_BASE_URL=http://localhost:3002

# External host binding for local dev/start
HOSTNAME=0.0.0.0
PORT=3002
```

### Database Setup

```bash
# Push schema to Neon
pnpm db:push

# Or generate and run migrations
pnpm db:generate
```

### Development

```bash
# Start dev server (default port 3002, externally reachable via HOSTNAME; override with PORT)
just dev
# or
pnpm dev

# Run tests
just test

# Type check
just typecheck

# Lint
pnpm lint

# Qlty code quality
qlty fmt                       # Auto-formatting
qlty check --fix --level=low   # Lint + fix
```

### Useful Commands

```bash
# Trigger manual scrape
just scrape

# Scrape specific platform
just scrape-platform flextender

# Health check
just health

# Open pages in browser
just dashboard            # Overview
just opdrachten           # Vacancies
just chat                 # AI Chat

# Lint and typecheck
just lint                 # Biome lint
just lint-fix             # Biome lint with auto-fix
just typecheck            # TypeScript check

# Browser verification (optional; requires agent-browser CLI)
# agent-browser open http://localhost:3002/ && agent-browser snapshot -i

# Metrics and benchmarks (see docs/metrics/README.md)
just baseline-metrics     # Record baseline (build time, env)
just benchmark-hybrid-search   # hybridSearch benchmark (requires DATABASE_URL)

# Voice agent (LiveKit)
just voice-dev            # Development mode
just voice-start          # Production mode

# MCP server and CLI
pnpm mcp
pnpm cli
```

For a list of all Just tasks: `just --list`.

---

## API Routes

All API routes use **Dutch path naming** convention.

- OpenAPI JSON: `/api/openapi`
- Interactive Scalar docs: `/api-docs`
- External clients should send `Authorization: Bearer <API_SECRET>` for protected routes.
- Cross-origin requests remain allowlist-based through `ALLOWED_ORIGINS`.

| Endpoint                     | Method    | Description                            |
| ---------------------------- | --------- | -------------------------------------- |
| `/api/openapi`               | GET       | OpenAPI JSON document                  |
| `/api/chat`                  | POST      | AI chat streaming (Vercel AI SDK)      |
| `/api/opdrachten`            | GET/POST  | List/create vacancies                  |
| `/api/opdrachten/[id]`       | GET/PATCH | Get/update vacancy                     |
| `/api/kandidaten`            | GET/POST  | List/create candidates                 |
| `/api/matches`               | GET/POST  | AI match operations                    |
| `/api/sollicitaties`         | GET/POST  | Application pipeline                   |
| `/api/interviews`            | GET/POST  | Interview scheduling                   |
| `/api/berichten`             | GET/POST  | Messages                               |
| `/api/cv-analyse`            | POST      | CV analysis SSE pipeline (upload, parse, match) |
| `/api/cv-file`               | GET       | Retrieve CV file                               |
| `/api/cv-upload`             | POST      | Upload CV file to Vercel Blob                  |
| `/api/salesforce-feed`       | GET       | Read-only XML export for Salesforce pull integrations |
| `/api/embeddings/backfill`   | POST      | Generate missing embeddings                    |
| `/api/events`                | GET       | SSE event stream                               |
| `/api/reports`               | GET       | Generate platform reports                      |
| `/api/candidates/[id]/matches` | GET    | Stored match results per candidate     |
| `/api/scrape/starten`        | POST      | Trigger manual scrape                  |
| `/api/scraper-configuraties` | GET/PATCH | Platform config                        |
| `/api/scrape-resultaten`     | GET       | Scrape run history                     |
| `/api/gdpr/[action]`         | POST      | GDPR Art 15 (export) / Art 17 (delete) |
| `/api/gezondheid`            | GET       | Health check                           |
| `/api/cron/scrape`           | GET       | Scrape pipeline (Trigger.dev cron, every 4h) |
| `/api/cron/vacancy-expiry`   | GET       | Expire old vacancies                   |
| `/api/cron/data-retention`   | GET       | GDPR data cleanup                      |
| `/api/revalidate`            | POST      | Cache revalidation                     |

Open `/api-docs` in the main app for interactive Scalar-based API documentation.

---

## Salesforce XML Feed

Motian exposes a live **read-only XML feed** for **pull-based Salesforce integrations** at `https://motian.vercel.app/api/salesforce-feed`. This is a **custom XML export**, not an OData endpoint.

- **Default entity**: `applications`
- **Supported entities**: `applications`, `jobs`, `candidates`
- **Supported query params**: `entity`, `id`, `updatedSince`, `status`, `page`, `limit`
- **Salesforce object mapping**: `Application__c`, `Job__c`, `Candidate__c`
- **Auth**: the route reuses shared `/api/*` bearer auth via `API_SECRET`, but production currently appears publicly reachable because `API_SECRET` is likely unset there

### Access via API, CLI, and MCP

```bash
# HTTP API
curl "https://motian.vercel.app/api/salesforce-feed?entity=jobs&status=open&limit=25"

# Local CLI
pnpm cli salesforce:feed --entity jobs --status open --updated-since 2026-03-01T00:00:00.000Z --limit 25

# MCP tool
{
  "name": "salesforce_feed",
  "arguments": {
    "entity": "jobs",
    "status": "open",
    "updatedSince": "2026-03-01T00:00:00.000Z",
    "limit": 25
  }
}
```

- **CLI output**: JSON containing `entity`, `count`, and the raw `xml` string
- **MCP output**: JSON containing `entity`, `count`, and the same `xml` string
- **Parity**: API, CLI, and MCP all reuse `src/services/salesforce-feed.ts`

---

## Deployment

### Vercel

The project is configured for Vercel + Trigger.dev deployment:

- **Vercel**: Next.js frontend, API routes, edge deployment
- **Trigger.dev v4**: Background jobs and cron scheduling
  - Scrape pipeline — every 4 hours (`0 */4 * * *`)
  - Vacancy expiry check — daily
  - Data retention cleanup — daily
- **Environment**: Set all vars from `.env.example` in Vercel + Trigger.dev dashboards
- **Build**: `pnpm build` (automatic on push)

### Pre-PR Checklist

```bash
# All in one
pnpm run harness:pre-pr

# Or individually
pnpm lint              # Biome lint
qlty check             # Qlty quality check
pnpm exec tsc --noEmit # TypeScript check
pnpm test              # Vitest suite
```

---

## Contributing

1. Find work: `bv --robot-next`
2. Claim it: `bd update <id> --status in_progress`
3. Make minimal, focused changes
4. Run `pnpm lint` and `qlty check` before committing
5. Use [conventional commits](https://www.conventionalcommits.org/):
   ```
   feat: add candidate matching endpoint
   fix: handle empty search query in hybrid search
   ```
6. Push and close: `bd close <id>`

---

## License

Private — All rights reserved.
