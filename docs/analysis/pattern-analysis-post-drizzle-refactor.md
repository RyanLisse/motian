# Pattern Analysis: Post-Drizzle Refactor Quality Fixes

**Analysis Date:** 2026-03-14
**Scope:** Pattern recognition for plan at `docs/plans/2026-03-14-fix-post-drizzle-refactor-quality-fixes-plan.md`
**Focus:** Identify best practices, anti-patterns, and improvement opportunities

---

## Executive Summary

This analysis examines three core patterns from the Post-Drizzle Refactor:

1. **Drizzle Import Pattern** — Centralized imports from `@/src/db` (re-exports workspace package)
2. **Test Mock Pattern** — Separate mocks for db instance and schema tables using `vi.hoisted()`
3. **pnpm Override Pattern** — Force single dependency versions across workspace

**Verdict:** The patterns are **industry best practices** with minor refinement opportunities. The plan correctly identifies the root causes (pg version mismatch, incomplete test mocks) and proposes sound solutions.

---

## Pattern 1: Drizzle Import Pattern

### Current Implementation

```typescript
// ✅ CORRECT (after refactor)
import { db, sql, eq, and } from "@/src/db";
import { jobs, candidates } from "@/src/db/schema";

// ❌ WRONG (old pattern, still found in some docs)
import { eq } from "drizzle-orm";
```

**Architecture:**
- `packages/db/` — Workspace package with Drizzle ORM + pg driver
- `src/db/index.ts` — Re-exports all exports from `@motian/db`
- `src/db/schema.ts` — Not present (schema lives in workspace package)

**Files using pattern:** 20+ files including:
- `trigger/embeddings-batch.ts:2`
- `trigger/candidate-dedup.ts:2`
- `app/api/chat/route.ts`
- `src/services/jobs/pipeline-summary.ts`

### Best Practice Analysis

**✅ Industry Best Practices:**
1. **Single Source of Truth** — All Drizzle imports go through one path (`@/src/db`)
2. **Encapsulation** — Application code doesn't directly depend on `drizzle-orm` package
3. **Version Control** — Prevents duplicate drizzle instances from different `pg` versions
4. **Testability** — Single mock point for all db operations

**Comparison to Industry:**
- **Prisma pattern:** Similar re-export through `@/lib/prisma` (Next.js convention)
- **MikroORM pattern:** Centralized `em` (EntityManager) export
- **TypeORM pattern:** DataSource singleton pattern

**Benefits:**
- Easier to swap ORM implementations
- Centralized connection pool configuration
- Simplified mocking in tests
- Clear architectural boundaries

### Anti-Pattern Detection

**❌ Found in documentation** (`docs/research/`, `docs/brainstorms/`):
```typescript
// Old direct imports (pre-refactor)
import { eq } from "drizzle-orm";
import { drizzle } from "drizzle-orm/node-postgres";
```

**Impact:** Low (documentation only, no runtime code uses this)

**Recommendation:** Update documentation to reference current pattern.

---

## Pattern 2: Test Mock Pattern

### Current Implementation (Reference Example)

From `tests/autopilot-run-detail-evidence.test.ts:18-33`:

```typescript
// ✅ CORRECT: Separate mocks for db and schema
vi.mock("@/src/db", () => ({
  db: { select: selectMock },
}));

vi.mock("@/src/db/schema", () => ({
  autopilotRuns: { runId: "runId", startedAt: "startedAt" },
  autopilotFindings: { runId: "runId", severity: "severity" },
}));
```

Advanced pattern using `vi.hoisted()` (from `tests/chat-sessions-compatibility.test.ts:4-40`):

```typescript
// ✅ BEST PRACTICE: Hoisted mocks (avoid temporal dead zone)
const { chatSessionMessages, chatSessions, mockDb } = vi.hoisted(() => {
  const chatSessions = {
    __table: "chatSessions",
    id: "chatSessions.id",
    sessionId: "chatSessions.sessionId",
    // ... column definitions
  };

  return {
    chatSessions,
    chatSessionMessages,
    mockDb: { execute: vi.fn(), insert: vi.fn(), /* ... */ },
  };
});

vi.mock("../src/db", () => ({ db: mockDb }));
vi.mock("../src/db/schema", () => ({ chatSessionMessages, chatSessions }));
```

### Best Practice Analysis

**✅ Industry Best Practices:**
1. **Separate Concerns** — db instance vs schema tables mocked independently
2. **Hoisting** — Avoids temporal dead zone issues (Vitest-specific best practice)
3. **Type Safety** — Mock structure matches runtime exports
4. **Explicit Exports** — Only mock what's imported (prevents over-mocking)

