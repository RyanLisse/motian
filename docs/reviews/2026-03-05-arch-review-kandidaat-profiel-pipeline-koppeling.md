# Architectural Review: Kandidaat Profiel + Pipeline Koppeling Plan

**Date:** 2026-03-05
**Reviewer:** System Architecture Expert
**Plan Reference:** `docs/plans/2026-03-05-feat-kandidaat-profiel-pipeline-koppeling-plan.md`

---

## Executive Summary

The plan is well-structured and follows established patterns in the Motian codebase. The proposed architecture properly separates concerns across API, service, and component layers. **No blocking issues identified**, but several refinements are recommended for consistency, error handling, and future maintainability.

**Overall Grade: B+ (Good foundation, refinement needed)**

---

## 1. API Route Naming Consistency

### Status: GOOD with minor corrections

**Observation:**
The plan proposes three new endpoints:
- `/api/kandidaten/[id]/match` ✅ (Dutch, follows pattern)
- `/api/opdrachten/[id]/match-kandidaten` ✅ (Dutch, clear intent)
- `/api/kandidaten/[id]/koppel` ✅ (Dutch, semantically correct)

**Findings:**
1. All paths use **Dutch naming**, consistent with `/api/kandidaten`, `/api/opdrachten`, `/api/sollicitaties`
2. Nested resource pattern `[id]/action` matches existing convention (e.g., `/api/kandidaten/[id]/notities`)
3. Verb style differs: `/match` (noun) vs `/match-kandidaten` (noun-based compound)

### Recommendations

1. **Standardize verb naming** - Choose either kebab-case action naming or gerund-based:
   - Current mix: `/match` + `/match-kandidaten`
   - Proposed alignment: `/api/kandidaten/[id]/matches` (noun, collection) OR `/api/kandidaten/[id]/auto-match` (verb-like action)
   - **Preferred**: Keep `/api/kandidaten/[id]/match` and rename `/api/opdrachten/[id]/match-kandidaten` → `/api/opdrachten/[id]/candidates-match` (consistency)

2. **Koppel endpoint path** - Consider more explicit naming:
   - Current: `/api/kandidaten/[id]/koppel` (generic Dutch verb "link")
   - Alternative: `/api/kandidaten/[id]/link-vacancies` or `/api/kandidaten/[id]/applications/batch` (more semantic)
   - **Verdict**: Current name is acceptable but `koppel` should be documented as "create batch applications from matches"

---

## 2. Component Architecture & Wizard Design

### Status: EXCELLENT - Good separation of concerns

**Assessment:**

The proposed component structure properly decomposes the wizard:
```
AddCandidateWizard (main orchestrator)
├── WizardStepProfile (form capture)
├── WizardStepLinking (match selection + application creation)
│   ├── MatchSuggestionCard (reusable match display)
│   └── SkillsInput, ExperienceInput (sub-components)
```

**Strengths:**
1. **Clear state machine** - Step tracking via `useState<"profile" | "linking" | "done">`
2. **Unidirectional flow** - Profile → Linking → Done (no backward navigation)
3. **Separated concerns** - Each step is its own component with clear props/callbacks
4. **Reusability** - `MatchSuggestionCard` can be reused in `LinkCandidatesDialog`

### Recommendations

1. **Wizard Container Component** - Extract shared wizard UX:
   ```typescript
   // NEW: components/candidate-wizard/wizard-container.tsx
   type WizardStep = "profile" | "linking" | "done";
   export function WizardContainer({ currentStep, onStepChange, children }) {
     // Shared: header/footer, progress indicator, error boundary
   }
   ```
   - Reduces duplication between candidate and vacancy wizards
   - Centralizes modal lifecycle and loading states

2. **Step Props Type Safety** - Define explicit step props interfaces:
   ```typescript
   // components/candidate-wizard/types.ts
   export interface WizardStepProfileProps {
     onSuccess: (candidateId: string) => void;
     onError: (error: Error) => void;
   }
   export interface WizardStepLinkingProps {
     candidateId: string;
     onComplete: (applicationIds: string[]) => void;
     onSkip: () => void;
   }
   ```

3. **Error Boundary** - Add error boundary within wizard:
   ```typescript
   <ErrorBoundary fallback={<WizardError onRetry={...} />}>
     {renderStep()}
   </ErrorBoundary>
   ```
   - Step-level failures don't crash entire wizard
   - Candidate data persists (Step 1 survives Step 2 error)

