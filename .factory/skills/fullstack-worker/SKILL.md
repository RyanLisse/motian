---
name: fullstack-worker
description: Handles full-stack Next.js features spanning API routes and React components
---

# Fullstack Worker

NOTE: Startup and cleanup are handled by `worker-base`. This skill defines the WORK PROCEDURE.

## When to Use This Skill

Use this skill for features that span both backend (API routes) and frontend (React components) in the Next.js app. This includes:
- API endpoints with corresponding UI components
- Page creation with data fetching
- Interactive components with server-side data sources

## Work Procedure

### 1. Read Feature Context

1. Read the feature description from features.json carefully — every detail matters
2. Read AGENTS.md for coding conventions and boundaries
3. Read relevant existing code referenced in AGENTS.md (canvas components, API routes, hooks)
4. Check `.factory/library/` for any relevant knowledge

### 2. Write Tests First (TDD)

Before any implementation:
1. Create test file in `tests/` following existing naming pattern
2. Write failing tests for:
   - API route handlers (request/response validation, filtering, error cases)
   - Data transformation functions (node/edge building, scoring colors)
   - Utility functions (search, filter logic)
3. Run `pnpm test` to confirm tests fail (red phase)

### 3. Implement Backend

1. Create TypeScript types/interfaces first (in `src/types/`)
2. Create API route handlers in `app/api/` following Dutch path conventions
3. Use Drizzle ORM for database queries, following existing patterns
4. Add Zod validation for request parameters
5. Run `pnpm test` to confirm backend tests pass

### 4. Implement Frontend

1. Create React components in `components/` directory
2. Use `@tanstack/react-query` for data fetching with custom hooks in `hooks/`
3. Use shadcn/ui primitives (Dialog, Sheet, Button, etc.)
4. Follow existing component patterns (see canvas components for graph-related patterns)
5. Dutch UI strings for all user-visible text
6. Ensure dark theme compatibility (existing next-themes setup)

### 5. Create Page/Integration

1. Create page files in `app/` following Next.js App Router conventions
2. Use "use client" directive for interactive components
3. Wire up navigation in sidebar if required by feature

### 6. Quality Gates

Run ALL of these before completing:
1. `pnpm test` — all tests pass
2. `pnpm lint` — Biome linting passes
3. `pnpm exec tsc --noEmit` — no TypeScript errors

### 7. Manual Verification

For each user-facing behavior in expectedBehavior:
1. Start dev server if not running: `pnpm dev`
2. Navigate to the relevant page
3. Test each interaction described in the feature
4. Record what you observed for each check

Each manual check = one `interactiveChecks` entry in your handoff.

## Example Handoff

```json
{
  "salientSummary": "Implemented GET /api/visualisatie/graph endpoint returning nodes (jobs, candidates, skills) and edges (matches, skill links) with pagination (top 100 matches). Created shared types in src/types/graph.ts. Ran pnpm test (6 passing), pnpm lint (clean), tsc --noEmit (clean). Verified via curl that endpoint returns correct structure with 200.",
  "whatWasImplemented": "API route app/api/visualisatie/graph/route.ts with Zod validation, pagination (limit 100 matches by matchScore DESC), type filtering (?types=jobs,candidates), and shared TypeScript types in src/types/graph.ts. Nodes include jobs (id, type, label, metadata), candidates, and top-level ESCO skills. Edges include matches and skill relationships.",
  "whatWasLeftUndone": "",
  "verification": {
    "commandsRun": [
      { "command": "pnpm test -- --grep 'visualisatie'", "exitCode": 0, "observation": "6 tests passing: graph-data-transform, filter-by-type, pagination-limit, empty-response, deleted-excluded, zod-validation" },
      { "command": "pnpm lint", "exitCode": 0, "observation": "Clean, no new errors" },
      { "command": "pnpm exec tsc --noEmit", "exitCode": 0, "observation": "No TypeScript errors" },
      { "command": "curl http://localhost:3002/api/visualisatie/graph", "exitCode": 0, "observation": "200 OK, response has nodes array (12 items) and edges array (8 items) and hasMore=false" }
    ],
    "interactiveChecks": [
      { "action": "GET /api/visualisatie/graph?types=jobs", "observed": "Only job nodes returned, no candidate or skill nodes in response" },
      { "action": "GET /api/visualisatie/graph with empty DB", "observed": "200 with empty nodes and edges arrays, hasMore=false" }
    ]
  },
  "tests": {
    "added": [
      {
        "file": "tests/visualisatie-graph-api.test.ts",
        "cases": [
          { "name": "returns nodes and edges for graph data", "verifies": "API response structure" },
          { "name": "limits to 100 match edges by default", "verifies": "Pagination default" },
          { "name": "filters by entity type", "verifies": "Type query param filtering" },
          { "name": "excludes deleted entities", "verifies": "Soft-delete filter" },
          { "name": "returns empty arrays when no data", "verifies": "Empty state handling" },
          { "name": "validates query params with Zod", "verifies": "Input validation" }
        ]
      }
    ]
  },
  "discoveredIssues": []
}
```

## When to Return to Orchestrator

- Database schema doesn't match what AGENTS.md describes (missing tables/columns)
- react-force-graph-3d has breaking API changes or compatibility issues with Next.js 16
- Existing page structure doesn't match expected patterns (e.g., vacature detail page missing)
- WebGL doesn't render in the test environment
- Feature requires modifying existing components beyond what's described
