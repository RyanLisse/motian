---
title: "Phase 6: Application Pipeline — Full Lifecycle Tracking"
type: feat
date: 2026-02-21
---

# Phase 6: Application Pipeline

## Overview

Phase 6 adds the application lifecycle: applied → screening → interview → offer → placed/rejected. This includes database tables (applications, interviews, messages), service layer, API endpoints, a Motia event step for stage changes, UI wiring of existing pipeline/interviews pages to real data, and tests.

## Current State

| Component | Status |
|-----------|--------|
| `applications` table | Missing |
| `interviews` table | Missing |
| `messages` table | Missing |
| Service layer (applications.ts, interviews.ts) | Missing |
| API endpoints | Missing |
| Stage change event step | Missing |
| `/app/pipeline/page.tsx` | Done (mock data from `@/lib/data`) |
| `/app/interviews/page.tsx` | Done (mock data from `@/lib/data`) |
| `/app/messages/page.tsx` | Done (mock data from `@/lib/data`) |
| Tests | Missing |

## Architecture

```
match.completed → application created (approved match → new application)
                           ↓
application.stage.changed → stage-change.step.ts → audit log
                           ↓
                  /api/sollicitaties → pipeline UI
                  /api/interviews → interviews UI
```

### Stage Enum

Matches the existing `pipelineStages` from `lib/data.ts`:
- `new` → Nieuw
- `screening` → Screening
- `interview` → Interview
- `offer` → Aanbieding
- `hired` → Geplaatst
- `rejected` → Afgewezen

## Implementation Plan

### Task 1: Database schema — applications + interviews + messages (`src/db/schema.ts`)

**Applications table:**
- `id` (uuid PK)
- `jobId` (FK → jobs.id, cascade)
- `candidateId` (FK → candidates.id, cascade)
- `matchId` (FK → jobMatches.id, optional — if created from match)
- `stage` (text, default "new") — new, screening, interview, offer, hired, rejected
- `previousStage` (text, nullable) — for audit trail
- `stageChangedAt` (timestamp) — when stage last changed
- `notes` (text, nullable) — recruiter notes
- `source` (text) — "match", "manual", "import"
- `createdAt` (timestamp)
- `updatedAt` (timestamp)
- `deletedAt` (timestamp) — soft-delete

Indexes: jobId, candidateId, stage, deletedAt. Unique on (jobId, candidateId) where deletedAt IS NULL.

**Interviews table:**
- `id` (uuid PK)
- `applicationId` (FK → applications.id, cascade)
- `scheduledAt` (timestamp)
- `duration` (integer, minutes, default 60)
- `type` (text) — "phone", "video", "onsite", "technical"
- `interviewer` (text)
- `location` (text, nullable) — for onsite
- `status` (text, default "scheduled") — "scheduled", "completed", "cancelled"
- `feedback` (text, nullable)
- `rating` (integer, 1-5, nullable)
- `createdAt` (timestamp)

Indexes: applicationId, scheduledAt, status.

**Messages table:**
- `id` (uuid PK)
- `applicationId` (FK → applications.id, cascade)
- `direction` (text) — "inbound", "outbound"
- `channel` (text) — "email", "phone", "platform"
- `subject` (text, nullable)
- `body` (text)
- `sentAt` (timestamp)
- `createdAt` (timestamp)

Indexes: applicationId, sentAt.

Run `npx drizzle-kit push` after schema changes.

### Task 2: Service layer (`src/services/applications.ts`)

Following the pattern from `src/services/candidates.ts`:
- `listApplications(opts: { jobId?, candidateId?, stage?, limit? })`
- `getApplicationById(id)`
- `createApplication(data: CreateApplicationData)`
- `updateApplicationStage(id, newStage, notes?)` — updates stage, sets previousStage, stageChangedAt
- `deleteApplication(id)` — soft-delete
- `getApplicationStats()` — count by stage

### Task 3: Service layer (`src/services/interviews.ts`)

- `listInterviews(opts: { applicationId?, status?, limit? })`
- `getInterviewById(id)`
- `createInterview(data)`
- `updateInterview(id, data)` — update status, feedback, rating
- `getUpcomingInterviews(limit?)` — scheduled interviews ordered by scheduledAt

### Task 4: API endpoints

**Applications:**
- `GET /api/sollicitaties` — list with filters (jobId, candidateId, stage, limit)
- `POST /api/sollicitaties` — create new application
- `GET /api/sollicitaties/[id]` — get by id
- `PATCH /api/sollicitaties/[id]` — update stage (emits `application.stage.changed`)

**Interviews:**
- `GET /api/interviews` — list with filters (applicationId, status, limit)
- `POST /api/interviews` — create interview
- `PATCH /api/interviews/[id]` — update (status, feedback, rating)

All endpoints: generic error messages (no raw error.message), use Drizzle ORM only.

### Task 5: Stage change event step (`steps/pipeline/stage-change.step.ts`)

- Subscribes to `application.stage.changed` queue topic
- Input: `{ applicationId, previousStage, newStage, changedBy? }`
- Logs the stage transition (logger.info)
- If stage is "interview", could auto-schedule placeholder
- Enqueues `pipeline.stage.logged` (for future notification hooks)
- Flow: `recruitment-pipeline`

### Task 6: Wire UI to real data

**`/app/pipeline/page.tsx`** (existing kanban with mock data):
- Fetch from `/api/sollicitaties?limit=100` on mount
- Map DB records to the existing `Candidate` type used by the kanban columns
- Stage drag-and-drop calls `PATCH /api/sollicitaties/[id]` with new stage
- Fallback to mock data if API fails

**`/app/interviews/page.tsx`** (existing with mock data):
- Fetch from `/api/interviews?limit=100` on mount
- Map DB records to the `Interview` type
- Schedule/edit/cancel calls POST/PATCH endpoints
- Fallback to mock data if API fails

### Task 7: MCP + CLI extensions

**MCP tools** (add to `src/mcp/server.ts`):
- `list_applications` — list with filters
- `create_application` — create from match or manual
- `update_application_stage` — change stage
- `list_interviews` — list with filters
- `create_interview` — schedule interview
- `update_interview` — update status/feedback

**CLI commands** (add to `cli/commands/`):
- `motian applications list|show|add|stage` subcommands
- `motian interviews list|show|schedule|update` subcommands

### Task 8: Tests (`tests/phase6-pipeline.test.ts`)

- Schema: applications, interviews, messages tables exist with required columns
- Service exports: all functions exist
- Step config: stage-change.step.ts triggers/enqueues/flows
- API routes: file existence, exported handlers
- Type contracts: CreateApplicationData, stage enum values
- Pipeline topology: match.completed → application flow

## Acceptance Criteria

- [x] Applications, interviews, messages tables in schema
- [x] Application service with stage management
- [x] Interview service with scheduling
- [x] API endpoints for applications and interviews
- [x] Stage change event step
- [x] Pipeline UI wired to real data
- [x] Interviews UI wired to real data
- [x] MCP tools added
- [x] CLI commands added
- [x] Tests passing
- [ ] Committed and pushed

## References

- Existing pipeline UI: `app/pipeline/page.tsx` (DnD kanban, mock data from `lib/data.ts`)
- Existing interviews UI: `app/interviews/page.tsx` (schedule view, mock data)
- Mock data types: `lib/data.ts` (pipelineStages, Interview, MessageItem)
- Service pattern: `src/services/candidates.ts`
- API pattern: `app/api/matches/route.ts`
- Step pattern: `steps/matching/retrieve-matches.step.ts`
- MCP pattern: `src/mcp/server.ts`
- Beads: motian-5kl.1 through motian-5kl.6