---

## 3. Service Layer Design & Separation of Concerns

### Status: GOOD with critical gaps

**Current Assessment:**

The plan correctly identifies three key service modifications:

1. **`createApplication()`** - Add optional `stage` parameter ✅
2. **`createApplicationsFromMatches()`** - New function for idempotent bulk creation ✅
3. **`listActiveJobs()`** - Filter expired deadlines ✅

**Strengths:**
1. Idempotency pattern is sound (check existing applications before creating)
2. Service layer remains thin and focused
3. Links applications to matches for traceability

### Critical Issues

#### 1. Missing Transaction Boundary ⚠️ HIGH PRIORITY

**Problem:** Race condition possible between check and insert
```typescript
// UNSAFE: Race condition possible
export async function createApplicationsFromMatches(...) {
  for (const match of matches) {
    const existing = await checkExisting(jobId, candidateId); // Check
    await createApplication(...); // Create (race!)
  }
}
```

**Fix**: Use database transaction with constraint handling
```typescript
export async function createApplicationsFromMatches(
  candidateId: string,
  matches: AutoMatchResult[],
  stage: "screening" | "new" = "screening"
): Promise<{ created: Application[]; alreadyLinked: string[] }> {
  const VALID_STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"];
  if (!VALID_STAGES.includes(stage)) {
    throw new Error(`Invalid stage: ${stage}`);
  }

  const candidate = await getCandidateById(candidateId);
  if (!candidate) {
    throw new Error(`Candidate ${candidateId} not found`);
  }

  const created: Application[] = [];
  const alreadyLinked: string[] = [];

  // Use transaction for atomicity
  await db.transaction(async (tx) => {
    for (const match of matches) {
      try {
        const result = await tx
          .insert(applications)
          .values({
            jobId: match.jobId,
            candidateId,
            matchId: match.matchId,
            stage,
            source: "match",
            notes: null,
          })
          .returning();
        if (result.length > 0) created.push(result[0]);
      } catch (err: any) {
        // Handle unique constraint (already linked)
        if (err.code === "23505") {
          alreadyLinked.push(match.jobId);
        } else throw err;
      }
    }
  });

  return { created, alreadyLinked };
}
```

#### 2. Idempotency Key Missing ⚠️ MEDIUM PRIORITY

**Problem:** If user clicks "Confirm" twice in Step 2, duplicate applications could be created
- First click creates applications
- Second click retries and creates duplicates (even with constraint, poor UX)

**Fix**: API layer should deduplicate via idempotency key (Section 4)

#### 3. Embedding Completion Not Verified ⚠️ MEDIUM PRIORITY

**Problem:** `createCandidate()` fires embedding asynchronously (fire-and-forget). Step 2 fetches matches but embedding may not be complete.

**Fix**: Add embedding completion check in Step 2 API:
```typescript
// In /api/kandidaten/[id]/match
const candidate = await getCandidateById(candidateId);
if (!candidate.embedding) {
  // Wait for embedding with timeout
  const maxWaitMs = 10_000;
  const startTime = Date.now();
  while (!candidate.embedding && Date.now() - startTime < maxWaitMs) {
    await new Promise(r => setTimeout(r, 500));
    candidate = await getCandidateById(candidateId);
  }
  if (!candidate.embedding) {
    console.warn("Embedding still pending, using rule-based matching");
  }
}
```

---

## 4. Error Handling Strategy

### Status: NEEDS IMPROVEMENT - Plan lacks specificity

**Current Assessment:**

Plan mentions (line 277) but lacks detail:
- "Unique constraint violations → show 'Al gekoppeld' gracefully"
- "Matching timeout (>15s) → show degraded results"
- "Network errors → toast with retry option"

### Missing Implementation Details

#### 1. HTTP Status Code Strategy ⚠️ HIGH PRIORITY

**Problem:** No defined status codes for different scenarios
- What status for "already linked"? 409 Conflict? 400? Custom?

**Recommended Strategy:**
```
201 Created       → New applications created
409 Conflict      → Some/all already linked (return which ones)
400 Bad Request   → Invalid input
422 Unprocessable → Invalid candidate/job state (e.g., both deleted)
500 Server Error  → Unexpected error
202 Accepted      → Async processing (timeout case)
```

#### 2. Zod Schema Missing ⚠️ HIGH PRIORITY

