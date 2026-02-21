**Product Requirements Document (PRD) v2.0**  
**Product:** AI-Assisted Recruitment Operations Platform  
**Version:** 2.0 (February 2026)  
**Status:** Updated based on implementation learnings (hybrid scraping, normalization layer, operational dashboard, pluggable architecture)

---

### 1. Purpose

This platform centralizes the entire recruitment workflow for assignment-based and freelance/public-sector hiring. It provides a single operational workspace by combining:

- Multi-source job ingestion (public + authenticated)
- Unified normalization & deduplication
- Intelligent job discovery
- Candidate evaluation, grading and matching
- Full application & pipeline lifecycle management
- Operator-facing AI assistance

The PRD remains **completely language-, framework- and technology-agnostic**. Any implementation (new or refactored) must preserve all functional and non-functional behaviors defined below.

---

### 2. Product Goals (unchanged + reinforced)

- Reduce time-to-shortlist by >70% through automated sourcing, normalization and first-pass AI screening.
- Eliminate context-switching with one unified workspace.
- Increase match quality with structured, explainable criteria.
- Maintain fresh market data via reliable, observable ingestion pipelines.
- Guarantee auditability and data integrity at every step.

---

### 3. Personas (unchanged)

---

### 4. Functional Scope

#### 4.1 Job Ingestion & Normalization (major update)

- Support **pluggable adapters** for any external source.
- Two ingestion modes (hybrid strategy):
  - **Public mode**: direct API, RSS or simple HTTP scraping.
  - **Authenticated mode**: browser automation / session-based login flows for platforms that require credentials.
- **Mandatory normalization layer**: convert every heterogeneous payload into a single unified `Job` model before persistence.
- Automatic deduplication using stable external identifier (URL + platform + externalId).
- Persist raw payload alongside normalized data for debugging and re-processing.
- Track every ingestion run with full metrics (found, new, duplicates, errors, duration).

#### 4.2 Scraper Configuration & Operations (major update)

- Central `ScraperConfig` entity per platform:
  - platform name
  - base URL / endpoint
  - active/paused flag
  - parameters / selectors
  - authentication credentials (encrypted)
  - schedule policy (default: every 4 hours)
- Manual + scheduled triggers.
- Full operational history (`ScrapeResult` entity):
  - timestamp, duration, jobs found/new/duplicates
  - error summary
  - status (success / partial / failed)

#### 4.3 Job Discovery (unchanged)

#### 4.4 Candidate Management (unchanged)

#### 4.5 Candidate AI Evaluation (unchanged)

#### 4.6 Candidate-to-Job Matching (unchanged)

#### 4.7 Application & Pipeline Tracking (unchanged)

#### 4.8 Operator Dashboard (new emphasis)

- Real-time Scraper Operations UI showing:
  - All platforms with active/paused toggle
  - Last run time & status
  - Yield metrics
  - One-click “Scrape Now” (single or all)
- Recent run history table with error surfacing.
- Manual trigger for any platform or full sweep.

#### 4.9 AI Assistant Experience (unchanged)

---

### 5. Out of Scope (Current Version)

(unchanged)

---

### 6. User Stories (updated)

**New/strengthened stories:**

- As an admin, I want to configure public vs authenticated scrapers so I can cover all market sources.
- As an admin, I want a unified normalization layer so every job is stored in the same structure regardless of source.
- As a recruiter, I want to see a clean, searchable catalog without duplicates.
- As an admin, I want full visibility of every scrape run (success rate, errors, yield) in one dashboard.
- As an admin, I want to pause/resume any source or trigger it manually without code changes.

---

### 7. Data Model (Domain-Level, Agnostic) – updated

#### 7.1 Core Entities (extended)

- **Job** (unified – mandatory)
  - platform, externalId (unique), externalUrl (unique)
  - title, company, location, province
  - rateMin, rateMax, currency
  - description, requirements (array), contractType
  - postedAt, scrapedAt
  - rawPayload (JSON)

- **ScraperConfig**
  - platform (unique)
  - baseUrl
  - active (boolean)
  - parameters (JSON)
  - authConfig (encrypted JSON – optional)
  - lastRunAt, lastRunStatus

- **ScrapeResult**
  - configId (foreign key)
  - platform
  - runAt, durationMs
  - jobsFound, jobsNew, duplicates
  - status, errors (JSON array)

- **Candidate**, **Application**, **Interview**, **Message** (unchanged)

#### 7.2 Integrity Rules (reinforced)

