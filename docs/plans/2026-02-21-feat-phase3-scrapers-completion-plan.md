---
title: "Phase 3: Complete Indeed + LinkedIn Scrapers"
type: feat
date: 2026-02-21
---

# Phase 3: Complete Indeed + LinkedIn Scrapers

## Overview

Phase 3 is 80% complete. The Indeed (Firecrawl) and LinkedIn (Stagehand) scraper step files, seed configs, and contract tests all exist and pass. The remaining work is:

1. **Close completed beads** (1pt.1–1pt.4 are done)
2. **Build HTML fixture tests** (1pt.5 — offline regression tests)
3. **Harden step files** with minor improvements found during review

## Current State

| File | Status |
|------|--------|
| `steps/scraper/platforms/indeed.step.ts` | ✅ Complete (149 lines) |
| `steps/scraper/platforms/linkedin.step.ts` | ✅ Complete (147 lines) |
| `scripts/seed-indeed-linkedin-configs.ts` | ✅ Complete |
| `tests/phase3-scrapers.test.ts` | ✅ 17/17 tests passing |
| `tests/fixtures/indeed/` | ❌ Empty — needs HTML snapshots |
| `tests/fixtures/striive/` | ❌ Empty — needs HTML snapshots |
| `tests/fixture-extraction.test.ts` | ❌ Missing — offline extraction tests |

## Implementation Plan

### Task 1: Close completed beads

```bash
bd close motian-1pt.1 motian-1pt.2 motian-1pt.3 motian-1pt.4 --reason="Implementation exists and tests pass"
```

### Task 2: Create HTML fixture snapshots

Create realistic HTML fixture files for offline testing:

- `tests/fixtures/indeed/search-results.html` — Sample Indeed NL search results page
- `tests/fixtures/indeed/single-job.html` — Single Indeed job detail page
- `tests/fixtures/linkedin/search-results.html` — Sample LinkedIn job search page

### Task 3: Build fixture extraction tests

Create `tests/fixture-extraction.test.ts`:

- Test Indeed `parseSalary()` helper with edge cases (€80-100/uur, €4.500/maand, no salary)
- Test Indeed `mapContractType()` with all Dutch contract types
- Test LinkedIn province extraction from "City - Province" format
- Test Zod schema validation against fixture-derived data
- Test deduplication logic (same externalId = update not insert)

### Task 4: Harden LinkedIn step

- Add `stagehand.close()` in finally block (currently only at end, not on error path)
- Add `input` type cast like Indeed step does

### Task 5: Commit, sync beads, push

## Acceptance Criteria

- [x] All Phase 3 beads (1pt.1–1pt.5) closed
- [x] HTML fixture files in `tests/fixtures/`
- [x] Fixture extraction tests passing
- [x] LinkedIn step has proper cleanup
- [x] All 42+ tests passing (71 tests)
- [ ] Committed and pushed

## References

- Indeed step: `steps/scraper/platforms/indeed.step.ts`
- LinkedIn step: `steps/scraper/platforms/linkedin.step.ts`
- Striive reference: `steps/scraper/platforms/striive.step.ts`
- Schema: `src/schemas/job.ts`
- Existing tests: `tests/phase3-scrapers.test.ts`
