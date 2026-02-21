---
title: "Phase 5b: AI Matching Pipeline — Embeddings + Vector Search + LLM Reranking"
type: feat
date: 2026-02-21
---

# Phase 5b: AI Matching Pipeline

## Overview

Phase 5 foundation is done (candidates + jobMatches tables, service layer, CLI, MCP). This phase builds the AI matching pipeline: embedding generation for jobs and candidates, cosine similarity search, LLM reranking, and wiring the UI to real database data.

## Current State

| Component | Status |
|-----------|--------|
| `candidates` + `jobMatches` tables | ✅ Done |
| Service layer (candidates.ts, matches.ts) | ✅ Done |
| CLI + MCP (14 tools) | ✅ Done |
| `/app/matching/page.tsx` | ✅ Done (mock data) |
| `/app/professionals/page.tsx` | ✅ Done (mock data) |
| `/app/api/match/route.ts` | ✅ Done (pi-ai, no DB persistence) |
| Embedding generation (jobs) | ❌ Missing |
| Embedding generation (candidates) | ❌ Missing |
| Vector search (cosine similarity) | ❌ Missing |
| LLM reranking step | ❌ Missing |
| Match review API | ❌ Missing |
| UI wired to real data | ❌ Missing |

## Architecture

```
jobs.normalize → embed-jobs.step.ts → jobs.embedding (text column)
                                              ↓
candidate.created → embed-candidate.step.ts → candidates.embedding
                                              ↓
match.request → retrieve-matches.step.ts → cosine similarity top-K
                                              ↓
                  grade-job.step.ts → LLM reranking → job_matches table
                                              ↓
                  /app/api/matches/* → UI pages read from DB
```

### Embedding Strategy

Since Neon free tier doesn't support pgvector, embeddings are stored as serialized JSON float arrays in `text` columns. Cosine similarity is computed in application code. This works well for <10K records and can migrate to pgvector later.

Use `@mariozechner/pi-ai` with OpenAI `text-embedding-3-small` (1536 dims) via OAuth subscription or API key. Fallback: if no embedding API available, generate TF-IDF-style text hashes for basic keyword matching.

## Implementation Plan

### Task 1: Embedding service (`src/services/embeddings.ts`)

- `generateEmbedding(text: string): Promise<number[]>` — calls pi-ai with text-embedding-3-small
- `cosineSimilarity(a: number[], b: number[]): number` — pure math, no dependencies
- `serializeEmbedding(vec: number[]): string` — JSON.stringify
- `deserializeEmbedding(str: string): number[]` — JSON.parse
- `findSimilarJobs(candidateEmbedding: number[], limit?: number): Promise<{jobId: string, score: number}[]>` — loads all job embeddings, computes cosine sim, returns top-K
- Graceful fallback: if no API key, return null (steps skip embedding)

### Task 2: EmbedJobs Motia step (`steps/jobs/embed-jobs.step.ts`)

- Listens on `jobs.normalize` output (after normalization completes)
- For each new/updated job, generate embedding from: title + description + requirements + competences
- Store serialized embedding in `jobs.embedding` column
- Queue topic: `jobs.embedded`

### Task 3: EmbedCandidate Motia step (`steps/candidates/embed-candidate.step.ts`)

- Listens on `candidate.created` topic
- Generate embedding from: role + skills + experience + tags
- Store in `candidates.embedding` column
- Queue topic: `candidate.embedded`

### Task 4: RetrieveMatches step (`steps/matching/retrieve-matches.step.ts`)

- Listens on `match.request` topic (triggered by API or CLI)
- Loads candidate embedding
- Calls `findSimilarJobs()` for top-20 cosine similarity matches
- Stores preliminary matches in `job_matches` with `vectorScore`
- Emits `match.grade` for LLM reranking

### Task 5: GradeJob step (`steps/matching/grade-job.step.ts`)

- Listens on `match.grade` topic
- For each match candidate, calls pi-ai LLM to evaluate:
  - Knock-out criteria (hard requirements)
  - Scoring on 5 dimensions (same prompt as existing `/api/match`)
- Updates `job_matches` with `llmScore`, `overallScore`, `knockOutPassed`, `matchData`
- Emits `match.completed`

### Task 6: Match review API endpoints

- `PATCH /api/matches/[id]/approve` — calls `updateMatchStatus("approved")`
- `PATCH /api/matches/[id]/reject` — calls `updateMatchStatus("rejected")`
- `GET /api/matches` — returns matches from DB with filters
- `POST /api/matches/run` — enqueues `match.request` for a candidate

### Task 7: Wire UI to real database data

- `/app/matching/page.tsx` — fetch from `/api/matches` instead of mock data
- `/app/professionals/page.tsx` — fetch from candidates service via API
- Add loading states, error handling

### Task 8: Tests

- `tests/phase5b-pipeline.test.ts`:
  - Embedding service: cosine similarity math, serialization
  - Step configs: triggers, topics, flows
  - API route structure
  - Type contracts for embedding data

## Acceptance Criteria

- [x] Embedding service with cosine similarity
- [x] EmbedJobs step generating embeddings from job text
- [x] EmbedCandidate step generating embeddings from candidate profile
- [x] RetrieveMatches step finding top-K similar jobs
- [x] GradeJob step with LLM reranking
- [x] Match review API endpoints
- [x] UI wired to real database data
- [x] Tests passing
- [ ] Committed and pushed

## References

- Existing normalize step: `steps/jobs/normalize.step.ts`
- Match API: `app/api/match/route.ts` (prompt template for LLM grading)
- pi-ai usage: `app/api/agent/route.ts` (OAuth + API key pattern)
- Services: `src/services/candidates.ts`, `src/services/matches.ts`
- Schema: `src/db/schema.ts`
- Beads: motian-avf.4 through motian-avf.9