- Unique constraint on `(platform, externalId)` and on `externalUrl`
- Normalization must happen before insert (never store raw-only)
- Delete guards unchanged

---

### 8. Non-Functional Requirements (updated)

- **Extensibility**: Adding a new platform must require only a new adapter + config entry (zero core changes).
- **Reliability**: Partial failure of one platform must never stop others.
- **Observability**: Every ingestion run, normalization step and AI call must be logged with traceable IDs.
- **Security**: Auth credentials encrypted at rest; sensitive resume data isolated.
- **Performance**: Ingestion window < 15 min for 10+ platforms; search < 300 ms.

---

### 9. API & Service Contracts (Conceptual – unchanged)

---

### 10. Refactor Safety Requirements (updated)

Any future refactor must preserve:

- Hybrid public + authenticated ingestion paths
- Mandatory normalization → deduplication pipeline
- ScraperConfig + ScrapeResult entities and dashboard
- All referential integrity guards
- Explainable AI outputs
- Adapter pattern for new platforms

---

### 11. Acceptance Criteria (updated)

- Can add a new platform via config + adapter only.
- Public and authenticated platforms both succeed and land in the same unified `Job` table.
- No duplicate jobs after repeated runs (same externalId).
- Dashboard shows live config status, manual trigger works, history table is complete.
- Every run is logged in `ScrapeResult`.
- Recruiter sees clean, searchable catalog with correct normalization.

---

### 12. Key Learnings Extracted (new section – based on implementation)

- Hybrid scraping (public + authenticated browser automation) is essential for full market coverage.
- A strong, Zod-like unified schema enforced at the normalization boundary prevents downstream errors.
- Deduplication must happen at persistence level, never only in memory.
- Operational dashboard must read from persisted `ScrapeResult` logs (not in-memory state).
- Pluggable adapters + central config table make scaling to 20+ platforms trivial.
- Manual trigger + cron + queue pipeline gives maximum operator control.
- Referential integrity + soft-delete guards are non-negotiable for auditability.

---

### 13. Migration / Refactor Notes

(unchanged – still fully valid)

---

**This PRD v2.0 is now the single source of truth.**

It incorporates all learnings from building Slice 1 (public scraper + normalization + dedup) and Slice 2 (dynamic config + dashboard + history) while remaining 100% tech-stack agnostic. Any team can implement this in Go, Rust, Python, TypeScript, .NET or any other stack without functional regression.

**Appendix A: Technical Implementation Guidelines**  
**PRD v2.0 – Tech-Stack Agnostic**  
**Version:** 1.0 (February 2026)  
**Purpose:** Provide concrete, language-/framework-independent guidance so any team can implement or refactor the platform while preserving 100% functional and non-functional compliance.

---

### A.1 High-Level Architecture (Recommended)

Adopt a **clean, layered, event-driven architecture**:

```
Presentation Layer (UI / API)
        ↓
Application Services (orchestration, use-cases)
        ↓
Domain Layer (entities, value objects, domain services)
        ↓
Infrastructure Layer (adapters, repositories, external clients)
        ↓
External Systems (browsers, LLMs, queues, DB)
```

**Key flows (all asynchronous where possible):**

1. **Ingestion Pipeline**  
   Scheduler → Scrape Adapter → Normalization Service → Job Repository → (optional) Enrich Queue → AI Grading → Matching

2. **Command/Query Separation**
   - Commands: mutate (scrape, normalize, update stage)
   - Queries: read-only (search jobs, dashboard)

3. **Event Bus / Message Queue** (mandatory for reliability)  
   Use any durable queue (RabbitMQ, Kafka, Redis Streams, SQS, etc.). Events: `PlatformScrapeRequested`, `RawListingsReceived`, `JobNormalized`, `ScrapeCompleted`, etc.

---

### A.2 Core Patterns (must be implemented)

#### 2.1 Pluggable Adapter Pattern (for all external sources)

```text
interface ScraperAdapter {
  platform(): string;
  supportsAuth(): boolean;
  scrape(config: ScraperConfig): Promise<RawListing[]>;
  getStableIdentifier(listing: RawListing): string;  // for dedup
}
```

- Registry loads adapters dynamically (config-driven or discovery).
- Public adapters: HTTP client + rate-limit + retry.
- Authenticated adapters: browser automation session (headless or cloud) with credential injection.
- Adding a new platform = only new adapter class + config row (zero core changes).

#### 2.2 Normalization Layer (mandatory boundary)

Every raw payload **must** go through a `Normalizer` before persistence.

```text
interface Normalizer {
  normalize(raw: RawListing, platform: string): UnifiedJob;
}
```

