---
title: "feat: Phase 11 — Opdrachtoverheid + Flextender Scrapers"
type: feat
date: 2026-02-21
branch: feat/phase11-new-platforms
---

# feat: Phase 11 — Opdrachtoverheid + Flextender Scrapers

## Overview

Add two new Dutch government/intermediary job platform scrapers to the Motia recruitment pipeline. Both platforms are **public** (no authentication required) and map cleanly to the existing unified job schema.

**Platforms:**
- **Opdrachtoverheid.nl** — Dutch government interim assignments. Nuxt.js site, server-rendered, `?page=N` pagination.
- **Flextender.nl** — Government-adjacent intermediary. Client-side JS pagination (requires browser interaction).

**Approach:** Both use Stagehand (BrowserBase) for reliable extraction via AI-powered `extract()`. No login flow needed — both are public.

## Research Findings

### Opdrachtoverheid.nl
- **URL**: `https://www.opdrachtoverheid.nl/` with `?page=N` pagination
- **Detail URL**: `/inhuuropdracht/{org-slug}/{title-slug}/{UUID}`
- **No auth required**
- **Anti-bot**: Minimal (Nuxt.js SSR, no Cloudflare)
- **Rich detail pages**: Organisation, Beschrijving, Opdracht sections + Knock-outcriteria (requirements), Selectiecriteria with point weights (wishes), Competenties, working conditions

### Flextender.nl
- **URL**: `https://www.flextender.nl/opdrachten/`
- **Detail URL**: `/opdracht?aanvraagnr=[ID]`
- **No auth required** for viewing
- **Pagination**: Client-side JS (needs Stagehand click navigation)
- **Rich detail pages**: Functieomschrijving, Knock-outcriteria (requirements), Gunningscriteria with point scoring (wishes), Competenties, VOG/Waadi requirements (conditions)

## Schema Mapping

No schema changes needed. Both platforms map to existing `jobs` table fields:

| Platform Field | → jobs Column | Notes |
|---|---|---|
| Titel/title | `title` | Direct map |
| Organisatie/Opdrachtgever | `company` | Government org name |
| Locatie/Regio | `location` + `province` | extractProvince() |
| Beschrijving | `description` | Full text from detail page |
| Referentienummer/Aanvraagnummer | `externalId` | Platform-specific ID |
| Detail URL | `externalUrl` | Full URL to detail page |
| Begindatum/Start | `startDate` | Date coercion |
| Einddatum | `endDate` | Date coercion |
| Sluitingsdatum/Einde inschrijfdatum | `applicationDeadline` | Date coercion |
| Maximum tarief | `rateMax` | Numeric (excl. BTW) |
| Knock-outcriteria | `requirements` | `[{description, isKnockout: true}]` |
| Selectiecriteria/Gunningscriteria | `wishes` | `[{description, evaluationCriteria}]` |
| Competenties | `competences` | `string[]` |
| WKA/VOG/Waadi | `conditions` | `string[]` |
| Uren per week | `positionsAvailable` or description | Parsed into description |
| Loondienst/Freelance | `contractType` + `allowsSubcontracting` | Mapped |

## Tasks

### 11.1 Opdrachtoverheid scraper step ✅
**File**: `steps/scraper/platforms/opdrachtoverheid.step.ts`
- StepConfig: trigger `platform.scrape`, filter `platform === "opdrachtoverheid"`
- Stagehand (BrowserBase) — no login needed
- Listing extraction: title, company, location, rateMax, hours, externalUrl, deadline info
- Pagination: navigate `?page=N` until no listings found (MAX_PAGES=10)
- Detail enrichment: visit each `externalUrl`, extract full description, requirements (knock-out), wishes (selectiecriteria with points), competences, conditions, dates
- Retry with exponential backoff (MAX_RETRIES=2)
- try/finally for stagehand.close()
- Emit `jobs.normalize` with platform: "opdrachtoverheid"

### 11.2 Flextender scraper step ✅
**File**: `steps/scraper/platforms/flextender.step.ts`
- StepConfig: trigger `platform.scrape`, filter `platform === "flextender"`
- Stagehand (BrowserBase) — no login needed
- Listing extraction: title, company (organisatie), location (regio), externalId (aanvraagnummer), externalUrl, startDate, deadline
- Pagination: click "Volgende" button (client-side JS pagination)
- Detail enrichment: visit `/opdracht?aanvraagnr=[ID]`, extract full description, knock-outcriteria (requirements), gunningscriteria (wishes), competenties, conditions (VOG, Waadi, fee)
- Retry with exponential backoff (MAX_RETRIES=2)
- try/finally for stagehand.close()
- Emit `jobs.normalize` with platform: "flextender"

### 11.3 Master scrape update
**File**: `steps/scraper/master-scrape.step.ts`
- Already loads configs from DB — no code change needed
- Need to seed 2 new rows into `scraper_configs` table

### 11.4 Seed script for new platform configs ✅
**File**: `scripts/seed-new-platforms.ts`
- Insert `scraper_configs` rows for opdrachtoverheid and flextender
- opdrachtoverheid: baseUrl `https://www.opdrachtoverheid.nl/`
- flextender: baseUrl `https://www.flextender.nl/opdrachten/`

### 11.5 Tests ✅
**File**: `tests/phase11-new-platforms.test.ts`
- Step config structure tests (both scrapers)
- Handler export tests
- Detail extraction logic presence tests (content assertions)
- Contract type mapping tests
- Province extraction tests
- Seed script existence test

### 11.6 Commit uncommitted WIP changes
- Stage and commit the pre-existing sidebar, schema comment, MCP, normalize, and record-scrape-result changes that add opdrachtoverheid + flextender support

## Acceptance Criteria

- [ ] `pnpm test` passes all existing + new tests
- [ ] Opdrachtoverheid scraper follows same patterns as Striive (try/finally, retry, detail enrichment)
- [ ] Flextender scraper handles JS pagination via Stagehand click
- [ ] Both scrapers emit `jobs.normalize` with correct platform identifier
- [ ] Knock-outcriteria mapped to `requirements` with `isKnockout: true`
- [ ] Selectiecriteria/Gunningscriteria mapped to `wishes` with `evaluationCriteria`
- [ ] Seed script creates DB config rows
- [ ] No schema changes needed (confirmed)
- [ ] MasterScrape dispatches to new platforms via DB configs

## Files Created
- `steps/scraper/platforms/opdrachtoverheid.step.ts`
- `steps/scraper/platforms/flextender.step.ts`
- `scripts/seed-new-platforms.ts`
- `tests/phase11-new-platforms.test.ts`

## Files Modified
- `components/app-sidebar.tsx` (already has WIP changes)
- `src/db/schema.ts` (already has WIP comment change)
- `src/mcp/server.ts` (already has WIP platform filter update)
- `steps/jobs/normalize.step.ts` (already has WIP provider/costCredits)
- `steps/jobs/record-scrape-result.step.ts` (already has WIP provider/costCredits)
