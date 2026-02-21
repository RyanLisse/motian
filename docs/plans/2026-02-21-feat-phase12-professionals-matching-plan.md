---
title: "feat: Phase 12 — Professionals + AI Matching Pipeline"
type: feat
date: 2026-02-21
---

# Phase 12: Professionals/Candidates + AI Matching

## Overview

Add the candidates/professionals entity with full CRUD, AI-powered job matching via embeddings, and corresponding UI pages. This unlocks the core recruitment workflow: professionals browse jobs → AI suggests matches → recruiter acts on matches.

## Scope

### 1. Database Schema (candidates + jobMatches tables)
- `candidates` table: name, email, phone, skills, experience, preferences, resumeUrl, embedding, consent, softDelete
- `jobMatches` table: jobId FK, candidateId FK, matchScore, confidence, reasoning, model, status (pending/approved/rejected)
- Indexes for common queries

### 2. Service Layer (candidates.ts + matches.ts)
- `src/services/candidates.ts`: listCandidates, getCandidateById, searchCandidates, createCandidate, updateCandidate, deleteCandidate
- `src/services/matches.ts`: listMatches, getMatchById, updateMatchStatus, createMatch, getMatchesForJob, getMatchesForCandidate

### 3. API Endpoints (4 new step files)
- `steps/api/candidates.step.ts`: GET /api/kandidaten (list), POST /api/kandidaten (create)
- `steps/api/candidate-detail.step.ts`: GET /api/kandidaten/:id, PATCH /api/kandidaten/:id, DELETE /api/kandidaten/:id
- `steps/api/matches.step.ts`: GET /api/matches (list)
- `steps/api/match-update.step.ts`: PATCH /api/matches/:id (approve/reject)

### 4. UI Pages (3 new pages)
- `app/professionals/page.tsx`: Talent pool list with search, skills filter
- `app/professionals/[id]/page.tsx`: Professional detail with match history
- `app/matching/page.tsx`: AI matches dashboard with approve/reject actions

### 5. MCP Server Fix
- Create the missing service files so `src/mcp/server.ts` compiles
- Wire up candidate + match tool handlers

### 6. Tests
- `tests/phase12-professionals-matching.test.ts`: Schema validation, service layer tests

## Files to Create/Modify

**Create:**
- `src/services/candidates.ts`
- `src/services/matches.ts`
- `steps/api/candidates.step.ts`
- `steps/api/candidate-detail.step.ts`
- `steps/api/matches.step.ts`
- `steps/api/match-update.step.ts`
- `app/professionals/page.tsx`
- `app/professionals/[id]/page.tsx`
- `app/matching/page.tsx`
- `tests/phase12-professionals-matching.test.ts`

**Modify:**
- `src/db/schema.ts` — add candidates + jobMatches tables
- `src/mcp/server.ts` — fix imports, wire tool handlers
