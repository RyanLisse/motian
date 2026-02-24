---
status: complete
priority: p1
issue_id: "001"
tags: [code-review, typescript, type-safety]
dependencies: []
---

# P1: Striive scraper return type mismatch

## Problem Statement

`scrapeStriive` returns `Promise<Record<string, unknown>[]>` while the other two scrapers return `Promise<RawScrapedListing[]>`. This type mismatch means TypeScript cannot catch schema violations at compile time for Striive listings.

## Findings

- **Source**: kieran-typescript-reviewer
- **Location**: `src/services/scrapers/striive.ts:308`
- **Evidence**: Function signature `export async function scrapeStriive(_url: string): Promise<Record<string, unknown>[]>` vs `scrapeFlextender(): Promise<RawScrapedListing[]>`

## Proposed Solutions

### Option A: Change return type to RawScrapedListing[]
- **Pros**: Type safety, consistent with other scrapers
- **Cons**: May require adjusting Modal sandbox output mapping
- **Effort**: Small
- **Risk**: Low

## Acceptance Criteria

- [ ] `scrapeStriive` return type is `Promise<RawScrapedListing[]>`
- [ ] TypeScript compiles without errors
- [ ] Biome lint passes