- UnifiedJob = strict contract (see PRD 7.1).
- Strategy map: per-platform normalizer + fallback LLM extractor (prompt + structured output).
- Validation: fail-fast with full error context stored in `rawPayload`.
- Output always includes `externalId`, `externalUrl`, `postedAt` (parsed to UTC).

#### 2.3 Repository Pattern + Unit of Work

- JobRepository with methods: `findByExternalId`, `upsertNormalized`, `search(...)`.
- All writes inside explicit transaction for integrity.

---

### A.3 Hybrid Scraping Strategy (2026 best practice)

| Mode          | Recommended Technology (agnostic)                                             | When to use            | Cost / Reliability |
| ------------- | ----------------------------------------------------------------------------- | ---------------------- | ------------------ |
| Public        | HTTP client + structured extraction                                           | 80% of platforms       | Low / High         |
| Authenticated | Browser automation (Puppeteer/Playwright equivalent or cloud browser service) | Login-walled platforms | Medium / Very High |

- Credentials: stored encrypted (AES-256 + DB column encryption or vault).
- Rotation: proxy pool + user-agent rotation + random delays.
- Fallback: if browser fails → retry with public endpoint if available.

---

### A.4 Scheduling & Orchestration

- **Scheduler**: cron-like service OR queue scheduler (e.g. every 4h per config).
- **Worker Pool**: parallel execution per platform (max 5–10 concurrent).
- **Idempotency**: every scrape run gets unique `runId`; all side-effects are idempotent.
- **Manual Trigger**: HTTP endpoint → publishes `PlatformScrapeRequested` event.

---

### A.5 Data Persistence Guidelines

- **Relational DB** (PostgreSQL recommended but any ACID DB works).
- Constraints (enforced at DB level):
  - UNIQUE `(platform, externalId)`
  - UNIQUE `externalUrl`
  - CHECK constraints on scores, enums
  - Foreign keys + ON DELETE RESTRICT for delete guards
- Soft-delete (deletedAt) for auditability.
- JSONB columns for `rawPayload`, `requirements`, `parameters`, `errors`.

---

### A.6 Observability & Monitoring (mandatory)

Every component must emit:

- Structured logs with `correlationId` + `runId` + `platform`
- Metrics: jobsFound, jobsNew, durationMs, errorCount (Prometheus/OpenTelemetry compatible)
- Trace spans for full pipeline (Scrape → Normalize → Persist → AI)

Scraper Dashboard must query:

- `scraper_configs` (live status)
- `scrape_results` (history table)

---

### A.7 Security & Privacy (non-negotiable)

- All PII (resumes, contact data, credentials) encrypted at rest + in transit.
- Least-privilege DB roles.
- Audit log for every stage change and AI decision.
- Rate limiting + bot detection on scrapers.
- GDPR/CCPA ready: export/delete by candidate ID.

---

### A.8 Testing Strategy (TDD strongly recommended)

| Test Type   | Scope                        | Tools (agnostic)          | Frequency   |
| ----------- | ---------------------------- | ------------------------- | ----------- |
| Unit        | Normalizers, scoring logic   | Any xUnit                 | Every PR    |
| Contract    | Adapter input/output         | Pact / custom schemas     | Every PR    |
| Integration | Full scrape → normalize → DB | Testcontainers equivalent | CI          |
| End-to-End  | Dashboard + manual trigger   | Playwright/Cypress        | Nightly     |
| Load        | 20 platforms, 5k jobs        | k6 / Artillery            | Before prod |

Golden rule: **never merge without green contract test for new adapter**.

---

### A.9 Extensibility & Refactor Safety

To add a new platform:

1. Create adapter implementing `ScraperAdapter`
2. Add row to `scraper_configs`
3. (Optional) Add platform-specific normalizer
4. Deploy → done

Refactor checklist (from PRD 10):

- All events and domain contracts unchanged
- Normalization always happens before persistence
- Deduplication at DB level
- Dashboard reads persisted history

---

### A.10 Deployment & Scaling Recommendations

- Stateless services (easy horizontal scaling).
- Queue + workers for ingestion.
- Separate read replicas for Job Discovery UI.
- Blue-green or canary for zero-downtime.
- Infrastructure-as-code (Terraform/Pulumi equivalent).

---

### A.11 Estimated Effort per Slice (for planning)

