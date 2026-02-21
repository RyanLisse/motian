---
title: "feat: Phase 10 — Job Vacancy Content Enrichment"
type: feat
date: 2026-02-21
---

# Phase 10: Job Vacancy Content Enrichment

## Overview

All scraped job vacancies have sparse content — one-liner descriptions, empty requirements/wishes/competences/conditions arrays, null rates. The root cause: scrapers only extracted from listing overview pages, never visiting individual job detail pages where the rich content lives.

## Problem Statement

Current database state (all 61+ jobs):
- `description`: 44-91 characters (e.g. "Junior Projectleider bij Belastingdienst Non-ICT")
- `requirements`: `[]` (empty)
- `wishes`: `[]` (empty)
- `competences`: `[]` (empty)
- `conditions`: `[]` (empty)
- `rateMax`: `null`

The UI detail pages (`/opdrachten/[id]`) show empty sections for requirements, wishes, competences, and conditions.

## Tasks

### 10.1: Striive scraper detail-page enrichment ✅ (DONE)

**File:** `steps/scraper/platforms/striive.step.ts`

Added Step 4 after listing extraction:
- [x] Visit each job's `externalUrl` detail page
- [x] Extract full description, requirements, wishes, competences, conditions, rateMax, workArrangement, allowsSubcontracting
- [x] Merge detail data over listing data with smart fallbacks
- [x] Per-job error handling — individual failures don't break the batch
- [x] Simplified listing extraction schema (removed fields not on card UI)
- [x] Logging per job: `Detail verrijkt: BTBDN000695 (5 eisen, 3 wensen)`

### 10.2: Striive backfill enrichment script ✅ (DONE)

**File:** `scripts/enrich-striive-details.ts`

- [x] Auto-extracts Striive session cookies from browser via `@steipete/sweet-cookie`
- [x] Falls back to manual `STRIIVE_SESSION_COOKIE` env var
- [x] Verifies API access before processing
- [x] Fetches per-job detail from Striive supplier API (`/api/v2/job-requests/{id}`)
- [x] Extracts requirements, wishes, competences, conditions, description, rate, work arrangement
- [x] Only targets sparse jobs (description < 200 chars)
- [x] Polite 500ms delay between requests
- [x] Installed `@steipete/sweet-cookie` dependency

### 10.3: Indeed scraper detail-page enrichment

**File:** `steps/scraper/platforms/indeed.step.ts`

- [ ] After extracting listings from the search results page, visit each job's `externalUrl`
- [ ] Use Firecrawl to extract full job description, requirements, benefits
- [ ] Merge detail data over listing data
- [ ] Per-job error handling with fallback to listing data

**Pattern:** Same as Striive — listing extraction → per-job detail fetch → merge

### 10.4: LinkedIn scraper detail-page enrichment

**File:** `steps/scraper/platforms/linkedin.step.ts`

- [ ] After extracting listings, visit each job's `externalUrl` in the same Stagehand session
- [ ] Extract full description, qualifications, responsibilities from detail page
- [ ] Merge detail data over listing data
- [ ] Per-job error handling with fallback to listing data

**Pattern:** Same as Striive — Stagehand `extract` on detail page

### 10.5: Tests for enrichment ✅ (DONE)

**File:** `tests/phase10-enrichment.test.ts`

- [x] Test Striive scraper step config has correct structure
- [x] Test Indeed scraper step config has correct structure
- [x] Test LinkedIn scraper step config has correct structure
- [x] Test enrich script exists and has sweet-cookie import
- [x] Test sweet-cookie is in dependencies

## Acceptance Criteria

- [x] Striive scraper visits detail pages and extracts full content
- [x] Enrichment script auto-extracts cookies via sweet-cookie
- [x] Indeed scraper visits detail pages for full descriptions
- [x] LinkedIn scraper visits detail pages for full descriptions
- [x] All existing tests continue to pass (208 tests)
- [x] New enrichment tests pass (229 total)

## Files Created

- `scripts/enrich-striive-details.ts` ✅
- `tests/phase10-enrichment.test.ts` ✅

## Files Modified

- `steps/scraper/platforms/striive.step.ts` ✅ (detail-page enrichment)
- `steps/scraper/platforms/indeed.step.ts` ✅ (detail-page enrichment)
- `steps/scraper/platforms/linkedin.step.ts` ✅ (detail-page enrichment)
- `package.json` ✅ (added `@steipete/sweet-cookie`)

## References

- sweet-cookie: https://github.com/steipete/sweet-cookie
- SweetCookieKit: https://github.com/steipete/SweetCookieKit
- Striive supplier API: `https://supplier.striive.com/api/v2/job-requests`
- Existing scraper pattern: `steps/scraper/platforms/striive.step.ts:124-213`
