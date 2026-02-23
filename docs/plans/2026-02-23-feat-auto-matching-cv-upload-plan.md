---
title: "feat: Auto-Matching na CV Upload & Vacature Import"
type: feat
date: 2026-02-23
brainstorm: (inline brainstorm session — decisions captured below)
---

# Auto-Matching na CV Upload & Vacature Import

## Overview

Automatically match candidates to their top 3 best-fitting jobs after CV upload, and match jobs to their top 3 best-fitting candidates after job import. Uses a two-phase approach: fast hybrid pre-filter (~2s) followed by parallel deep structured matching (~8-12s) for the top 3.

Results are shown **inline** in the CV upload flow — the recruiter sees matches appear immediately after upload without navigating away.

## Problem Statement / Motivation

**Current state:** After CV upload, candidates are created and enriched but sit dormant. Recruiters must manually navigate to matching tools, select jobs, and trigger matches. The AI agent can match via `matchKandidaten`, but there's no automatic flow. New jobs imported via scrapers also have no automatic candidate matching.

**Target state:** CV upload triggers instant matching. Within ~15 seconds of upload, the recruiter sees 3 job suggestions with deep structured analysis (per-criterion evaluation, go/no-go recommendation, risk profile). New jobs automatically get matched to top 3 candidates in the background.

## Design Decisions

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Matching tier | Pre-filter + deep structured | Hybrid pre-filter (~2s) narrows 200+ jobs to top 3, then deep structured gives per-criterion analysis |
| UI location | Inline after CV upload | Recruiter sees matches without navigating away — reduces friction |
| Direction | Bidirectional | CV→jobs AND job→candidates — full coverage |
| Pre-filter count | Top 3 both directions | Keeps it focused and manageable. 3 deep matches take ~8-12s parallel |
| Minimum score | ≥ 40% hybrid | Below 40% is noise — don't run expensive deep matching |
| Match model tag | `"auto-match-v1"` | Distinguishes auto-generated from manual matches |
| Match status | `"pending"` | Recruiter must still approve/reject |
| Embedding timing | Await embedding before matching | Current fire-and-forget embed means embedding may not be ready. Must await it. |

## Technical Approach

### Architecture

```
CV Upload Flow (inline):

  CV File ──► Parse (Gemini) ──► Save Candidate ──► Await Embed
                                                        │
                                                        ▼
                                              Pre-filter: hybrid score
                                              ALL active jobs (~2s)
                                                        │
                                                        ▼
                                              Select top 3 (score ≥ 40%)
                                                        │
                                                        ▼
                                              Deep structured match
                                              (3 parallel, ~8-12s)
                                                        │
                                                        ▼
                                              Save to jobMatches
                                                        │
                                                        ▼
                                              Return inline results

Job Import Flow (background):

  Scraper/Import ──► Save Job ──► Embed Job
                                       │
                                       ▼
                             Pre-filter: hybrid score
                             ALL active candidates (~2s)
                                       │
                                       ▼
                             Select top 3 (score ≥ 40%)
                                       │
                                       ▼
                             Deep structured match (parallel)
                                       │
                                       ▼
                             Save to jobMatches
```

### Key Constraint: Embedding Timing

Currently `embedCandidate` is fire-and-forget (line 150-155 in `candidates.ts`). For auto-matching to use hybrid scoring (which blends rule-based + vector), the embedding must be ready. Two approaches:

1. **Await embedding in auto-match service** (recommended) — call `embedCandidate` and wait for it before running `computeMatchScore`. If embedding fails, fall back to 100% rule-based scoring. This keeps the existing create/enrich paths unchanged.
2. Change `createCandidate` to await embedding — too invasive, breaks fire-and-forget pattern.

## Implementation Plan

### Step 1: Create auto-matching orchestration service

**File:** `src/services/auto-matching.ts` (NEW)

Core orchestration function that:
1. Awaits embedding generation for the candidate
2. Fetches all active jobs (uses `listActiveJobs` — needs to be added)
3. Scores each job against the candidate using `computeMatchScore`
4. Sorts by score, takes top 3 with score ≥ 40%
5. Runs `extractRequirements` + `runStructuredMatch` in parallel for top 3
6. Stores results in `jobMatches` table via `createMatch`
7. Returns structured results for inline display

