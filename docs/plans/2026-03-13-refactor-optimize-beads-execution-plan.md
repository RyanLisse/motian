# Refactor & Optimize Beads — Execution Plan

> **For Claude:** REQUIRED SUB-SKILL: Use superpowers:executing-plans to implement this plan task-by-task. Beads are in the tracker; use `bd list --status=open` and `bd show <id>` for details.

**Goal:** Execute the refactor and optimize work represented by the 21 beads (complexity, duplication, chore, Sentry, lint) in ordered waves with tests and lint passing after each wave.

**Architecture:** Wave 1 = low-risk duplication/shared utils (getMessageText, getStatusBadge, ListPageSkeleton, parseListParams). Wave 2 = API dedupe (vacatures/zoeken, koppel resolveKoppelPairs, GDPR contacten, reports). Wave 3 = complexity splits (chat POST, cv-* helpers, reports, interviews/messages pages, JobDetailFields). Wave 4 = chore + Sentry + noArrayIndexKey. Voice agent and package upgrades (Zod 4, Vitest 4, etc.) stay as separate beads for later.

**Tech Stack:** Next.js 16, Drizzle, Biome, Vitest, beads CLI (`bd`).

---

## Implementation notes (deepen)

- **getMessageText:** Defined in `app/api/chat/route.ts` (line 42) and `src/services/chat-sessions.ts` (line 152). Same signature `(message: UIMessage): string`; use `UIMessage` from `ai` package. New file: `src/lib/chat-message-utils.ts`.
- **getStatusBadge:** In `app/autopilot/page.tsx` and `app/autopilot/[runId]/page.tsx`; returns JSX for status strings (e.g. completed, failed). Extract to `app/autopilot/shared.tsx` and re-export Badge/CheckCircle2 etc. from same deps.
- **ListPageSkeleton:** `app/interviews/loading.tsx`, `app/messages/loading.tsx`, `app/pipeline/loading.tsx` share the same layout (flex-1 overflow-y-auto, max-w-7xl, grid of Skeleton). Accept optional `title` prop for first Skeleton row if needed.
- **parseListParams:** `app/api/berichten/route.ts` and `app/api/matches/route.ts` use `withApiHandler`, `new URL(req.url).searchParams`, and a `parsePagination(searchParams)` helper. Extract shared parsing (page, limit, offset + optional jobId/candidateId/applicationId/direction/channel/status) into `src/lib/list-params.ts` or extend existing pagination helper.

---

## Wave 1 — Shared utils (duplication, low risk)

### Task 1.1: getMessageText shared util (bead motian-a3d)

**Files:**
- Create: `src/lib/chat-message-utils.ts`
- Modify: `app/api/chat/route.ts`, `src/services/chat-sessions.ts`

**Steps:**
1. Copy `getMessageText` from `app/api/chat/route.ts` into `src/lib/chat-message-utils.ts` and export.
2. In `app/api/chat/route.ts` and `src/services/chat-sessions.ts` replace local implementation with `import { getMessageText } from "@/src/lib/chat-message-utils"`.
3. Run `pnpm lint` and `pnpm test`. Commit.

### Task 1.2: getStatusBadge shared for autopilot (bead motian-f4l)

**Files:**
- Create: `app/autopilot/shared.tsx` (or add to existing shared module)
- Modify: `app/autopilot/page.tsx`, `app/autopilot/[runId]/page.tsx`

**Steps:**
1. Extract `getStatusBadge(status: string)` from one of the two pages into `app/autopilot/shared.tsx`, export.
2. Import and use in both pages; remove duplicate.
3. Run `pnpm lint` and `pnpm test`. Commit.

### Task 1.3: ListPageSkeleton shared component (bead motian-0as)

**Files:**
- Create: `components/shared/list-page-skeleton.tsx`
- Modify: `app/interviews/loading.tsx`, `app/messages/loading.tsx`, `app/pipeline/loading.tsx`

**Steps:**
1. Extract the common skeleton layout from one loading file into `ListPageSkeleton`.
2. Use it in all three loading files (adjust props if needed for titles).
3. Run `pnpm lint` and `pnpm test`. Commit.

### Task 1.4: parseListParams for berichten + matches (bead motian-dg5)

**Files:**
- Create: `src/lib/list-params.ts` (or add to existing API helpers)
- Modify: `app/api/berichten/route.ts`, `app/api/matches/route.ts`

**Steps:**
1. Extract shared pagination + searchParams parsing into `parseListParams(req: Request)` returning `{ page, limit, offset, ...searchParams }`.
2. Use in both GET handlers. Run `pnpm lint` and `pnpm test`. Commit.

