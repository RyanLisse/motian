---
title: feat: Add recruiter match briefs, scorecards, and pipeline health
type: feat
status: active
date: 2026-04-05
origin: docs/brainstorms/2026-02-23-candidate-intelligence-structured-matching-brainstorm.md
---

# feat: Add recruiter match briefs, scorecards, and pipeline health

## Overview

Add a recruiter-facing insights layer that translates Motian's existing matching and intake systems into directly usable product guidance. The first slice ships four connected outcomes without a schema migration:

1. Match Briefs inside the candidate detail flow
2. Candidate Intake Scorecard inside the candidate detail flow
3. Vacature Triage Scorecard inside the vacature detail flow
4. Pipeline Health snapshot on the overview page

The implementation should reuse existing matching data (`jobMatches`, structured matching, embeddings, ESCO mappings, intake-derived candidate metadata) and present it in recruiter language: why this match exists, what is missing, where the operational blockers are, and whether the pipeline itself is healthy enough to trust.

## Problem Frame

Motian already has meaningful raw signals:
- hybrid and semantic matching in `src/services/scoring.ts` and `src/services/auto-matching.ts`
- structured match evaluation in `src/services/structured-matching.ts` and `src/services/structured-match-review.ts`
- candidate intake enrichment in `src/services/candidate-intake.ts` and `src/services/cv-parser.ts`
- vacature enrichment and embeddings in `src/services/ai-enrichment.ts` and `src/services/embedding.ts`
- persisted scraper and pipeline telemetry in `app/overzicht/data.ts`, `src/services/scrape-pipeline.ts`, and `scrapeResults`

What is missing is a recruiter-native interpretation layer. Recruiters still have to infer a lot from low-level scores, raw fields, and separate panels. The goal of this plan is to turn the current system into a clearer recruiter product by surfacing structured briefs and health signals where they are already working.

## Requirements Trace

- R1. Recruiters can see a structured explanation for why a kandidaat-vacature match exists, including must-have coverage, ESCO overlap, raw skill overlap, commercial blockers, and a final recommendation.
- R2. Recruiters can see a candidate intake scorecard that highlights profile completeness, skill extraction quality, ESCO coverage, inferred seniority, and the most useful next action.
- R3. Recruiters can see a vacature triage scorecard that summarizes must-haves, nice-to-haves, seniority, work constraints, sourcing difficulty, and matching readiness.
- R4. Recruiters can see a pipeline health snapshot on the overview page showing whether the matching/scraping/enrichment substrate is fresh and trustworthy.
- R5. The first slice must avoid schema or migration work and instead compute from existing persisted fields and services.
- R6. Existing matching and intake flows must keep working without behavioral regression.

## Scope Boundaries

- No new database tables or columns.
- No new external dependencies.
- No batch review queue or recruiter submission pack in this slice.
- No new MCP tools in this slice; the service layer should stay reusable so MCP/API parity can be added next.
- No replacement of the current auto-match pipeline; this is an interpretation layer on top of it.

## Context & Research

### Relevant Code and Patterns

- `src/services/structured-match-review.ts` already persists structured matching outputs onto `jobMatches` and revalidates `/kandidaten`, `/vacatures`, and `/overzicht`.
- `src/services/candidate-intake.ts` already assembles recruiter-facing candidate recommendations and exposes structured candidate metadata (`skillsStructured`, `totalYearsExperience`, `highestEducationLevel`, industries, preferences).
- `app/kandidaten/[id]/page.tsx` already renders recruiter overview, recommendation panels, and expandable match details; it is the natural insertion point for Match Briefs and Candidate Intake Scorecard.
- `app/vacatures/[id]/page.tsx` already renders recruiter cockpit, AI grading, and shortlist context; it is the natural insertion point for Vacature Triage Scorecard.
- `app/overzicht/data.ts` already aggregates scraper, vacature, interview, and pipeline data using persisted SQL-backed reads; it is the natural insertion point for Pipeline Health.
- `components/matching/match-detail.tsx` already renders structured criteria, risk profile, and recommendation and can be extended rather than replaced.
- `tests/structured-match-review-service.test.ts`, `tests/candidate-intake.test.ts`, and `tests/structured-match-api.test.ts` show the preferred structural/unit-test style for service-first work in this area.

### Institutional Learnings