```ts
// src/services/auto-matching.ts

export type AutoMatchResult = {
  jobId: string;
  jobTitle: string;
  company: string | null;
  location: string | null;
  quickScore: number;
  structuredResult: StructuredMatchOutput | null;
  matchId: string;
};

export async function autoMatchCandidateToJobs(
  candidateId: string,
): Promise<AutoMatchResult[]> {
  // 1. Get candidate (with fresh CV data)
  // 2. Ensure embedding exists (await embedCandidate if needed)
  // 3. Get all active jobs
  // 4. computeMatchScore for each → sort → take top 3 ≥ 40%
  // 5. For each top 3: extractRequirements + runStructuredMatch (parallel)
  // 6. createMatch for each result
  // 7. Return results
}

export async function autoMatchJobToCandidates(
  jobId: string,
): Promise<AutoMatchResult[]> {
  // Mirror: job → top 3 candidates
}
```

**Dependencies:**
- `src/services/candidates.ts` — `getCandidateById`, `listActiveCandidates`
- `src/services/jobs.ts` — `getJobById`, needs `listActiveJobs` (add)
- `src/services/scoring.ts` — `computeMatchScore`
- `src/services/embedding.ts` — `embedCandidate`, `embedJob`
- `src/services/requirement-extraction.ts` — `extractRequirements`
- `src/services/structured-matching.ts` — `runStructuredMatch`
- `src/services/matches.ts` — `createMatch`

### Step 2: Add `listActiveJobs` to jobs service

**File:** `src/services/jobs.ts`

```ts
export async function listActiveJobs(limit?: number): Promise<Job[]> {
  const safeLimit = Math.min(limit ?? 200, 500);
  return db
    .select()
    .from(jobs)
    .where(isNull(jobs.deletedAt))
    .orderBy(desc(jobs.scrapedAt))
    .limit(safeLimit);
}
```

### Step 3: Add auto-match API endpoint

**File:** `app/api/matches/auto/route.ts` (NEW)

POST endpoint used by the CV upload save flow:

```ts
// Input: { candidateId: string }
// Output: { matches: AutoMatchResult[] }
```

Also used internally — the CV save route will call this after saving.

### Step 4: Extend CV upload save to trigger auto-matching

**File:** `app/api/cv-upload/save/route.ts`

After creating/enriching the candidate, call the auto-match service. Return match results alongside the existing response:

```ts
// After candidate save...
let autoMatches: AutoMatchResult[] = [];
try {
  autoMatches = await autoMatchCandidateToJobs(candidate.id);
} catch (err) {
  console.error("[CV Save] Auto-match failed (non-fatal):", err);
}

return Response.json({
  message: existingCandidateId ? "Kandidaat verrijkt" : "Kandidaat aangemaakt",
  candidate,
  fileUrl,
  autoMatches,  // NEW
});
```

### Step 5: Create inline auto-match results component

**File:** `components/auto-match-results.tsx` (NEW)

Client component that renders after CV upload completes:

- 3 match cards, each showing:
  - Job title + company + location
  - Quick score (hybrid %) as a progress bar
  - Go/no-go/conditional badge (from structured match)
  - Overall structured score
  - Top 3 criteria (knockout passed/failed, gunning stars)
  - Risk flags (if any)
  - "Bekijk opdracht" link to `/opdrachten/[jobId]`
  - "Bekijk match" link to `/matching/[matchId]`
- Loading state: "Vacatures worden gescand..." → "Top matches worden beoordeeld..."
- Empty state: "Geen geschikte vacatures gevonden"

### Step 6: Extend CvDropZone to show auto-match results

**File:** `components/cv-drop-zone.tsx`

After successful CV save, show the `AutoMatchResults` component instead of just the success toast. The flow becomes:

1. Drag → "CV wordt verwerkt..." (parse phase)
2. "Profiel wordt bijgewerkt..." (save phase)
3. "Vacatures worden gescand..." (auto-match phase)
4. Show match results inline (or "Geen matches" if empty)