**Problem:** Plan creates `/api/kandidaten/[id]/koppel` but doesn't specify Zod schema

**Add to plan:**
```typescript
// src/schemas/koppeling.ts
export const createApplicationsSchema = z.object({
  matchIds: z.array(z.string().uuid()).optional(),
  jobIds: z.array(z.string().uuid()).optional(),
  stage: z.enum(["new", "screening"]).default("screening"),
}).refine(
  (data) => data.matchIds?.length || data.jobIds?.length,
  { message: "Either matchIds or jobIds required" }
);
```

#### 3. Constraint Violation Handling ⚠️ HIGH PRIORITY

**Example API response:**
```typescript
const result = await createApplicationsFromMatches(candidateId, matches, "screening");
if (result.alreadyLinked.length > 0) {
  return Response.json(
    {
      created: result.created,
      alreadyLinked: result.alreadyLinked,
      message: `${result.created.length} applications created, ${result.alreadyLinked.length} already linked`
    },
    { status: result.created.length > 0 ? 201 : 409 }
  );
}
```

#### 4. Timeout Handling ⚠️ MEDIUM PRIORITY

**Problem:** "Show degraded results with rule-based scores (15s timeout)" is vague
- Does timeout apply to Step 2 API call only?
- What happens at 15s? Return partial results or error?

**Recommendation:**
```typescript
// /api/kandidaten/[id]/match
const controller = new AbortController();
const timeout = setTimeout(() => controller.abort(), 15_000);
try {
  const matches = await autoMatchCandidateToJobs(candidateId);
  return Response.json({ matches, complete: true });
} catch (err) {
  if (err.name === "AbortError") {
    // Timeout - return best effort results
    const fallbackMatches = await getRuleBasedMatches(candidateId);
    return Response.json(
      {
        matches: fallbackMatches,
        complete: false,
        message: "Gedeeltelijke resultaten weergegeven (timeout)"
      },
      { status: 202 } // 202 Accepted
    );
  }
  throw err;
} finally {
  clearTimeout(timeout);
}
```

---

## 5. State Management Approach

### Status: GOOD - follows Next.js patterns

**Assessment:**

Plan correctly uses:
- React hooks (`useState`) for step tracking ✅
- Next.js `revalidatePath()` for cache invalidation ✅
- Event publishing (`publish("application:created", ...)`) for side effects ✅
- `useRouter().push()` and `router.refresh()` for navigation ✅

**Strengths:**
1. No external state management (Redux, Zustand) needed
2. Form state isolated to components
3. Cache invalidation explicit and comprehensive

### Recommendations

#### 1. Form State Persistence (LOW PRIORITY)

**Problem:** If user closes Step 1 without proceeding, profile data is lost (slow networks suffer)

**Consider:** sessionStorage for draft recovery
```typescript
// components/candidate-wizard/wizard-step-profile.tsx
useEffect(() => {
  sessionStorage.setItem("candidateDraft", JSON.stringify(formData));
}, [formData]);

useEffect(() => {
  const draft = sessionStorage.getItem("candidateDraft");
  if (draft) setFormData(JSON.parse(draft));
}, []);
```

#### 2. Loading State Hierarchy (MEDIUM PRIORITY)

**Problem:** Plan mentions loading overlay but doesn't specify granular states

**Recommendation:**
```typescript
const [loadingStep, setLoadingStep] = useState<
  "upload" | "candidate" | "embedding" | "matching" | null
>(null);

const messages = {
  upload: "CV wordt geüpload...",
  candidate: "Kandidaat wordt aangemaakt...",
  embedding: "Profiel wordt geanalyseerd...",
  matching: "Passende vacatures worden gezocht...",
};
```

#### 3. Match Score Caching (MEDIUM PRIORITY)

**Problem:** If Step 2 API call fails and retries, matching is re-run (expensive)

**Recommendation:**
```typescript
const [cachedMatches, setCachedMatches] = useState<AutoMatchResult[] | null>(null);

const fetchMatches = async () => {
  if (cachedMatches) return cachedMatches; // Reuse on retry
  const response = await fetch(...);
  setCachedMatches(response.matches);
  return response.matches;
};
```

---

## 6. Revalidation Strategy

### Status: GOOD but incomplete

**Current Plan (lines 265-270):**
```typescript
revalidatePath("/professionals")
revalidatePath("/pipeline")
revalidatePath("/overzicht")
revalidatePath("/opdrachten")
revalidatePath(`/professionals/${candidateId}`)
```

