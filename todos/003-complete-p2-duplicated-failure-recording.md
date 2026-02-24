---
status: complete
priority: p2
issue_id: "003"
tags: [code-review, refactor, dry]
dependencies: []
---

# P2: Duplicated failure-recording pattern in scrape-pipeline

## Problem Statement

The error-recording logic (try/catch `recordScrapeResult` with `status: "failed"`) is duplicated in two places in `scrape-pipeline.ts` (lines 32-46 and 52-64). This violates DRY and makes future changes error-prone.

## Findings

- **Source**: kieran-typescript-reviewer
- **Location**: `src/services/scrape-pipeline.ts:32-46` and `src/services/scrape-pipeline.ts:52-64`

## Proposed Solutions

### Option A: Extract `recordFailure(platform, errors, startTime)` helper
- **Pros**: DRY, single point of change
- **Cons**: Minor indirection
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Helper function extracted
- [ ] Both call sites use the helper
- [ ] Tests pass