- `docs/brainstorms/2026-02-23-candidate-intelligence-structured-matching-brainstorm.md` establishes that recruiter trust comes from per-criterion evidence, tiered requirements, and explicit risk profiling rather than a single score.
- `docs/plans/2026-02-23-feat-candidate-intelligence-structured-matching-plan.md` reinforces that structured match data should be treated as first-class product data, with hybrid scoring retained as a fast prefilter.
- `docs/brainstorms/2026-03-05-kandidaat-profiel-pipeline-koppeling-brainstorm.md` reinforces recruiter intent: top suggestions should turn into clear follow-up actions, not passive scoring.
- `docs/solutions/workflow-issues/scraper-analytics-schedule-optimization-ScraperSystem-20260223.md` and `docs/solutions/performance-issues/vercel-fluid-compute-spike-Pipeline-20260329.md` indicate the dashboard should rely on persisted aggregates and careful server-side computation, not polling-heavy or chatty live views.

### External References

- No external research is required for this slice because the relevant matching, intake, and dashboard patterns are already strongly represented in the repo and previous planning artifacts.

## Key Technical Decisions

- Compute recruiter insights in a new shared service rather than scattering heuristics across pages.
  Rationale: the same insight objects can later back UI, REST, MCP, and chat surfaces.
- Reuse existing persisted data (`jobMatches`, candidate structured profile metadata, vacature enrichment, embeddings) instead of introducing a new persistence model.
  Rationale: faster delivery, lower risk, no migration.
- Keep `MatchDetail` as the structured-matching renderer and add a recruiter-specific brief layer adjacent to it.
  Rationale: structured-match output is already trusted and should not be duplicated.
- Put Pipeline Health on `/overzicht` by extending the existing cached data function.
  Rationale: overview is already the command center and already uses persisted aggregates.
- Use Dutch recruiter-facing labels in the UI, while keeping service internals in English.
  Rationale: matches existing project conventions.

## Open Questions

### Resolved During Planning

- Should this slice introduce new persistence? No. Existing persisted data is enough for a first recruiter-insights slice.
- Should the health dashboard be a separate page? No. It should start as a compact overview section on `app/overzicht/page.tsx`.
- Should the work start with UI or services? Services first, because candidate, vacature, and overview surfaces all need consistent derived insight objects.

### Deferred to Implementation

- Exact scoring thresholds for `Go`, `Twijfel`, and `No-go` in the new brief layer. These should be calibrated against existing structured-match and quick-score outputs once implemented in code.
- Exact wording for sourcing difficulty and next-action labels. These should be finalized during implementation while preserving the core categories defined here.

## High-Level Technical Design

> This illustrates the intended approach and is directional guidance for review, not implementation specification. The implementing agent should treat it as context, not code to reproduce.

```mermaid
flowchart TD
    Candidate[Candidate record + intake metadata] --> Insights[Recruiter insights service]
    Job[Vacature record + enrichment + ESCO] --> Insights
    Match[jobMatches + structured match result] --> Insights
    Scrape[Scrape and enrichment aggregates] --> Insights

    Insights --> CandidatePage[app/kandidaten/[id]/page.tsx]
    Insights --> JobPage[app/vacatures/[id]/page.tsx]
    Insights --> OverviewPage[app/overzicht/page.tsx]
```

## Implementation Units

- [ ] **Unit 1: Build shared recruiter insight models and derivation service**

**Goal:** Create a single service that derives recruiter-facing Match Briefs, Candidate Intake Scorecards, Vacature Triage Scorecards, and Pipeline Health snapshots from existing entities.

**Requirements:** R1, R2, R3, R4, R5

**Dependencies:** None

**Files:**
- Create: `src/services/recruiter-insights.ts`
- Modify: `src/services/structured-match-review.ts`
- Test: `tests/recruiter-insights.test.ts`

**Approach:**
- Define plain TypeScript output types for `MatchBrief`, `CandidateIntakeScorecard`, `VacatureTriageScorecard`, and `PipelineHealthSnapshot`.
- Build helper functions that consume existing candidate/job/match data instead of calling LLMs or introducing new persistence.
- Match brief should combine:
  - existing match score / structured recommendation
  - must-have coverage from existing structured criteria when available
  - ESCO overlap counts where canonical skills are available
  - raw skill overlap fallback when canonical skills are sparse
  - commercial blockers from rate, location, and availability mismatches
  - recruiter recommendation mapped to `Go`, `Twijfel`, or `No-go`
- Candidate scorecard should combine:
  - profile completeness signals (resume, role, location, skills, structured sections)
  - parsed/structured skills quality
  - ESCO coverage count/ratio when available
  - inferred seniority from total years of experience / role cues
  - next-action mapping such as `verrijk`, `bel`, `afwijzen`, `auto-match`
- Vacature scorecard should combine:
  - extracted must-haves and nice-to-haves
  - seniority/work arrangement/contract/rate constraints
  - ESCO availability and enrichment readiness
  - sourcing difficulty heuristic based on scarcity/constraint combinations
  - readiness state `klaar_voor_matching` vs `heeft_opschoning_nodig`