**Comparison to Industry:**
- **Jest pattern:** Similar `jest.mock()` with hoisting via `jest.doMock()`
- **Vitest docs:** Recommends `vi.hoisted()` for complex mocks ([vitest.dev/guide/mocking](https://vitest.dev/guide/mocking.html))
- **Testing Library pattern:** Mock modules before test imports

**Why this pattern works:**
- Vitest hoists `vi.mock()` calls to top of file during transformation
- Without `vi.hoisted()`, mock factory can't reference variables defined after imports
- Separate schema mock prevents "No export" errors when code imports table definitions

### Anti-Pattern: Incomplete Mocks

**❌ Failing tests** (from plan):
```typescript
// ❌ WRONG: Missing schema table exports
vi.mock("@/src/db", () => ({
  db: { /* mocks */ },
  // Missing: eq, desc, sql helpers
}));

// No schema mock at all
// Result: "No 'autopilotRuns' export is defined on the '@/src/db' mock"
```

**Root Cause:** After Drizzle refactor, `@/src/db` re-exports:
1. `db` instance
2. Drizzle helpers (`eq`, `and`, `sql`, `desc`)
3. Schema tables (`autopilotRuns`, `autopilotFindings`, etc.) — via re-export from workspace package

**Tests only mock (1)**, code imports (1), (2), and (3) → Mock mismatch.

### Recommended Pattern

```typescript
// ✅ GOLD STANDARD (combines both approaches)
const { mockDb, mockSchema } = vi.hoisted(() => ({
  mockDb: {
    insert: vi.fn(() => ({ values: vi.fn(() => Promise.resolve()) })),
    select: vi.fn(() => ({ from: vi.fn(() => ({ where: vi.fn() })) })),
  },
  mockSchema: {
    autopilotRuns: { runId: "runId", startedAt: "startedAt" },
    autopilotFindings: { runId: "runId", severity: "severity" },
  },
}));

vi.mock("@/src/db", () => ({
  db: mockDb,
  eq: vi.fn(),
  desc: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("@/src/db/schema", () => mockSchema);
```

**Benefits:**
- Prevents temporal dead zone
- Explicit about all exports
- Easy to extend when schema grows
- Type-safe (can add `as const` assertions)

---

## Pattern 3: pnpm Override Pattern

### Current Implementation

From root `package.json:124-137`:

```json
{
  "pnpm": {
    "overrides": {
      "systeminformation": ">=5.31.0",
      "cookie": ">=0.7.0",
      "minimatch": ">=10.2.3",
      "rollup@<4.59.0": ">=4.59.0",
      "serialize-javascript@<7.0.3": ">=7.0.3",
      "esbuild@<0.25.0": ">=0.25.0",
      "hono": "4.12.4",
      "@hono/node-server": "1.19.10",
      "express-rate-limit": "8.2.2",
      "dompurify": "3.3.2"
    }
  }
}
```

**Proposed addition** (from plan):
```json
{
  "pnpm": {
    "overrides": {
      "pg": "^8.20.0"  // Force single version across workspace
    }
  }
}
```

### Best Practice Analysis

**✅ Industry Best Practices:**
1. **Security Patching** — Override vulnerable versions (e.g., `cookie >= 0.7.0`)
2. **Workspace Consistency** — Force single version for critical dependencies
3. **CVE Remediation** — Address security audit findings without upgrading entire dependency tree
4. **Build Reproducibility** — Pin exact versions for platform-critical packages (`hono`, `@hono/node-server`)

**Comparison to Industry:**
- **npm:** `overrides` field (npm 8.3+)
- **yarn:** `resolutions` field (Yarn 1.x+)
- **pnpm:** `overrides` (pnpm 5.x+)

**When to use:**
- Transitive dependency has known CVE
- Workspace packages require same version of shared dependency (e.g., `pg`)
- Forcing newer version of build tool (e.g., `esbuild >= 0.25.0`)

### Root Cause: pg Version Mismatch

**Problem:**
```
packages/db/package.json → pg@8.18.0
root package.json → pg@8.20.0
```

**Result:** Drizzle creates two incompatible SQL builder instances:
```typescript
// In packages/db (uses pg@8.18.0)
const db1 = drizzle(pool);

// In root (uses pg@8.20.0)
const db2 = drizzle(pool);

// TypeScript error:
// Types have separate declarations of a private property 'shouldInlineParams'
```

**Why this happens:**
- Drizzle stores reference to `pg` version in internal state
- TypeScript detects structural mismatch in private properties
- Two different `pg` versions = two incompatible Drizzle instances

### Recommended Solution

```json
{
  "pnpm": {
    "overrides": {
      "pg": "^8.20.0"  // ✅ Force latest stable version
    }
  }
}
```

**Why `^8.20.0` instead of exact `8.20.0`:**
- Allows patch updates (`8.20.1`, `8.20.2`)
- Prevents security patch delays
- Semver caret range is pnpm override best practice

**Alternative (not recommended):**
- Update `packages/db/package.json` to `pg@^8.20.0` → Requires manual sync
- Use `pnpm dedupe` → Doesn't guarantee single version if ranges conflict

**Verification:**
```bash
pnpm install --force  # Regenerate lockfile
pnpm list pg          # Should show single version (8.20.0)
pnpm build            # Verify TypeScript compilation
```

---

## Pattern 4: Naming Conventions (Discovered)

### Analysis of Exported Functions

**Duplicates found:**
- `listJobs` — 2 occurrences (likely different modules)
- `hybridSearch` — 2 occurrences
- `getJobById` — 2 occurrences

**Investigation needed:** Verify if these are:
1. **Intentional exports** from different services (e.g., `jobs/list.ts` vs `jobs/index.ts`)
2. **Duplication** requiring consolidation

### Naming Convention Patterns

**Observed patterns:**
- CRUD operations: `create*`, `update*`, `delete*`, `get*By*`, `list*`
- Data transformations: `build*`, `derive*`, `normalize*`, `compute*`, `parse*`
- Validation: `validate*`, `can*`, `is*`
- Predicates: `did*Change`, `should*`

**✅ Good practices:**
- Consistent verb prefixes
- Domain-specific terminology (`Koppel`, `Scraper`, `Autopilot`)
- Clear action vs query separation

**❌ Potential issues:**
- `getHistory` vs `listInterviews` — Inconsistent list/get naming
- `reducePlatformOnboardingRun` — Redux-style naming in non-Redux codebase

---

## Pattern 5: Code Duplication (From Backlog)

### High-Value Refactorings

From `docs/refactor-optimize-backlog.md`:

1. **List Page Pattern** (33 lines duplicated across 3 files)
   ```
   app/interviews/loading.tsx
   app/messages/loading.tsx
   app/pipeline/loading.tsx
   ```
   **Recommendation:** Create `components/shared/list-page-skeleton.tsx` (already exists per git status)

2. **Status Badge Component** (27 lines duplicated)
   ```
   app/autopilot/page.tsx
   app/autopilot/[runId]/page.tsx
   ```
   **Recommendation:** Extract to `app/autopilot/shared.tsx` (already exists per git status)

3. **getMessageText Helper** (duplicated in 2 files)
   ```
   app/api/chat/route.ts
   src/services/chat-sessions.ts
   ```
   **Recommendation:** Move to `src/lib/chat-message-utils.ts` (already exists per git status)

4. **Koppel Pairs Resolution** (16 lines duplicated)
   ```
   app/api/kandidaten/[id]/koppel/route.ts
   app/api/vacatures/[id]/koppel/route.ts
   ```
   **Recommendation:** Extract to `src/services/koppel-pairs.ts` (already exists per git status)

**Status:** Plan appears to have been partially implemented (files exist in git status as untracked).

---

## Pattern 6: God Objects (Complexity Analysis)

### Largest Source Files

From `wc -l` analysis:

1. **src/cli/commands.ts** — 723 lines
   - **Pattern:** Command dispatcher (barrel file pattern)
   - **Verdict:** ❌ Anti-pattern (God object)
   - **Recommendation:** Split into `src/cli/commands/kandidaten.ts`, `src/cli/commands/vacatures.ts`, etc.

2. **src/mcp/tools/pipeline.ts** — 295 lines
   - **Pattern:** MCP tool definitions
   - **Verdict:** ⚠️ Acceptable (domain-specific grouping)
   - **Recommendation:** Monitor; split if exceeds 400 lines

3. **app/api/chat/route.ts** — High complexity (54) per backlog
   - **Pattern:** API route with streaming + tool calls
   - **Verdict:** ❌ Anti-pattern (many returns, high cognitive complexity)
   - **Recommendation:** Extract validation, rate limiting, streaming into helpers

### Complexity Metrics (from backlog)

| File | Complexity | Returns | Action |
|------|-----------|---------|--------|
| app/api/chat/route.ts | 54 | 9 | 🔴 Split immediately |
| app/messages/page.tsx | 52 | - | 🔴 Extract filters + list rendering |
| app/interviews/page.tsx | 25 | - | 🟡 Extract subcomponents |
| app/opdrachten/[id]/job-detail-fields.tsx | 25 | - | 🟡 Extract sections |

**Thresholds:**
- Complexity > 20 → Extract helpers
- Complexity > 40 → Refactor required
- Returns > 5 → Consolidate error handling

---

## Pattern 7: Architectural Boundaries

### Observed Layers

```
app/             → UI layer (Next.js routes, pages)
src/services/    → Business logic
src/db/          → Data access (re-exports @motian/db)
packages/db/     → ORM + schema definitions
```

**✅ Good practices:**
- Clear separation of concerns
- Services don't import from `app/`
- UI imports services (one-way dependency)

**⚠️ Potential violations:**
- `app/autopilot/data.ts` → Server component data fetching (acceptable Next.js pattern)
- `app/overzicht/data.ts` → Similar pattern

**Recommendation:** Document that `app/**/data.ts` files are server-side data loaders (Next.js convention).

---

## Anti-Pattern Summary

### Critical (Blocking Production)

1. **pg Version Mismatch** → Drizzle type errors
   - **Fix:** Add `"pg": "^8.20.0"` to pnpm overrides
   - **Priority:** P0

2. **Incomplete Test Mocks** → CI failures
   - **Fix:** Add schema exports to 5 test files
   - **Priority:** P0

### High (Technical Debt)

3. **God Object: commands.ts** → 723 lines, hard to maintain
   - **Fix:** Split into command modules
   - **Priority:** P1

4. **High Complexity Routes** → chat/route.ts (complexity 54)
   - **Fix:** Extract helpers
   - **Priority:** P1

### Medium (Code Smell)

5. **Code Duplication** → List skeletons, status badges
   - **Fix:** Extract shared components (partially done)
   - **Priority:** P2

6. **Inconsistent Naming** → `getHistory` vs `listInterviews`
   - **Fix:** Standardize on `list*` for collections
   - **Priority:** P2

### Low (Cosmetic)

7. **Documentation Outdated** → Old import patterns in docs
   - **Fix:** Update examples
   - **Priority:** P3

---

## Recommendations

### Immediate Actions (Phase 1 of Plan)

1. ✅ **Add pg override** to root package.json
2. ✅ **Fix test mocks** in 5 failing tests
3. ✅ **Run `pnpm install --force`** to regenerate lockfile
4. ✅ **Verify build passes**

### Short-Term Improvements (Phase 2)

5. **Run Qlty smells** and document findings
6. **Add Sentry auth token** for sourcemap upload
7. **Extract shared test utilities** for common mock patterns
8. **Update documentation** with correct import examples

### Long-Term Refactorings (Backlog)

9. **Split commands.ts** into command modules (reduce from 723 → <200 lines each)
10. **Reduce chat/route.ts complexity** (from 54 → <20)
11. **Standardize naming conventions** (create style guide)
12. **Implement shared list page pattern** (complete partial work)

---

## Pattern Maturity Assessment

| Pattern | Industry Alignment | Maturity | Risk |
|---------|-------------------|----------|------|
| Drizzle Import | ✅ Best Practice | High | Low |
| Test Mocks (vi.hoisted) | ✅ Best Practice | Medium | Low |
| pnpm Overrides | ✅ Best Practice | High | Low |
| Naming Conventions | ⚠️ Mostly Good | Medium | Low |
| Code Duplication | ❌ Needs Work | Low | Medium |
| God Objects | ❌ Anti-pattern | Low | High |

**Overall Verdict:** The core patterns (Drizzle imports, test mocking, dependency management) are **industry best practices**. The plan correctly identifies and fixes the critical issues. The main technical debt is in **code organization** (God objects, duplication) rather than pattern misuse.

---

## Success Criteria for Plan

### Phase 1: Critical Fixes
- [x] Plan identifies root cause (pg version mismatch)
- [x] Proposed solution (pnpm override) follows best practices
- [x] Test mock pattern matches industry standards
- [x] Verification steps are appropriate

### Phase 2: Quality & Observability
- [x] Qlty analysis included
- [x] Sentry configuration follows Next.js conventions
- [ ] Missing: Pattern documentation for future contributors

### Phase 3: Documentation
- [x] Identifies outdated paths
- [ ] Missing: Update import examples in documentation

---

## Appendix: Similar Patterns in Industry

### Drizzle Import Pattern
- **Prisma:** `import { prisma } from '@/lib/prisma'`
- **Supabase:** `import { supabase } from '@/lib/supabase'`
- **MikroORM:** `import { em } from '@/lib/orm'`

### Test Mock Pattern
- **Vitest docs:** [Hoisted mocks](https://vitest.dev/guide/mocking.html#hoisting)
- **Jest docs:** [Manual mocks](https://jestjs.io/docs/manual-mocks)
- **React Testing Library:** [Mocking modules](https://kentcdodds.com/blog/how-to-test-custom-react-hooks)

### Dependency Override Pattern
- **pnpm:** [Overrides](https://pnpm.io/package_json#pnpmoverrides)
- **npm:** [Overrides](https://docs.npmjs.com/cli/v8/configuring-npm/package-json#overrides)
- **yarn:** [Resolutions](https://classic.yarnpkg.com/en/docs/selective-version-resolutions/)

---

**End of Analysis**
