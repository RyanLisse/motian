---
title: "Phase 9: Messages Pipeline + Platform Polish"
type: feat
date: 2026-02-21
---

# Phase 9: Messages Pipeline + Platform Polish

## Overview

Phase 9 wires the messages page to real data and closes remaining gaps: messages service + API endpoints, messages MCP/CLI commands, remove mock data imports from pages that have real APIs, and add a messages service test file.

## Current State

| Component | Status |
|-----------|--------|
| `messages` table in schema | Done (Phase 6) |
| Messages service (`src/services/messages.ts`) | Missing |
| Messages API endpoints (`/api/messages`) | Missing |
| `/app/messages/page.tsx` | Done (100% mock data from `@/lib/data`) |
| MCP tools for messages | Missing |
| CLI commands for messages | Missing |
| Tests for messages | Missing |
| Mock data cleanup (matching, professionals pages) | Pending |

## Architecture

```
application created → message sent (outbound confirmation)
                         ↓
              /api/messages → messages UI
              /api/messages/[id] → message detail
```

## Implementation Plan

### Task 1: Messages service (`src/services/messages.ts`)

Following the pattern from `src/services/applications.ts`:
- `listMessages(opts: { applicationId?, direction?, channel?, limit? })`
- `getMessageById(id)`
- `createMessage(data: CreateMessageData)`
- `getMessagesByApplication(applicationId)`

Types: `MessageRecord`, `CreateMessageData`, `MessageWithDetails` (join to application → candidate name, job title).

### Task 2: Messages API endpoints

**Messages:**
- `GET /api/messages` — list with filters (applicationId, direction, channel, limit)
- `POST /api/messages` — create message
- `GET /api/messages/[id]` — get by id

All endpoints: generic error messages, Drizzle ORM only, NaN guard on limit.

### Task 3: Wire messages UI to real data

**`/app/messages/page.tsx`** (existing with mock data):
- Fetch from `/api/messages?limit=100` on mount
- Map DB records to existing `MessageItem` type
- Create/send calls POST endpoint
- Fallback to mock data if API fails
- Load recipients dynamically from `/api/candidates`

### Task 4: MCP + CLI for messages

**MCP tools** (add to `src/mcp/server.ts`):
- `list_messages` — list with filters
- `create_message` — create message

**CLI commands** (add to `cli/commands/messages.ts`):
- `motian messages list` — list messages
- `motian messages show <id>` — show message detail
- `motian messages send` — create/send message

### Task 5: Remove mock fallbacks from wired pages

Clean up pages that already have real API wiring but still import from `lib/data.ts`:
- `app/professionals/page.tsx` — remove mockCandidates import, show empty state instead
- `app/matching/page.tsx` — remove mockCandidates/positionsList imports, show empty state

### Task 6: Tests (`tests/phase9-messages.test.ts`)

- Schema: messages table exists with required columns (already tested in phase6)
- Service exports: all functions exist
- API routes: file existence, exported handlers (GET, POST)
- MCP tools: list_messages, create_message registered
- CLI: registerMessagesCommand exported
- Type contracts: CreateMessageData fields

## Acceptance Criteria

- [ ] Messages service with CRUD operations
- [ ] Messages API endpoints (GET list, POST create, GET by id)
- [ ] Messages UI wired to real data
- [ ] MCP tools for messages added
- [ ] CLI commands for messages added
- [ ] Mock data imports removed from wired pages
- [ ] Tests passing
- [ ] Committed and pushed

## References

- Existing messages UI: `app/messages/page.tsx` (mock data from `lib/data.ts`)
- Messages table: `src/db/schema.ts` (lines 226-246)
- Service pattern: `src/services/applications.ts`
- API pattern: `app/api/sollicitaties/route.ts`
- MCP pattern: `src/mcp/server.ts`
- CLI pattern: `cli/commands/applications.ts`
