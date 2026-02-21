---
title: "Phase 5 + Phase 8: AI Matching & Agent-Native Layer"
type: feat
date: 2026-02-21
---

# Phase 5 + Phase 8: AI Matching & Agent-Native Layer

## Overview

Phase 8 CLI is ~60% done (jobs + scraper commands exist, MCP server missing). Phase 5 has UI + AI matching API but no database-backed candidates/embeddings. These phases share dependencies (candidates service needed by both CLI and matching).

## Current State

### Phase 8 (CLI + MCP)
| Component | Status |
|-----------|--------|
| `cli/index.ts` (Commander.js) | ✅ Done |
| `cli/commands/jobs.ts` | ✅ Done (list, show, search, stats) |
| `cli/commands/scrapers.ts` | ✅ Done (list, status, history, toggle, run) |
| `src/services/jobs.ts` | ✅ Done |
| `src/services/scrapers.ts` | ✅ Done |
| MCP Server | ❌ Missing |
| CLI candidates/matches commands | ❌ Missing |
| Parity audit | ❌ Missing |
| AGENT_PROMPT.md | ❌ Missing |

### Phase 5 (AI Matching)
| Component | Status |
|-----------|--------|
| `/app/matching/page.tsx` | ✅ Done (mock data) |
| `/app/professionals/page.tsx` | ✅ Done (mock data) |
| `/app/api/match/route.ts` | ✅ Done (pi-ai) |
| `candidates` table | ❌ Missing |
| `job_matches` table | ❌ Missing |
| pgvector extension | ❌ Missing |
| Embedding steps | ❌ Missing |
| Vector search | ❌ Missing |

## Implementation Plan

### Stream A: Database & Services (Foundation)

**Task A1: Database schema — candidates + job_matches + pgvector**
- Add pgvector extension to Drizzle migration
- Create `candidates` table: id, name, email, phone, role, skills (jsonb), experience, location, province, resumeUrl, embedding (vector(1536)), tags, gdprConsent, createdAt, updatedAt
- Create `jobMatches` table: id, jobId (FK), candidateId (FK), vectorScore, llmScore, overallScore, status (enum: pending/approved/rejected), knockOutPassed, matchData (jsonb), reviewedBy, reviewedAt, createdAt
- Update `jobs` table: change embedding from text to vector(1536)
- Run `db-push` to apply

**Task A2: Candidate service layer**
- `src/services/candidates.ts`: listCandidates, getCandidateById, searchCandidates, createCandidate, updateCandidate, deleteCandidateWithGdpr
- `src/services/matches.ts`: listMatches, getMatchById, createMatch, updateMatchStatus (approve/reject), getMatchesByJob, getMatchesByCandidate

### Stream B: Phase 8 Completion (CLI + MCP)

**Task B1: CLI candidates + matches commands**
- `cli/commands/candidates.ts`: list, show, search, add, update, delete
- `cli/commands/matches.ts`: list, show, approve, reject, run (trigger matching)
- Register in `cli/index.ts`

**Task B2: MCP Server (stdio transport)**
- `src/mcp/server.ts`: Create MCP server with @modelcontextprotocol/sdk
- Tools: list_jobs, get_job, search_jobs, job_stats, list_scrapers, scraper_status, toggle_scraper, trigger_scrape, list_candidates, get_candidate, search_candidates, list_matches, approve_match, reject_match
- All tools call shared service layer
- stdio transport for Claude Code integration

**Task B3: AGENT_PROMPT.md**
- System prompt describing all available tools
- Examples of common workflows
- Dutch recruitment context

### Stream C: Phase 5 Embedding Pipeline

**Task C1: EmbedJobs Motia step**
- `steps/jobs/embed-jobs.step.ts`: Listen on `jobs.normalize` output, generate embedding via pi-ai, store in jobs table
- Use text-embedding-3-small (OpenAI) or voyage-3 (if available)

**Task C2: Candidate embedding + vector search service**
- `src/services/embeddings.ts`: generateEmbedding(), cosineSimilarity()
- Vector search: query pgvector for top-K matches by embedding similarity

**Task C3: Match pipeline integration**
- Update `/app/api/match/route.ts` to persist results to job_matches table
- Wire matching page to read from database instead of mock data

### Stream D: Tests

**Task D1: Phase 8 + Phase 5 tests**
- `tests/phase5-matching.test.ts`: Schema validation, service layer contracts
- `tests/phase8-cli-mcp.test.ts`: CLI command structure, MCP tool definitions, parity audit

## Acceptance Criteria

- [ ] candidates + job_matches tables created with pgvector
- [ ] Candidate + match service layer complete
- [ ] CLI candidates + matches commands working
- [ ] MCP server with 14+ tools
- [ ] AGENT_PROMPT.md documenting all tools
- [ ] EmbedJobs step generating embeddings
- [ ] Match results persisted to database
- [ ] All tests passing
- [ ] Committed and pushed

## References

- CLI entry: `cli/index.ts`
- Existing services: `src/services/jobs.ts`, `src/services/scrapers.ts`
- Schema: `src/db/schema.ts`
- Match API: `app/api/match/route.ts`
- MCP SDK: `@modelcontextprotocol/sdk` (already in node_modules)
