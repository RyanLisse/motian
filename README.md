<div align="center">

# 🏢 Motian

**AI-gedreven Recruitment Operations Platform**

_Scrapen → Normaliseren → Verrijken → Matchen → Aannemen_

> **Interactieve visuele documentatie**: Open [`docs/visual-explainer.html`](docs/visual-explainer.html) in een browser voor diagrammen en flowcharts.

[![Next.js 16](https://img.shields.io/badge/Next.js-16-black?logo=next.js)](https://nextjs.org)
[![Neon PostgreSQL](https://img.shields.io/badge/Neon-PostgreSQL-00e599?logo=postgresql)](https://neon.tech)
[![Vercel AI SDK](https://img.shields.io/badge/AI%20SDK-6.0-blue?logo=vercel)](https://sdk.vercel.ai)
[![Drizzle ORM](https://img.shields.io/badge/Drizzle-ORM-c5f74f)](https://orm.drizzle.team)
[![Qlty](https://img.shields.io/badge/Qlty-Code%20Quality-7c3aed)](https://qlty.sh)
[![pnpm](https://img.shields.io/badge/pnpm-9.15-f69220?logo=pnpm)](https://pnpm.io)

🇳🇱 **Nederlands** · [🇬🇧 English](README.en.md)

</div>

---

## Overzicht

Motian is een **Nederlands recruitment operations platform** dat vacatures automatisch verzamelt van meerdere overheids- en detacheringsportalen, verrijkt met AI en intelligente kandidaat-matching biedt via hybride vector- + tekstzoekfunctionaliteit.

Gebouwd voor recruiters en detacheringsbureaus die actief zijn in de Nederlandse publieke sector.

---

## Architectuur

### Systeemoverzicht

```mermaid
graph TB
    subgraph Bronnen["🌐 Externe Bronnen"]
        FX[Flextender]
        ST[Striive]
        OO[Opdrachtoverheid]
    end

    subgraph Pipeline["⚙️ Scrape Pipeline — Trigger.dev"]
        SC[Scraper Engine]
        NR[Normaliseren — Zod]
        EN[Verrijken — Gemini 3 Flash]
        EM[Embedden — GPT-5 Nano 512d]
    end

    subgraph DB["🗄️ Neon PostgreSQL + pgvector"]
        JOBS[(opdrachten)]
        CAND[(kandidaten)]
        MATCH[(matches)]
        APP[(sollicitaties)]
        INT[(interviews)]
        MSG[(berichten)]
        SCFG[(scraper_configs)]
        SRES[(scrape_resultaten)]
        GDPR[(gdpr_audit_log)]
    end

    subgraph Matching["🎯 3-Laags Matching Engine"]
        QS[Quick Score — 60% regels + 40% vector]
        DM[Deep Match — Gemini 3 Flash]
        JV[Judge Verdict — Grok 4]
    end

    subgraph CVPipeline["📄 CV Analyse — SSE Stream"]
        UP[Upload → Vercel Blob]
        PA[Parse → Gemini 3 Flash]
        DD[Dedupliceren]
        AM[Auto-Match → Top 3]
    end

    subgraph Zoeken["🔍 Hybride Zoeken"]
        TXT[Tekst — ILIKE]
        VEC[Vector — pgvector cosine]
        RRF[RRF Samenvoegen k=60]
    end

    subgraph AI["🤖 AI Agent"]
        AGENT[GPT-5 Nano]
        TOOLS[11 Tools]
        STREAM[streamText + maxSteps]
    end

    subgraph Frontend["🖥️ Next.js 16 Frontend"]
        PAGES[7 Pagina's — App Router]
        CHAT[Chat Zijpaneel — Cmd+J / Ctrl+J]
        THEME[Donker/Licht Thema]
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
    CHAT --> PAGES
    PAGES --> THEME
```

### Dataflow — Van Scrape tot Zoeken

```mermaid
sequenceDiagram
    participant Cron as ⏰ Trigger.dev Cron (4u)
    participant Pipeline as ⚙️ runScrapePipeline()
    participant Scraper as 🕷️ Platform Scraper
    participant Zod as ✅ Zod Normalisatie
    participant Gemini as 🧠 Gemini 3 Flash
    participant OpenAI as 🔢 GPT-5 Nano Embed
    participant DB as 🗄️ Neon DB

    Cron->>Pipeline: Elke 4 uur
    Pipeline->>Scraper: Actieve configs ophalen

    loop Per Platform
        Scraper->>Scraper: Vacatures ophalen (throws on failure)
        Scraper->>Zod: Ruwe vacaturedata
        Zod->>DB: Upsert (platform, externalId)
        Zod-->>Gemini: Batch verrijken
        Gemini->>DB: AI samenvatting, vaardigheden, senioriteit
        Gemini-->>OpenAI: Embedding tekst genereren
        OpenAI->>DB: 512d vector embedding
    end

    Note over DB: Vacatures nu doorzoekbaar via<br/>tekst ILIKE + vector cosine
```

### AI Agent Tool Architectuur

```mermaid
graph LR
    subgraph Agent["🤖 AI Agent — GPT-5 Nano"]
        SYS[Systeemprompt — Nederlands]
        CTX[Pagina Context Detectie]
    end

    subgraph Tools["🔧 11 Tools"]
        T1[queryOpdrachten]
        T2[getOpdrachtDetail]
        T3[matchKandidaten]
        T4[analyseData]
        T5[triggerScraper]
        T6[kandidaten]
        T7[berichten]
        T8[interviews]
        T9[sollicitaties]
        T10[matches]
    end

    subgraph Diensten["📦 Service Laag"]
        S1[hybridSearch]
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

### Hybride Zoeken — Reciprocal Rank Fusion

```mermaid
graph TD
    Q[Gebruikerszoekopdracht] --> A[Tekst Zoeken — ILIKE]
    Q --> B[Vector Zoeken — pgvector cosine]

    A --> |Rangschik op relevantie| RA[Tekst Resultaten]
    B --> |Rangschik op gelijkenis| RB[Vector Resultaten]

    RA --> RRF["RRF Samenvoegen<br/>score = Σ 1/(k + rank)<br/>k = 60"]
    RB --> RRF

    RRF --> FINAL[Definitieve Rangschikking]

    style RRF fill:#4f46e5,color:#fff
```

### Database Schema — Entiteit Relaties

```mermaid
erDiagram
    scraper_configs ||--o{ scrape_results : "volgt"
    jobs ||--o{ job_matches : "gematcht met"
    jobs ||--o{ applications : "gesolliciteerd op"
    candidates ||--o{ job_matches : "gematcht met"
    candidates ||--o{ applications : "solliciteert"
    applications ||--o{ interviews : "ingepland"
    applications ||--o{ messages : "communicatie"

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
        text stage "nieuw-screening-interview-aanbod-aangenomen"
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
        text direction "inkomend/uitgaand"
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
        text status "geslaagd/mislukt"
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

### Sollicitatie Pipeline

```mermaid
stateDiagram-v2
    [*] --> Nieuw: Sollicitatie aangemaakt
    Nieuw --> Screening: Recruiter beoordeelt
    Screening --> Interview: Kandidaat geselecteerd
    Interview --> Aanbod: Interview geslaagd
    Aanbod --> Aangenomen: Aanbod geaccepteerd
    Aanbod --> Afgewezen: Aanbod afgewezen

    Screening --> Afgewezen: Niet gekwalificeerd
    Interview --> Afgewezen: Interview niet geslaagd

    Afgewezen --> [*]
    Aangenomen --> [*]
```

### CV Analyse Pipeline (SSE)

```mermaid
sequenceDiagram
    participant User as 👤 Recruiter
    participant UI as 🖥️ CV Analyse Tab
    participant API as 📡 /api/cv-analyse (SSE)
    participant Blob as 📦 Vercel Blob
    participant Gemini as 🧠 Gemini 3 Flash
    participant DB as 🗄️ Neon DB
    participant Match as 🎯 Matching Engine

    User->>UI: CV slepen (PDF/DOCX)
    UI->>API: POST FormData

    API->>Blob: Bestand uploaden
    API-->>UI: SSE: upload ✓
    API->>Gemini: CV parseren
    API-->>UI: SSE: parse ✓ (naam, rol)
    API->>DB: Dedupliceren (email/naam)
    API-->>UI: SSE: deduplicate ✓
    API->>Match: Auto-match top 3 vacatures
    API-->>UI: SSE: match ✓ (N matches)
    API-->>UI: SSE: done + volledig resultaat

    UI->>UI: Volledig scherm resultaatweergave
```

### 3-Laags Matching Engine

```mermaid
graph LR
    subgraph Laag1["⚡ Laag 1: Quick Score"]
        RULES[60% Regelgebaseerd<br/>skills, ervaring, locatie, tarief]
        VECTOR[40% Vector Similariteit<br/>pgvector cosine 512d]
    end

    subgraph Laag2["🧠 Laag 2: Deep Match — Gemini"]
        KO[KNOCKOUT<br/>Harde eisen — pass/fail]
        GUN[GUNNING<br/>Gescoorde criteria — 1-5 sterren]
        PROC[PROCESS<br/>Proceseisen — pass/fail]
    end

    subgraph Laag3["⚖️ Laag 3: Judge — Grok 4"]
        JUDGE[Onafhankelijke Review<br/>Eigen score + motivatie]
    end

    RULES --> QS[Quick Score ≥ 40%]
    VECTOR --> QS
    QS --> |Top 3| KO
    KO --> GUN --> PROC --> REC[Aanbeveling<br/>go / no-go / conditional]
    REC --> JUDGE --> FINAL[Eindresultaat<br/>+ risicoprofiel]

    style QS fill:#f59e0b,color:#000
    style REC fill:#4f46e5,color:#fff
    style FINAL fill:#10b981,color:#000
```

### Cron Planning

```mermaid
gantt
    title Geautomatiseerde Taken — Trigger.dev
    dateFormat HH:mm
    axisFormat %H:%M

    section Onderhoud
    Data Retentie Opschoning      :02:00, 30min
    Vacature Verloopcontrole      :03:00, 15min

    section Scraping (elke 4 uur)
    Platform Scrape Pipeline      :00:00, 45min
    Platform Scrape Pipeline      :04:00, 45min
    Platform Scrape Pipeline      :08:00, 45min
```

---

## Technologie Stack

| Laag               | Technologie                     | Doel                                      |
| ------------------ | ------------------------------- | ----------------------------------------- |
| **Framework**      | Next.js 16 (App Router)         | Server Components, API Routes, Turbopack  |
| **Database**       | Neon PostgreSQL + pgvector      | Serverless Postgres met vector gelijkenis |
| **ORM**            | Drizzle ORM                     | Type-veilig schema en queries             |
| **AI Chat**        | GPT-5 Nano via Vercel AI SDK 6  | Streaming agent met tool calling          |
| **Embeddings**     | GPT-5 Nano `text-embedding-3-small` | 512-dimensionale job/kandidaat vectoren |
| **CV Parsing & Matching** | Gemini 3 Flash           | CV parsing, verrijking, gestructureerd matchen |
| **Judge Verdict**  | Grok 4                          | Onafhankelijke AI beoordeling van matches |
| **Achtergrondtaken** | Trigger.dev v4                | Cron (elke 4u), langlopende scrape taken  |
| **Bestandsopslag** | Vercel Blob                     | CV bestanden (PDF/DOCX)                   |
| **Styling**        | Tailwind CSS 4 + shadcn/ui      | Design systeem met donker/licht thema     |
| **Validatie**      | Zod                             | Schema validatie voor gescrapete data     |
| **Linting**        | Biome                           | Snelle linting en formatting              |
| **Code Kwaliteit** | [Qlty CLI](https://qlty.sh)     | Universele kwaliteitspoort voor AI agents |
| **Testen**         | Vitest + Playwright             | Unit tests + browser automatisering       |
| **Deployment**     | Vercel                          | Edge deployment + Trigger.dev workers     |
| **Pakketbeheer**   | pnpm 9.15                       | Snelle, schijf-efficiënte installaties    |

---

## Projectstructuur

```
motian/
├── app/                          # Next.js App Router
│   ├── api/                      # 14 API route groepen (Nederlandse paden)
│   │   ├── chat/                 # AI chat streaming endpoint
│   │   ├── cron/                 # Geplande taken (scrape, verloop, retentie)
│   │   ├── gdpr/                 # AVG Art 15/17 endpoints
│   │   ├── opdrachten/           # Vacature CRUD
│   │   ├── kandidaten/           # Kandidaat CRUD
│   │   ├── matches/              # AI match operaties
│   │   ├── sollicitaties/        # Sollicitatie pipeline
│   │   ├── interviews/           # Interview planning
│   │   ├── berichten/            # Berichtenverkeer
│   │   ├── scrape/               # Handmatige scrape triggers
│   │   ├── scraper-configuraties/# Platform configuratie beheer
│   │   └── gezondheid/           # Gezondheidscheck
│   ├── opdrachten/               # Vacature overzicht & detailpagina's
│   ├── professionals/            # Kandidaten directory
│   ├── matching/                 # AI matching dashboard
│   ├── pipeline/                 # Scrape geschiedenis
│   ├── scraper/                  # Scraper configuratie UI
│   ├── interviews/               # Interview beheer
│   ├── messages/                 # Communicatiecentrum
│   └── overzicht/                # Dashboard overzicht
├── components/                   # React componenten
│   ├── ui/                       # shadcn/ui primitieven (24 componenten)
│   ├── chat/                     # AI chat zijpaneel
│   └── *.tsx                     # App-specifieke componenten
├── src/
│   ├── ai/
│   │   ├── agent.ts              # AI agent configuratie + systeemprompt
│   │   └── tools/                # 11 tool definities
│   ├── db/
│   │   ├── schema.ts             # 9 tabellen met pgvector
│   │   └── index.ts              # Neon serverless verbinding
│   ├── services/
│   │   ├── scrapers/             # Platform-specifieke scrapers
│   │   │   ├── flextender.ts     # AJAX + CSRF token scraping
│   │   │   ├── striive.ts        # Playwright browser automatisering
│   │   │   └── opdrachtoverheid.ts # Publieke JSON API
│   │   ├── scrape-pipeline.ts    # Orkestratie
│   │   ├── normalize.ts          # Zod validatie + upsert
│   │   ├── ai-enrichment.ts      # Gemini-aangedreven verrijking
│   │   ├── embedding.ts          # OpenAI vector generatie
│   │   ├── jobs.ts               # Vacature queries + hybride zoeken
│   │   ├── auto-matching.ts      # 3-laags matching engine
│   │   ├── structured-matching.ts # Gemini gestructureerd matchen
│   │   ├── match-judge.ts        # Grok onafhankelijke beoordeling
│   │   ├── cv-parser.ts          # Gemini CV parsing
│   │   ├── scoring.ts            # Kandidaat-vacature scoring
│   │   ├── gdpr.ts               # AVG compliance (Art 15/17)
│   │   └── ...                   # Overige domein services
│   ├── lib/                      # Hulpmiddelen (rate-limit, etc.)
│   └── schemas/                  # Zod validatie schema's
├── .qlty/qlty.toml               # Qlty CLI configuratie
├── tests/                        # Vitest test suites
├── scripts/                      # CLI hulpmiddelen & backfill scripts
├── docs/                         # Architectuur documentatie
├── drizzle/                      # Database migraties
├── Justfile                      # Taak runner commando's
└── vercel.json                   # Cron configuratie
```

---

## Scrapers

| Platform             | Methode                                                            | Authenticatie   | Bron                                        |
| -------------------- | ------------------------------------------------------------------ | --------------- | ------------------------------------------- |
| **Flextender**       | AJAX POST met `widget_config` CSRF token + detailpagina verrijking | Geen (openbaar) | `src/services/scrapers/flextender.ts`       |
| **Striive**          | Playwright browser automatisering                                  | Inloggegevens   | `src/services/scrapers/striive.ts`          |
| **Opdrachtoverheid** | Publieke JSON API met paginering                                   | Geen (openbaar) | `src/services/scrapers/opdrachtoverheid.ts` |

### Scrape Pipeline

```mermaid
graph LR
    A[Platform Config] --> B[Ruwe Data Scrapen]
    B --> C[Zod Normalisatie]
    C --> D[Upsert naar DB]
    D --> E[Gemini Verrijking]
    E --> F[OpenAI Embedden]
    F --> G[Klaar voor Zoeken]

    style A fill:#f59e0b,color:#000
    style G fill:#10b981,color:#000
```

Elke scraper implementeert een gemeenschappelijke interface en wordt georkestreerd door `runScrapePipeline()`:

1. Actieve configuraties ophalen uit `scraper_configs`
2. Platform-specifieke scraper uitvoeren
3. Data normaliseren via Zod schema's
4. Upserten via `(platform, externalId)` samengestelde unieke sleutel
5. Verrijken met Gemini (AI samenvatting, vaardigheden, senioriteit)
6. 512d OpenAI embeddings genereren voor vector zoeken

---

## Frontend Pagina's

| Route              | Pagina          | Beschrijving                                                                      |
| ------------------ | --------------- | --------------------------------------------------------------------------------- |
| `/overzicht`       | Dashboard       | KPI overzicht met geaggregeerde statistieken                                      |
| `/opdrachten`      | Vacatures       | Filterbare vacaturelijst met platform, provincie en tarief filters                |
| `/opdrachten/[id]` | Vacature Detail | Volledige vacaturedetails met geformatteerde beschrijvingen en competentie badges |
| `/professionals`   | Kandidaten      | Kandidaten directory en profielen                                                 |
| `/matching`        | AI Matching     | CV Analyse (drag-and-drop SSE) + Koppelen tab met 3-laags matching               |
| `/pipeline`        | Pipeline        | Scrape run geschiedenis en statusmonitoring                                       |
| `/scraper`         | Configuratie    | Platform scraper instellingen en handmatige triggers                              |

### Belangrijke UI Componenten

| Component | Beschrijving |
|-----------|-------------|
| `PipelineProgress` | Stap-stepper met geanimeerde statusiconen (pending/active/complete/error) |
| `CvProfileCard` | Geparsed CV met vaardigheidsbalken, ervaring, educatie, certificeringen |
| `CvMatchCard` | Matchresultaat met score ring, aanbevelingsbadge, criteria breakdown |
| `ScoreRing` | SVG circulaire voortgangsindicator met kleurcodering |
| `CvDocumentViewer` | Split-screen PDF viewer voor CV review |

### Chat Zijpaneel

- **Schakelen**: `Cmd+J / Ctrl+J` toetsenbord sneltoets
- **Context**: detecteert automatisch huidige route en entiteit ID
- **Streaming**: `useChat()` van `@ai-sdk/react`
- **Tools**: inklapbare kaarten met spinner → vinkje status
- **Thema**: ondersteunt donker/licht modus via `next-themes`

---

## Code Kwaliteit met Qlty

[Qlty CLI](https://qlty.sh) biedt een universele "kwaliteitspoort" voor code linting, auto-formatting en onderhoudbaarheidscontroles. Wanneer je een AI coding agent laat samenwerken met Qlty, kan deze automatisch code opschonen, problemen vroegtijdig opsporen en wijzigingen doorvoeren die dezelfde standaard halen als die van menselijke bijdragers.

### Hoe Het Werkt

```mermaid
graph LR
    subgraph Agent["🤖 AI Coding Agent"]
        CODE[Code Genereren]
        FMT["qlty fmt"]
        CHECK["qlty check --fix"]
    end

    subgraph Kwaliteit["✅ Qlty Kwaliteitspoort"]
        LINT[Linting]
        FORMAT[Auto-formatting]
        MAINTAIN[Onderhoudbaarheid]
    end

    subgraph Output["📦 Resultaat"]
        CLEAN[Schone Code]
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

### Vereisten

- Qlty CLI geïnstalleerd en beschikbaar op `$PATH`
- Een Qlty analyse configuratie (`.qlty/qlty.toml`) afgestemd op je project

### Integratie met AI Agents

Qlty integreert met de meeste AI coding agents die shell-commando's kunnen uitvoeren:

| Agent          | Instructiebestand                 |
| -------------- | --------------------------------- |
| Claude Code    | `CLAUDE.md`                       |
| Cursor         | `AGENTS.md`                       |
| OpenAI Codex   | `AGENTS.md`                       |
| GitHub Copilot | `.github/copilot-instructions.md` |

#### Projectgeheugen Integratie

Voeg de volgende instructies toe aan je agent configuratiebestand:

```
1. Voer voor committen ALTIJD auto-formatting uit met `qlty fmt`
2. Voer voor afronden ALTIJD `qlty check --fix --level=low` uit en los eventuele lint fouten op
```

#### Git Hooks Integratie

Qlty kan via Git hooks worden ingezet om kwaliteitspoorten af te dwingen voor zowel menselijke als AI commits:

- **Pre-commit hook**: `qlty fmt` — automatische code formatting
- **Pre-push hook**: `qlty check` — volledige lint en kwaliteitscontrole

Zie de [Qlty Git Hooks documentatie](https://docs.qlty.sh/cli/git-hooks) voor meer details.

> 📖 Meer informatie: [Coding with AI Agents](https://docs.qlty.sh/cli/coding-with-ai-agents)

---

## Aan de Slag

### Vereisten

- **Node.js** ≥ 18
- **pnpm** ≥ 9.15
- **[Just](https://github.com/casey/just)** taak runner (optioneel maar aanbevolen)
- **[Qlty CLI](https://qlty.sh)** code kwaliteit (optioneel maar aanbevolen)
- **Neon** PostgreSQL database met `pgvector` extensie
- API sleutels voor OpenAI, Anthropic (of Google)

### Installatie

```bash
# Repository klonen
git clone https://github.com/RyanLisse/motian.git
cd motian

# Afhankelijkheden installeren
pnpm install

# Omgevingsvariabelen kopiëren
cp .env.example .env.local
```

### Omgevingsvariabelen

```bash
# Database
DATABASE_URL=postgres://user:pass@host.neon.tech/dbname?sslmode=verify-full

# AI — Chat & Embeddings
OPENAI_API_KEY=sk-...
ANTHROPIC_API_KEY=sk-ant-...

# Scraping — Geauthenticeerde Platforms
STRIIVE_USERNAME=...
STRIIVE_PASSWORD=...

# Beveiliging
ENCRYPTION_KEY=...   # openssl rand -base64 32
```

### Database Opzet

```bash
# Schema pushen naar Neon
pnpm db:push

# Of migraties genereren en uitvoeren
pnpm db:generate
```

### Ontwikkeling

```bash
# Dev server starten (poort 3001)
just dev
# of
pnpm dev

# Tests uitvoeren
just test

# Type controle
just typecheck

# Lint controle
pnpm lint

# Qlty code kwaliteit
qlty fmt                       # Auto-formatting
qlty check --fix --level=low   # Lint + fix
```

### Handige Commando's

```bash
# Handmatige scrape starten
just scrape

# Specifiek platform scrapen
just scrape-platform flextender

# Gezondheidscheck
just health

# Dashboard openen
just dashboard
```

---

## API Routes

Alle API routes gebruiken **Nederlandse padnamen**.

| Endpoint                     | Methode   | Beschrijving                               |
| ---------------------------- | --------- | ------------------------------------------ |
| `/api/chat`                  | POST      | AI chat streaming (Vercel AI SDK)          |
| `/api/opdrachten`            | GET/POST  | Vacatures ophalen/aanmaken                 |
| `/api/opdrachten/[id]`       | GET/PATCH | Vacature ophalen/bijwerken                 |
| `/api/kandidaten`            | GET/POST  | Kandidaten ophalen/aanmaken                |
| `/api/matches`               | GET/POST  | AI match operaties                         |
| `/api/sollicitaties`         | GET/POST  | Sollicitatie pipeline                      |
| `/api/interviews`            | GET/POST  | Interview planning                         |
| `/api/berichten`             | GET/POST  | Berichten                                  |
| `/api/cv-analyse`            | POST      | CV analyse SSE pipeline (upload, parse, match) |
| `/api/candidates/[id]/matches` | GET    | Opgeslagen matchresultaten per kandidaat    |
| `/api/scrape/starten`        | POST      | Handmatige scrape starten                  |
| `/api/scraper-configuraties` | GET/PATCH | Platform configuratie                      |
| `/api/scrape-resultaten`     | GET       | Scrape run geschiedenis                    |
| `/api/gdpr/[action]`         | POST      | AVG Art 15 (export) / Art 17 (verwijderen) |
| `/api/gezondheid`            | GET       | Gezondheidscheck                           |
| `/api/cron/scrape`           | GET       | Scrape pipeline (Trigger.dev cron, elke 4u) |
| `/api/cron/vacancy-expiry`   | GET       | Verlopen vacatures                         |
| `/api/cron/data-retention`   | GET       | AVG data opschoning                        |
| `/api/revalidate`            | POST      | Cache hervalidatie                         |

---

## Deployment

### Vercel

Het project is geconfigureerd voor Vercel + Trigger.dev deployment:

- **Vercel**: Next.js frontend, API routes, edge deployment
- **Trigger.dev v4**: Achtergrondtaken en cron scheduling
  - Scrape pipeline — elke 4 uur (`0 */4 * * *`)
  - Vacature verloopcontrole — dagelijks
  - Data retentie opschoning — dagelijks
- **Omgeving**: Stel alle variabelen uit `.env.example` in via Vercel + Trigger.dev dashboards
- **Build**: `pnpm build` (automatisch bij push)

### Pre-PR Checklist

```bash
# Alles in één
pnpm run harness:pre-pr

# Of individueel
pnpm lint              # Biome lint
qlty check             # Qlty kwaliteitscontrole
pnpm exec tsc --noEmit # TypeScript controle
pnpm test              # Vitest suite
```

---

## Bijdragen

1. Werk vinden: `bv --robot-next`
2. Claimen: `bd update <id> --status in_progress`
3. Minimale, gerichte wijzigingen maken
4. `pnpm lint` en `qlty check` uitvoeren voor elke commit
5. Gebruik [conventionele commits](https://www.conventionalcommits.org/):
   ```
   feat: kandidaat matching endpoint toevoegen
   fix: lege zoekopdracht afhandelen in hybride zoeken
   ```
6. Pushen en sluiten: `bd close <id>`

---

## Licentie

Privé — Alle rechten voorbehouden.
