---
status: complete
priority: p2
issue_id: "005"
tags: [code-review, error-handling, debugging]
dependencies: []
---

# P2: Error wrapping in striive.ts discards original stack trace

## Problem Statement

In `scrapeViaModal` catch block, wrapping errors with `new Error(message)` discards the original stack trace, making debugging harder.

## Findings

- **Source**: kieran-typescript-reviewer
- **Location**: `src/services/scrapers/striive.ts:387-391`

## Proposed Solutions

### Option A: Use `{ cause: err }` option
```typescript
throw new Error(`Striive Modal scrape mislukt: ${err instanceof Error ? err.message : String(err)}`, { cause: err });
```
- **Pros**: Preserves full stack trace chain
- **Cons**: None
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] Error wrapping uses `{ cause: err }`
- [ ] Original stack trace preserved in error chain
