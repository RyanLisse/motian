# Harness Engineering Implementation Plan — Motian

## Source Material
- [Ryan Carson's Code Factory tweet](https://x.com/ryancarson/status/2023452909883609111) — 10-step concrete implementation
- [OpenAI: Harness Engineering](https://openai.com/index/harness-engineering/) — philosophy & patterns
- [Martin Fowler: Harness Engineering](https://martinfowler.com/articles/exploring-gen-ai/harness-engineering.html) — 3 pillars analysis

## Current State (Motian)
- Next.js 15 app, Drizzle ORM, Neon PostgreSQL + pgvector
- Biome linting + Vitest testing configured but NO CI/CD pipeline
- No GitHub Actions workflows exist
- Zod validation at ingestion boundary, circuit breaker on scrapers
- Dutch UI naming (`/api/scraper-configuraties`), English code variables

## Implementation Plan

### Phase 1: Machine-Readable Risk Contract (`harness.config.json`)
Create a single source of truth for risk classification and merge policy.

**File: `harness.config.json`** (root)
```json
{
  "version": "1",
  "riskTierRules": {
    "high": [
      "src/db/schema.ts",
      "src/services/gdpr.ts",
      "src/lib/crypto.ts",
      "app/api/cron/**",
      "drizzle/**"
    ],
    "medium": [
      "src/services/**",
      "src/ai/**",
      "app/api/**"
    ],
    "low": ["**"]
  },
  "mergePolicy": {
    "high": {
      "requiredChecks": [
        "risk-policy-gate",
        "typecheck",
        "test",
        "lint",
        "browser-evidence"
      ]
    },
    "medium": {
      "requiredChecks": [
        "risk-policy-gate",
        "typecheck",
        "test",
        "lint"
      ]
    },
    "low": {
      "requiredChecks": ["risk-policy-gate", "lint"]
    }
  },
  "docsDriftRules": {
    "triggers": {
      "src/db/schema.ts": ["docs/architecture.md"],
      "src/services/**": ["docs/architecture.md"],
      "src/ai/**": ["docs/architecture.md"]
    }
  },
  "evidenceRequirements": {
    "app/**/*.tsx": "browser-screenshot",
    "components/**": "browser-screenshot"
  }
}
```

### Phase 2: GitHub Actions CI Pipeline
Create the CI pipeline that enforces the risk contract.

**Files to create:**
1. `.github/workflows/ci.yml` — Main CI pipeline (lint, typecheck, test, build)
2. `.github/workflows/risk-policy-gate.yml` — Preflight risk classification
3. `.github/workflows/harness-smoke.yml` — Smoke tests for high-risk paths

### Phase 3: Risk Policy Gate Script
A deterministic TypeScript script that:
- Reads `harness.config.json`
- Classifies changed files into risk tiers
- Computes required checks for the PR
- Validates docs drift (schema changes require docs updates)
- Outputs risk tier + required checks as GitHub Actions outputs

**File: `scripts/harness/risk-policy-gate.ts`**

### Phase 4: Harness CLI Commands
npm scripts for local harness operations:

```
pnpm harness:risk-tier        — Classify current changes
pnpm harness:pre-pr           — Run all required checks locally
pnpm harness:smoke            — Run smoke tests
pnpm harness:browser-evidence — Capture browser screenshots
pnpm harness:verify-evidence  — Validate evidence freshness
pnpm harness:weekly-metrics   — Generate harness metrics
```

### Phase 5: Browser Evidence System
Playwright-based evidence capture:
- Screenshots of key UI flows
- Stored in `harness-evidence/` (gitignored, uploaded as PR artifacts)
- Verification script checks freshness and expected elements

**Files:**
- `scripts/harness/capture-browser-evidence.ts`
- `scripts/harness/verify-browser-evidence.ts`
- `playwright.harness.config.ts`

### Phase 6: Docs Drift Enforcement
When schema/service files change, require corresponding docs updates.
Built into the risk-policy-gate as an assertion.

### Phase 7: Harness Gap Tracking
When production issues occur, create a harness gap issue:
```
production regression → harness gap issue (beads) → case added → SLA tracked
```

**File: `scripts/harness/create-gap-issue.ts`** — Creates a `bd` issue with type=bug, tags harness-gap

### Phase 8: Structural Tests
Vitest tests that enforce architectural constraints:
- Dependency direction (no UI importing from DB directly)
- Export contracts (services must export expected functions)
- Schema validation (all Zod schemas must be tested)

**File: `tests/harness/structural.test.ts`**

### Phase 9: Entropy Management
Scripts that detect and flag:
- Unused exports
- Missing test coverage for new files
- Stale documentation references
- Orphaned database columns

**File: `scripts/harness/entropy-check.ts`**

### Phase 10: Integration into Existing Workflow
- Update `CLAUDE.md` with harness engineering rules
- Update `Justfile` with harness commands
- Add harness status to the existing health endpoint

## File Summary

| File | Purpose |
|------|---------|
| `harness.config.json` | Risk contract |
| `.github/workflows/ci.yml` | CI pipeline |
| `.github/workflows/risk-policy-gate.yml` | Preflight gate |
| `scripts/harness/risk-policy-gate.ts` | Risk classification |
| `scripts/harness/capture-browser-evidence.ts` | UI evidence |
| `scripts/harness/verify-browser-evidence.ts` | Evidence validation |
| `scripts/harness/create-gap-issue.ts` | Incident→harness loop |
| `scripts/harness/entropy-check.ts` | Entropy detection |
| `tests/harness/structural.test.ts` | Architectural tests |
| `playwright.harness.config.ts` | Playwright config |
| `Justfile` | Updated with harness commands |
