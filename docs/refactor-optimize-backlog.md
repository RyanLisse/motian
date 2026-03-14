# Refactor & optimize backlog

Backlog items derived from `qlty smells --all`, package audit, and simplification opportunities.

**→ Omgezet naar beads (2025-03):** `bd list --status=open` toont alle open refactor/chore beads. Labels: `refactor`, `duplication`, `complexity`, `chore`, `packages`, `lint`, `sentry`.

## High complexity / many returns

- **app/api/chat/route.ts** — POST has high total complexity (54) and many returns (9). Split into smaller handlers or extract validation/rate-limit/streaming into helpers.
- **app/api/cv-analyse/route.ts** — POST has 6 returns. Extract early-exit validation and blob checks into a shared helper.
- **app/api/cv-file/route.ts** — GET has 6 returns. Consolidate error paths or use a small wrapper.
- **app/api/cv-upload/route.ts** — POST has 6 returns; similar pattern to cv-analyse. Share rate-limit + validation helper with cv-analyse.
- **app/api/reports/route.ts** — GET has 6 returns. Extract report-building and error handling.
- **app/interviews/page.tsx** — InterviewsPage function complexity 25. Split filters, data fetch, and table into subcomponents or hooks.
- **app/messages/page.tsx** — MessagesPage complexity 52. Split filters, URL params, and list rendering; consider a shared “list page with filters” pattern with interviews.
- **app/opdrachten/[id]/job-detail-fields.tsx** — JobDetailFields complexity 25. Extract sections (meta, description, deadlines) into smaller components.

## Duplication (similar/identical code)

- **app/api/berichten/route.ts & app/api/matches/route.ts** — 17 lines similar (pagination + searchParams). Extract shared `parseListParams(req)` or use a common list-handler wrapper.
- **app/api/gdpr/contacten/export/route.ts & app/api/gdpr/contacten/verwijder/route.ts** — 28 lines similar. Share layout, withApiHandler usage, and error response shape.
- **app/api/kandidaten/[id]/koppel/route.ts & app/api/vacatures/[id]/koppel/route.ts** — 16 lines similar (matchIds/candidateIds resolution). Extract shared `resolveKoppelPairs(matchIds, candidateIds, ...)`.
- **app/api/vacatures/route.ts & app/api/vacatures/zoeken/route.ts** — 20 lines identical (searchJobsUnified call). Deduplicate by calling one from the other or a shared service helper.
- **app/api/chat/route.ts & src/services/chat-sessions.ts** — getMessageText duplicated. Move to shared util (e.g. `src/lib/chat-message-utils.ts`).
- **app/api/reports/route.ts** — 22-line generateReport block duplicated twice; 19-line db.select block duplicated twice. Extract to a single report-fetch + report-render helper.
- **app/autopilot/page.tsx & app/autopilot/[runId]/page.tsx** — getStatusBadge 27 lines identical. Move to `app/autopilot/shared.tsx` or components.
- **app/interviews/loading.tsx, app/messages/loading.tsx, app/pipeline/loading.tsx** — 33 lines similar skeleton. Shared `ListPageSkeleton` component.

## Voice agent

- **agent/src/agent.ts** (voice) — Constructor with many returns (6). Consider factory or smaller init helpers.

## Minimize / simplify

- **Zod 4** — Currently on zod 3. Plan a separate migration to zod 4; update zod-to-json-schema in lockstep.
- **Vitest 4** — DevDep upgrade path; run full test suite after bump.
- **@types/node 25** — Major; validate Node version and typings before upgrading.
- **Deprecated deps** — pnpm reported deprecated subdependencies (e.g. @esbuild-kit/*, boolean, fluent-ffmpeg). Audit and replace or pin.
- **fumadocs pnpm.overrides** — Move to root `package.json` if needed so overrides take effect (warning in install).

## Sentry

- **Config** — Sentry is wired in `instrumentation.ts` (node + edge), `next.config.ts` (withSentryConfig), and error boundaries. Ensure `SENTRY_DSN` is set in production.
- **Check Sentry project** — Resolve open issues in Sentry (ryan-lisse-bv/motian); no code changes required for this backlog item.

## Lint: noArrayIndexKey (9 remaining)

- **app/professionals/[id]/page.tsx** — experienceEntries map key uses index; use stable id or composite key.
- **app/scraper/runs/[id]/page.tsx** — errors list key; use `err` content hash or index only for display-only list.
- **components/auto-match-results.tsx** — star icons key; stable (criterion + position) is acceptable or use criterion-star-${i} with biome-ignore.
- **components/candidate-profile/skills-experience-section.tsx** — experience entry key.
- **components/candidate-wizard/experience-input.tsx** — experience form rows key.
- **components/cv-document-viewer.tsx** — PDF page key (page number is stable).
- **components/matching/match-detail.tsx** — knockouts, gunning, process lists (3 maps); use criterion + optional id.

## Conflicts & verification

- No merge conflict markers found in repo.
- After changes: run `pnpm lint`, `pnpm exec tsc --noEmit`, `pnpm test`, and optionally `qlty check --fix --level=low`.
