# Phase 13: Application Pipeline & Communication

## Context
Phases 1-4, 10-12 complete. DB has `jobs`, `candidates`, `jobMatches`, `scraperConfigs`, `scrapeResults`. Services for applications/interviews/messages are stubs. MCP server already has full tool definitions referencing these stubs. Sidebar references `/pipeline`, `/interviews`, `/messages` pages that don't exist.

## Goal
Close the recruitment loop: matches → applications → interviews → messages. Replace all 3 stub services with real implementations backed by new DB tables.

## Deliverables

### 1. DB Schema — 3 new tables in `src/db/schema.ts`

**applications**
- id (uuid PK), jobId FK→jobs, candidateId FK→candidates, matchId FK→jobMatches (nullable)
- stage: text (new, screening, interview, offer, hired, rejected)
- source: text (match, manual, import)
- notes: text
- createdAt, updatedAt, deletedAt (soft-delete)
- Indexes: jobId, candidateId, stage, unique [jobId, candidateId]

**interviews**
- id (uuid PK), applicationId FK→applications
- scheduledAt: timestamp, duration: integer (minutes, default 60)
- type: text (phone, video, onsite, technical)
- interviewer: text, location: text
- status: text (scheduled, completed, cancelled)
- feedback: text, rating: integer (1-5)
- createdAt, updatedAt
- Indexes: applicationId, scheduledAt, status

**messages**
- id (uuid PK), applicationId FK→applications
- direction: text (inbound, outbound)
- channel: text (email, phone, platform)
- subject: text, body: text
- sentAt: timestamp (defaultNow)
- Indexes: applicationId, direction

### 2. Service Layer — replace 3 stubs

**src/services/applications.ts** (replace stub)
- listApplications(opts) — filter by jobId, candidateId, stage; soft-delete aware
- getApplicationById(id) — single with soft-delete filter
- createApplication(data) — validate stage enum, insert
- updateApplicationStage(id, stage, notes?) — update stage + updatedAt
- getApplicationStats() — count by stage using SQL aggregate

**src/services/interviews.ts** (replace stub)
- listInterviews(opts) — filter by applicationId, status
- getInterviewById(id)
- createInterview(data) — validate type + set default duration
- updateInterview(id, data) — update status/feedback/rating
- getUpcomingInterviews() — scheduled interviews where scheduledAt > now

**src/services/messages.ts** (replace stub)
- listMessages(opts) — filter by applicationId, direction, channel
- getMessageById(id)
- createMessage(data) — validate direction + channel enums, insert

### 3. API Step Endpoints

| Step file | Method | Path | Notes |
|-----------|--------|------|-------|
| steps/api/applications.step.ts | GET+POST | /api/sollicitaties | List + create |
| steps/api/application-detail.step.ts | GET+PATCH | /api/sollicitaties/:id | Get + update stage |
| steps/api/interviews.step.ts | GET+POST | /api/interviews | List + create |
| steps/api/interview-detail.step.ts | GET+PATCH | /api/interviews/:id | Get + update |
| steps/api/messages.step.ts | GET+POST | /api/berichten | List + create |

### 4. UI Pages

**app/pipeline/page.tsx** — Application Pipeline
- KPI row: total applications, by-stage counts
- Stage filter tabs: Alle, Nieuw, Screening, Interview, Aanbod, Geplaatst, Afgewezen
- Application cards with candidate name, job title, stage badge, dates
- Pagination

**app/interviews/page.tsx** — Interviews
- KPI row: upcoming count, completed today, this week total
- Filter by status (scheduled/completed/cancelled)
- Interview cards with candidate, job, date/time, type, interviewer
- Empty state

**app/messages/page.tsx** — Messages
- KPI row: total messages, inbound, outbound
- Filter by direction, channel
- Message list with subject, body preview, channel badge, timestamp
- Empty state

### 5. Tests — `tests/phase13-pipeline-communication.test.ts`
- Schema table exports exist
- Service function exports are functions
- Validate enum values for stage, status, direction, channel

### 6. MCP server — no changes needed
Already wired to import from service files. Once stubs are replaced, MCP tools will work.

## Swarm Agent Assignment

| Agent | Files | Description |
|-------|-------|-------------|
| 1: Schema | src/db/schema.ts | Add 3 tables + run db:generate + db:push |
| 2: Services | src/services/applications.ts, interviews.ts, messages.ts | Replace all 3 stubs |
| 3: API Steps | steps/api/applications.step.ts, application-detail.step.ts, interviews.step.ts, interview-detail.step.ts, messages.step.ts | 5 API endpoints |
| 4: UI Pages | app/pipeline/page.tsx, app/interviews/page.tsx, app/messages/page.tsx | 3 new pages |
| 5: Tests | tests/phase13-pipeline-communication.test.ts | Comprehensive test suite |

## Success Criteria
- [ ] 3 new DB tables created and pushed to Neon
- [ ] 3 service stubs replaced with real implementations
- [ ] 5 API endpoints functional
- [ ] 3 UI pages render (empty state + data state)
- [ ] All tests pass (existing 102 + new)
- [ ] Zero new TS errors
- [ ] MCP tools for applications/interviews/messages work