- Pipeline health should aggregate persisted signals only, such as scraper freshness, missing job/candidate embeddings, vacatures without summaries, matches missing structured review, and recent scrape failures.
- Update `revalidateStructuredMatchViews` only if new derived surfaces require additional path revalidation.

**Patterns to follow:**
- `src/services/candidate-intake.ts`
- `src/services/structured-match-review.ts`
- `app/overzicht/data.ts`

**Test scenarios:**
- Happy path: match brief derived from a structured match includes must-have coverage, ESCO/raw overlap, blockers, and a `Go`/`Twijfel`/`No-go` recommendation.
- Happy path: candidate scorecard marks a rich candidate as complete enough for `auto-match` or `bel`.
- Happy path: vacature scorecard marks a well-enriched vacancy as ready for matching.
- Edge case: match brief falls back cleanly when structured criteria are absent but quick-score reasoning exists.
- Edge case: candidate scorecard handles candidates with missing `skillsStructured`, `resumeRaw`, or years of experience without throwing.
- Edge case: vacature scorecard handles vacatures with missing summary, requirements, or work arrangement.
- Error path: pipeline health treats missing aggregates as zeros/defaults rather than failing the page.
- Integration: pipeline health aggregation reflects persisted scrape/enrichment/match state rather than invented in-memory values.

**Verification:**
- The new service returns stable, serializable insight objects for candidate, vacature, match, and overview contexts.
- The tests demonstrate both structured-data and sparse-data paths.

- [ ] **Unit 2: Surface Candidate Intake Scorecard and Match Briefs on the kandidaat detail page**

**Goal:** Add recruiter-native insight panels to `app/kandidaten/[id]/page.tsx` so a recruiter can understand both the candidate's intake quality and the reasoning behind suggested matches.

**Requirements:** R1, R2, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `app/kandidaten/[id]/page.tsx`
- Modify: `components/matching/match-detail.tsx`
- Create: `components/candidate-profile/candidate-intake-scorecard.tsx`
- Create: `components/matching/match-brief.tsx`
- Test: `tests/recruiter-insights-ui.test.ts`

**Approach:**
- Compute a candidate scorecard in the server page and render it in a recruiter-visible spot near the existing recruiter overview / recommendation flow.
- Extend the match detail area with a recruiter brief block that highlights:
  - waarom deze match bestaat
  - must-haves gehaald / gemist
  - ESCO overlap vs skill overlap
  - commerciële blockers
  - eindadvies
- Keep the existing structured-match detail as the evidence section and place the recruiter brief above it so recruiters see the summary first and the criterion evidence second.
- Reuse current recommendation panels and links instead of adding a separate navigation path.

**Patterns to follow:**
- `components/candidate-recommendation-panel.tsx`
- `components/matching/match-detail.tsx`
- `app/kandidaten/[id]/page.tsx`

**Test scenarios:**
- Happy path: kandidaat detail renders a candidate intake scorecard when structured profile data exists.
- Happy path: expanded match row shows recruiter brief sections alongside existing structured evidence.
- Edge case: candidate scorecard renders useful fallback copy when CV/structured skills are missing.
- Edge case: match brief renders without ESCO overlap when canonical data is unavailable.
- Integration: existing match actions and recommendation panel continue to render and link correctly after the new panels are added.

**Verification:**
- Candidate detail page shows both the intake scorecard and recruiter brief with no regression to existing panels or links.
- Structural/UI tests cover the new render paths.

- [ ] **Unit 3: Surface Vacature Triage Scorecard and Pipeline Health in recruiter dashboards**

**Goal:** Add vacancy-level triage guidance on the vacature detail page and a compact pipeline health section on the overview page.

**Requirements:** R3, R4, R6

**Dependencies:** Unit 1

**Files:**
- Modify: `app/vacatures/[id]/page.tsx`
- Create: `components/vacatures/vacature-triage-scorecard.tsx`
- Modify: `app/overzicht/data.ts`
- Modify: `app/overzicht/page.tsx`
- Create: `components/overview/pipeline-health-card.tsx`
- Test: `tests/pipeline-health-overview.test.ts`

**Approach:**
- Compute vacature triage insight in `app/vacatures/[id]/page.tsx` and render it near recruiter cockpit / AI summary so it influences matching decisions.
- Extend `getOverviewData()` with a cached pipeline health snapshot derived from persisted aggregates:
  - scraper freshness / stale platforms
  - recent scrape failures
  - jobs missing enrichment summaries
  - jobs missing embeddings
  - candidates missing embeddings
  - matches lacking structured review
- Render the snapshot as a compact overview card with counts, status labels, and links to existing operational surfaces where possible.
- Keep the overview implementation cheap and cached; no polling or client-side refresh loops.