| Slice | Description                            | Effort (senior dev days) |
| ----- | -------------------------------------- | ------------------------ |
| 1     | Public scraper + normalization + dedup | 3–5                      |
| 2     | Config + dashboard + history           | 4–6                      |
| 3     | Authenticated browser adapter          | 5–7                      |
| 4     | Job search UI + filters                | 4–5                      |
| 5     | AI grading + matching                  | 6–8                      |

---

**This appendix is the single technical companion to PRD v2.0.**

It translates every requirement into implementable patterns without prescribing any specific language, framework, or cloud provider. Any team can use this to build in Go, Rust, Python, Java, C#, TypeScript, or even a polyglot setup while guaranteeing no functional regression on refactor.

---

**Appendix B: Motia.dev Implementation Mapping**
**Version:** 1.0 (February 2026)
**Purpose:** Map PRD concepts to Motia primitives for the chosen tech stack.

---

### B.1 PRD Concept → Motia Primitive

| PRD Concept | Motia Implementation |
| --- | --- |
| Event Bus / Message Queue (A.1) | Motia's built-in `emit()` / `subscribes` event system |
| Scheduler (A.4) | `CronConfig` step with `cron` expression |
| Scrape Adapter (A.2) | Event step per platform, subscribing to `platform.scrape` |
| Normalization Service (A.2) | Event step subscribing to `jobs.normalize` |
| Manual Trigger HTTP endpoint (A.4) | `ApiRouteConfig` step with `POST` method |
| Dashboard Queries (A.6) | `ApiRouteConfig` steps with `GET` methods |
| Worker Pool (A.4) | Motia handles concurrent event processing internally |
| Observability / Trace IDs (A.6) | Motia's built-in `traceId` + `logger` on every handler context |
| State Management | Motia's built-in `state.set()` / `state.get()` key-value store |

### B.2 Platform Prioriteit

| # | Platform | Type | Technologie | Status |
|---|----------|------|-------------|--------|
| 1 | **Striive.com** | Authenticated | Stagehand/Browserbase | Eerste platform (Slice 1) |
| 2 | Indeed.nl | Public | Firecrawl | Slice 3 |
| 3 | LinkedIn | Authenticated | Stagehand/Browserbase | Slice 3 |

**Striive** (HeadFirst Group) is het grootste freelance platform in NL met 30.000+ professionals.
Login via `login.striive.com`. Opdrachten op `/nl/opdrachten`.

### B.3 Event Topology

```
MasterScrape (cron: 0 */4 * * *)
  └── emits: platform.scrape
        ├── ScrapeIndeed (subscribes: platform.scrape, filters platform==='indeed')
        ├── ScrapeLinkedIn (subscribes: platform.scrape, filters platform==='linkedin')
        └── Scrape[NewPlatform] (subscribes: platform.scrape, filters platform==='xxx')
              └── all emit: jobs.normalize
                    └── NormalizeJobs (subscribes: jobs.normalize)
                          └── emits: scrape.completed
                                └── RecordScrapeResult (subscribes: scrape.completed)

TriggerScrape (api: POST /api/scrape/trigger)
  └── emits: platform.scrape (same pipeline)
```

### B.4 Dedup Strategy Note

PRD 7.2 requires composite unique on `(platform, externalId)`. This is stricter than single-column unique on `externalId` alone, because:
- Different platforms could theoretically reuse the same external ID
- The composite constraint ensures `indeed:12345` and `linkedin:12345` are treated as separate jobs
- Implementation: `uniqueIndex` on `(platform, external_id)` in Drizzle schema

### B.5 Kwaliteitsharnas (Harness Engineering)

Gebaseerd op OpenAI's Harness Engineering aanpak:

| Tool | Doel | Fase |
|------|------|------|
| **Ultracite** | Zero-config linting + formatting + AI agent regels | Setup |
| **Qlty CLI** | Kwaliteitspoorten + 60+ linter plugins | Pre-commit / Pre-push |
| **Vitest** | Unit + contract tests | CI |
| **Storybook** | Component library + visuele documentatie | Development |
| **Agentation** | Visuele feedback toolbar voor agents + mensen | Design review |
| **Next.js 16** | App Router UI framework | Development |
| **shadcn/ui** | Copy-paste React componenten met Tailwind | Development |
| **OpenAI Apps SDK UI** | ChatGPT design tokens + componenten (donker thema) | Design system |

### B.6 Missing PRD Entities for Future Slices

The following PRD 7.1 entities are NOT yet addressed in the implementation plan and should be added in Slice 6+:
- **Application** (stage tracking, status, timestamps)
- **Interview** (scheduling, feedback, scoring)
- **Message** (candidate communication log)

---