**Assessment:**

✅ **Correct paths** - All relevant views are invalidated
⚠️ **Incomplete** - Missing some related pages

### Recommended Additions

After creating applications from matches:
```typescript
// /api/kandidaten/[id]/koppel
revalidatePath("/professionals");              // Candidate list
revalidatePath(`/professionals/${candidateId}`); // Candidate detail
revalidatePath("/pipeline");                    // Pipeline/applications view
revalidatePath("/overzicht");                   // Dashboard
revalidatePath("/matching");                    // Matching page (if shows app status)
```

After vacancy-side linking:
```typescript
// /api/opdrachten/[id]/match-kandidaten
revalidatePath(`/opdrachten/${jobId}`);        // Job detail
revalidatePath("/pipeline");
revalidatePath("/overzicht");
```

---

## 7. Architectural Principles Compliance

### SOLID Principles Check

| Principle | Status | Evidence |
|-----------|--------|----------|
| **Single Responsibility** | ✅ | Each service has one job (create, match, link) |
| **Open/Closed** | ✅ | New endpoints don't modify existing ones |
| **Liskov Substitution** | N/A | No inheritance hierarchy |
| **Interface Segregation** | ✅ | API schemas are focused (Zod validation) |
| **Dependency Inversion** | ✅ | Services depend on `db`, not concrete repos |

### Architectural Layers

```
UI Layer:          AddCandidateWizard, LinkCandidatesDialog
API Layer:         Route handlers with Zod validation
Service Layer:     createApplicationsFromMatches(), autoMatchCandidateToJobs()
Data Layer:        Drizzle ORM, PostgreSQL
```

**✅ Proper separation maintained** - No layer crossing

### Dependency Graph

**✅ No circular dependencies** - All deps flow downward (UI → API → Service → DB)

---

## 8. Risk Analysis

### Critical Risks

| Risk | Severity | Mitigation |
|------|----------|-----------|
| **Race condition on application creation** | HIGH | Use database transaction + constraint handling |
| **Duplicate API calls from UI retry** | MEDIUM | Implement idempotency key in API layer |
| **Embedding timeout leaves Step 2 stale** | MEDIUM | Verify embedding completes before Step 2 fetch |
| **Constraint violation error handling** | MEDIUM | Explicit catch + user-friendly message |

### Missing Implementation Details

1. **Zod schema for `/api/kandidaten/[id]/koppel`** ← Add to plan
2. **Transaction handling in `createApplicationsFromMatches()`** ← Add to plan
3. **Idempotency key strategy** ← Add to plan
4. **Embedding completion verification** ← Add to plan
5. **HTTP status codes for each scenario** ← Add to plan
6. **Rate limiting for match endpoints** ← Consider adding

---

## Summary of Recommendations

### High Priority (Implement)

1. **Add transaction handling to `createApplicationsFromMatches()`** to prevent race conditions
2. **Define Zod schemas for all three API endpoints** (in new `src/schemas/koppeling.ts`)
3. **Add HTTP status code strategy** (201, 409, 400, 422, 202)
4. **Verify embedding completion** before Step 2 fetches matches
5. **Idempotency key for `/api/kandidaten/[id]/koppel`** to prevent duplicate applications on retry

### Medium Priority (Improve)

6. **Standardize API verb naming** (recommend consistency with existing patterns)
7. **Extract WizardContainer component** to reduce duplication
8. **Add step props type definitions** in `components/candidate-wizard/types.ts`
9. **Explicit timeout handling for Step 2 matching** (15s → partial results with 202 status)
10. **Add error boundary** to wizard steps

### Low Priority (Polish)

11. Draft recovery via `sessionStorage` for Step 1
12. Granular loading state messages (upload, candidate, embedding, matching)
13. Match score caching to avoid re-matching on API retry
14. Additional revalidation paths for `/matching` page

---

## Conclusion

The plan demonstrates solid architectural thinking with proper layer separation and reusability. With the recommended refinements for robustness, error handling, and consistency, this feature will be production-ready and maintainable.

**Key Success Factors:**
1. Implement transaction-safe application creation
2. Add comprehensive error handling with proper HTTP semantics
3. Verify embedding completion before matching
4. Define clear API contracts with Zod schemas
5. Implement idempotency at API layer

---

**Status:** Ready for implementation with high-priority recommendations applied