**Patterns to follow:**
- `app/vacatures/[id]/page.tsx`
- `app/overzicht/data.ts`
- `app/overzicht/page.tsx`

**Test scenarios:**
- Happy path: vacature page renders must-haves, constraints, sourcing difficulty, and matching readiness.
- Happy path: overview page renders pipeline health counts and links from aggregated server data.
- Edge case: stale scraper data is surfaced as a warning state.
- Edge case: missing embeddings/enrichment still render as health issues without breaking the page.
- Integration: overview data cache shape remains serializable and compatible with the page component.

**Verification:**
- Vacature detail and overview surfaces both expose recruiter guidance using the shared insight models.
- New aggregate reads stay server-side and cached.

- [ ] **Unit 4: Add regression coverage for derived recruiter insight behavior**

**Goal:** Lock the new derived behavior with focused tests so future matching/intake changes do not silently break recruiter-facing guidance.

**Requirements:** R1, R2, R3, R4, R6

**Dependencies:** Units 1-3

**Files:**
- Modify: `tests/candidate-intake.test.ts`
- Modify: `tests/structured-match-review-service.test.ts`
- Create: `tests/recruiter-insights.test.ts`
- Create: `tests/recruiter-insights-ui.test.ts`
- Create: `tests/pipeline-health-overview.test.ts`

**Approach:**
- Add unit coverage around the insight derivation service.
- Add targeted regression assertions where existing candidate-intake and structured-match tests already cover adjacent seams.
- Prefer focused behavioral assertions over broad snapshot tests.

**Execution note:** Start with failing tests for the core derivation outputs before wiring the UI surfaces.

**Patterns to follow:**
- `tests/candidate-intake.test.ts`
- `tests/structured-match-review-service.test.ts`
- `tests/structured-match-api.test.ts`

**Test scenarios:**
- Happy path: core derived outputs match the intended recruiter semantics.
- Edge case: sparse inputs degrade gracefully and still produce deterministic UI-safe shapes.
- Error path: missing candidate/job/match context fails with explicit null/empty outputs instead of throwing.
- Integration: page-level consumers still render after receiving the new derived shapes.

**Verification:**
- The new behavior is covered at both service and UI boundary levels.
- Existing related tests continue to pass after the new insights are integrated.

## System-Wide Impact

- **Interaction graph:** candidate detail, vacature detail, and overview all start depending on a shared recruiter-insights service, so its output contracts must remain stable and serializable.
- **Error propagation:** insight derivation should degrade to partial/empty sections, not fail the page, because these are advisory surfaces layered onto existing recruiter workflows.
- **State lifecycle risks:** no new persisted state is introduced; the main risk is inconsistent interpretation logic if derivation is duplicated.
- **API surface parity:** this slice intentionally stops at shared services plus page surfaces; future API/MCP parity should call into the same service rather than re-implementing heuristics.
- **Integration coverage:** overview aggregates, structured-match derived outputs, and candidate-intake metadata need targeted tests because they cross service boundaries.
- **Unchanged invariants:** existing auto-match, structured-match review, candidate intake, and recruiter cockpit behavior should remain intact; this work only adds interpretive UI and shared derivation helpers.

## Risks & Dependencies

| Risk | Mitigation |
|------|------------|
| Heuristic recruiter recommendations feel arbitrary | Base all derived decisions on existing persisted signals and keep thresholds explicit in one shared service |
| Overview health card becomes expensive | Reuse `app/overzicht/data.ts` caching and aggregate persisted data only |
| Match brief duplicates or conflicts with structured-match evidence | Make the brief a summary layer that references existing structured-match concepts rather than replacing them |
| Sparse candidate/job records produce blank or broken panels | Define graceful fallback states and test sparse-data cases explicitly |

## Documentation / Operational Notes

- This slice should be documented later as the recruiter-side interpretation layer for matching and intake.
- If recruiter feedback shows the heuristics are valuable, the next follow-up should add MCP/API parity and optionally persistence for reviewer overrides.

## Sources & References

- **Origin document:** `docs/brainstorms/2026-02-23-candidate-intelligence-structured-matching-brainstorm.md`
- Related brainstorming: `docs/brainstorms/2026-03-05-kandidaat-profiel-pipeline-koppeling-brainstorm.md`
- Related plan: `docs/plans/2026-02-23-feat-candidate-intelligence-structured-matching-plan.md`
- Related code: `src/services/structured-match-review.ts`
- Related code: `src/services/candidate-intake.ts`
- Related code: `app/kandidaten/[id]/page.tsx`
- Related code: `app/vacatures/[id]/page.tsx`
- Related code: `app/overzicht/data.ts`