The CvDropZone needs a new state: `"matching"` between `"uploading"` and `"success"`. The match results are stored in component state and rendered via `AutoMatchResults`.

### Step 7: Add AI agent tool for auto-matching

**File:** `src/ai/tools/kandidaten.ts`

New tool `autoMatchKandidaat`:

```ts
export const autoMatchKandidaat = tool({
  description: "Start automatische matching voor een kandidaat. Zoekt de top 3 best passende vacatures en geeft een gedetailleerde beoordeling per criterium.",
  inputSchema: z.object({
    id: z.string().uuid().describe("UUID van de kandidaat"),
  }),
  execute: async ({ id }) => {
    const results = await autoMatchCandidateToJobs(id);
    if (results.length === 0) return { message: "Geen geschikte vacatures gevonden", matches: [] };
    return { total: results.length, matches: results };
  },
});
```

Register in `src/ai/agent.ts` and export from `src/ai/tools/index.ts`.

### Step 8: Add reverse auto-matching for new jobs

**File:** `app/api/matches/genereren/route.ts` (extend)

After bulk match generation, also trigger `autoMatchJobToCandidates` if the request indicates a newly imported job (add optional `autoDeep: boolean` parameter). This runs deep structured matching for top 3 candidates.

Alternatively, hook into the scraper pipeline: after `enrichJobsBatch` completes in the cron job, call `autoMatchJobToCandidates` for each newly enriched job.

### Step 9: Update system prompt for discoverability

**File:** `src/ai/agent.ts`

Add to "Je kunt helpen met:" list:
- "Automatisch matchen van kandidaten met vacatures (top 3 met gedetailleerde beoordeling)"

### Step 10: Tests

**File:** `tests/auto-matching.test.ts` (NEW)

- Test `autoMatchCandidateToJobs` service exists and exports correctly
- Test pre-filter logic (score threshold ≥ 40%, top 3 selection)
- Test `listActiveJobs` exists in jobs service
- Test API route schema validation
- Test structured match integration (mock Gemini calls)

## Files to Create / Modify

| File | Change |
|------|--------|
| `src/services/auto-matching.ts` | **NEW** — orchestration service |
| `src/services/jobs.ts` | Add `listActiveJobs` function |
| `app/api/matches/auto/route.ts` | **NEW** — auto-match API endpoint |
| `app/api/cv-upload/save/route.ts` | Trigger auto-match after save |
| `components/auto-match-results.tsx` | **NEW** — inline match result cards |
| `components/cv-drop-zone.tsx` | Extend with matching state + results |
| `src/ai/tools/kandidaten.ts` | Add `autoMatchKandidaat` tool |
| `src/ai/tools/index.ts` | Export new tool |
| `src/ai/agent.ts` | Register tool, update system prompt |
| `tests/auto-matching.test.ts` | **NEW** — service + API tests |

## Estimated Performance

| Phase | Duration | Notes |
|-------|----------|-------|
| Embedding generation | ~1-2s | OpenAI text-embedding-3-small, 512 dims |
| Pre-filter (hybrid scoring) | ~1-2s | In-memory scoring of ~200 jobs |
| Deep structured match (×3) | ~8-12s | Parallel Gemini calls for 3 jobs |
| **Total** | **~10-16s** | Progressive UI feedback throughout |

## Verification

1. `pnpm lint` — zero errors
2. `pnpm test` — all tests pass
3. Upload a CV on `/professionals/[id]` → see 3 match cards appear inline
4. Match cards show: job title, score %, go/no-go badge, top criteria
5. Matches appear in `/matching` page with status "pending"
6. In chat: "match kandidaat [naam] automatisch" → returns top 3 matches
7. New scraped job → top 3 candidate matches created automatically

## Risk Mitigation

| Risk | Mitigation |
|------|-----------|
| No active jobs with descriptions | Pre-filter returns empty → show "Geen vacatures" |
| Embedding service timeout | Fall back to 100% rule-based scoring |
| Gemini rate limit on 3 parallel calls | `withRetry` with exponential backoff (already in place) |
| Duplicate matches (unique constraint) | Catch duplicate key error, skip silently (existing pattern) |
| Long response time (>15s) | Progressive UI states keep user engaged |