---

## Wave 2 — API dedupe

### Task 2.1: vacatures route vs zoeken dedupe (bead motian-3w0)

**Files:**
- Modify: `app/api/vacatures/route.ts`, `app/api/vacatures/zoeken/route.ts`

**Steps:**
1. Have one route call the other or extract shared `searchVacaturesHandler(filters)` used by both. Preserve response shape.
2. Run `pnpm lint` and `pnpm test`. Commit.

### Task 2.2: resolveKoppelPairs shared (bead motian-u8b)

**Files:**
- Create: `src/services/koppel-pairs.ts` (or under existing services)
- Modify: `app/api/kandidaten/[id]/koppel/route.ts`, `app/api/vacatures/[id]/koppel/route.ts`

**Steps:**
1. Extract matchIds/candidateIds resolution and pair-building into `resolveKoppelPairs(...)`. Use from both routes.
2. Run `pnpm lint` and `pnpm test`. Commit.

### Task 2.3: GDPR contacten export/verwijder share layout (bead motian-cw9)

**Files:**
- Modify: `app/api/gdpr/contacten/export/route.ts`, `app/api/gdpr/contacten/verwijder/route.ts`

**Steps:**
1. Share common layout (withApiHandler, error response shape). Consider shared helper for request parsing.
2. Run `pnpm lint` and `pnpm test`. Commit.

### Task 2.4: reports route single report-fetch + report-render (beads motian-vgg, motian-1ba)

**Files:**
- Create: `src/services/report-helpers.ts` or similar
- Modify: `app/api/reports/route.ts`

**Steps:**
1. Extract 22-line generateReport usage and 19-line db.select into single helper(s). Call from GET.
2. Run `pnpm lint` and `pnpm test`. Commit.

---

## Wave 3 — Complexity splits (optional in same run; can be separate PRs)

### Task 3.1: chat POST handler split (bead motian-bpq)

**Files:** `app/api/chat/route.ts`

**Steps:** Extract validation, rate-limit, and streaming into named helpers; reduce POST to orchestration. Run lint + test. Commit.

### Task 3.2: cv-* early-exit helpers (bead motian-105)

**Files:** `app/api/cv-analyse/route.ts`, `app/api/cv-file/route.ts`, `app/api/cv-upload/route.ts`

**Steps:** Extract shared blob/validation helper; share rate-limit logic between cv-analyse and cv-upload. Run lint + test. Commit.

### Task 3.3: interviews + messages pages (bead motian-hrr)

**Files:** `app/interviews/page.tsx`, `app/messages/page.tsx`

**Steps:** Split filters, URL params, and list rendering; consider shared “list page with filters” component/hook. Run lint + test. Commit.

### Task 3.4: JobDetailFields sections (bead motian-q4r)

**Files:** `app/opdrachten/[id]/job-detail-fields.tsx` (and/or vacatures equivalent if present)

**Steps:** Extract meta, description, deadlines into smaller subcomponents. Run lint + test. Commit.

---

## Wave 4 — Chore, Sentry, lint

### Task 4.1: Sentry DSN and open issues (bead motian-hm1)

**Steps:** Verify `SENTRY_DSN` in production env; document in README or runbook. Resolve or triage open issues in Sentry (ryan-lisse-bv/motian). No code change required for “check” — optional: add one-line doc. Commit if any doc change.

### Task 4.2: noArrayIndexKey stable keys (bead motian-c7b)

**Files:** `app/professionals/[id]/page.tsx`, `app/scraper/runs/[id]/page.tsx`, `components/auto-match-results.tsx`, `components/candidate-profile/skills-experience-section.tsx`, `components/candidate-wizard/experience-input.tsx`, `components/cv-document-viewer.tsx`, `components/matching/match-detail.tsx`

**Steps:** Replace array-index keys with stable ids (e.g. composite key, content hash for errors, criterion+id for match detail). Remove Biome override for these files in `biome.json` after fix. Run `pnpm lint` and `pnpm test`. Commit.

---

## Deferred (separate plans/beads)

- Voice agent constructor (motian-pag)
- Zod 4, Vitest 4, @types/node 25, deprecated deps, docs-site overrides (motian-o9c, motian-kr2, motian-ln3, motian-51e, motian-s84)

---

## Verification

After each task or wave:
- `pnpm lint`
- `pnpm exec tsc --noEmit`
- `pnpm test`
- Optionally: `qlty check --fix --level=low`

Mark beads done with: `bd update <id> --status done` (or your workflow’s equivalent).
