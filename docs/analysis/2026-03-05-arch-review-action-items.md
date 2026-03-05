# Architecture Review - Action Items

**Plan:** `docs/plans/2026-03-05-feat-kandidaat-profiel-pipeline-koppeling-plan.md`
**Review:** `docs/reviews/2026-03-05-arch-review-kandidaat-profiel-pipeline-koppeling.md`
**Date:** 2026-03-05

---

## Quick Summary

The 2-step candidate creation wizard plan is architecturally sound with good layer separation. **No blocking issues**, but 5 high-priority refinements are needed before implementation to ensure robustness and consistency.

**Grade:** B+ → A- (with refinements)

---

## Must-Fix Before Implementation (Phase 0)

### 1. Transaction Safety in `createApplicationsFromMatches()`

**Status:** Critical - Race condition vulnerability
**File:** `src/services/applications.ts`
**Action:**
- [ ] Add transaction wrapper using `db.transaction()`
- [ ] Catch unique constraint violations (`err.code === "23505"`)
- [ ] Return `{ created: Application[], alreadyLinked: string[] }`
- [ ] Add stage validation before transaction

**Code reference:**
```typescript
// See: docs/reviews/2026-03-05-arch-review-kandidaat-profiel-pipeline-koppeling.md
// Section 3: Service Layer Design (Critical Issues > Missing Transaction)
```

---

### 2. Create Zod Schema for Koppel Endpoint

**Status:** Critical - No validation defined
**File:** `src/schemas/koppeling.ts` (CREATE NEW)
**Action:**
- [ ] Create `src/schemas/koppeling.ts`
- [ ] Export `createApplicationsSchema` (union of matchIds or jobIds)
- [ ] Add refinement to require at least one array
- [ ] Add stage enum validation

**Code reference:**
```typescript
// See: docs/reviews/2026-03-05-arch-review-kandidaat-profiel-pipeline-koppeling.md
// Section 4: Error Handling (Missing Validation Layer)
```

---

### 3. Define HTTP Status Code Strategy

**Status:** High - No status code semantics
**Files:** All three API endpoints
**Action:**
- [ ] 201 Created → New applications created
- [ ] 409 Conflict → Some/all already linked (return which ones)
- [ ] 400 Bad Request → Invalid input
- [ ] 422 Unprocessable → Invalid candidate/job state
- [ ] 202 Accepted → Async timeout (degraded results)

**Where to apply:**
- `/api/kandidaten/[id]/match` → 200 or 202
- `/api/kandidaten/[id]/koppel` → 201 or 409
- `/api/opdrachten/[id]/match-kandidaten` → 200

---

### 4. Verify Embedding Completion Before Matching

**Status:** Medium - Silent failure risk
**File:** `/api/kandidaten/[id]/match/route.ts`
**Action:**
- [ ] Before calling `autoMatchCandidateToJobs()`
- [ ] Check if `candidate.embedding` exists or if embedding is recent
- [ ] Wait up to 10s for embedding to complete
- [ ] If timeout, log warning and use rule-based fallback
- [ ] Return `{ complete: boolean }` flag to frontend

**Rationale:** Candidate embedding happens async; Step 2 may call match API before it's done

---

### 5. Add Idempotency Key to Koppel Endpoint

**Status:** Medium - Duplicate application risk on retry
**File:** `/api/kandidaten/[id]/koppel/route.ts`
**Action:**
- [ ] Accept optional `idempotencyKey` in request body
- [ ] Generate `uuid()` if not provided
- [ ] Store in application notes or separate column (if schema allows)
- [ ] Return 409 if same key already processed

**Why:** User clicks "Confirm" twice → duplicate API calls → potential duplicate applications

---

## Should-Do Before Implementation (Phase 0.5)

### 6. Extract WizardContainer Component

**Status:** Medium - Code reuse opportunity
**File:** `components/candidate-wizard/wizard-container.tsx` (CREATE NEW)
**Action:**
- [ ] Create shared wizard wrapper component
- [ ] Include progress indicator
- [ ] Include error boundary
- [ ] Include loading overlay lifecycle
- [ ] Reduce duplication between AddCandidateWizard and LinkCandidatesDialog

---

### 7. Add Step Props Type Definitions

**Status:** Low-Medium - Type safety improvement
**File:** `components/candidate-wizard/types.ts` (CREATE NEW)
**Action:**
- [ ] Define `WizardStepProfileProps` interface
- [ ] Define `WizardStepLinkingProps` interface
- [ ] Define `MatchSuggestionCardProps` interface
- [ ] Export from barrel (if using)

**Benefit:** Enforces contracts between steps, better IDE support

---

### 8. Standardize API Naming (Discuss First)

**Status:** Low - Consistency improvement
**Options:**
- Option A: Keep `/api/opdrachten/[id]/match-kandidaten` (current)
- Option B: Rename to `/api/opdrachten/[id]/candidates-match` (consistency)

**Recommendation:** Keep Option A (less disruptive) or rename both to `/matches` (noun-based)

---

## Implementation Checklist

### Phase 1: Service Layer (with refinements)

- [ ] **1a.** Add transaction handling to `createApplicationsFromMatches()`
- [ ] **1b.** Create `src/schemas/koppeling.ts` with validation
- [ ] **1c.** Modify `createApplication()` to accept optional `stage` parameter
- [ ] **1d.** Add `listActiveJobs()` deadline filter (plan line 145-149)
- [ ] **1e.** Add embedding verification to match API

### Phase 2: API Routes (with error handling)

- [ ] **2a.** Create `/api/kandidaten/[id]/match/route.ts`
  - Include embedding verification
  - Include HTTP 202 timeout handling
  - Include rate limiting
- [ ] **2b.** Create `/api/kandidaten/[id]/koppel/route.ts`
  - Include idempotency key logic
  - Include Zod validation
  - Include proper HTTP status codes
- [ ] **2c.** Create `/api/opdrachten/[id]/match-kandidaten/route.ts`
  - Mirror matching logic
  - Include rate limiting

### Phase 3: Components (with extracted container)

- [ ] **3a.** Create `components/candidate-wizard/wizard-container.tsx`
- [ ] **3b.** Create `components/candidate-wizard/types.ts`
- [ ] **3c.** Create `components/add-candidate-wizard.tsx` (refactored)
- [ ] **3d.** Create `components/candidate-wizard/wizard-step-profile.tsx`
- [ ] **3e.** Create `components/candidate-wizard/wizard-step-linking.tsx`
- [ ] **3f.** Create sub-components (SkillsInput, ExperienceInput, etc.)
- [ ] **3g.** Create `components/link-candidates-dialog.tsx`

### Phase 4: Integration & Polish

- [ ] **4a.** Add comprehensive revalidation paths
- [ ] **4b.** Add event publishing (`publish("application:created", ...)`)
- [ ] **4c.** Add error boundaries
- [ ] **4d.** Test with TypeScript (`pnpm exec tsc --noEmit`)
- [ ] **4e.** Test with Biome (`pnpm lint`)
- [ ] **4f.** Run test suite (`pnpm test`)

---

## Key Files to Create/Modify

### NEW FILES

1. `src/schemas/koppeling.ts` — Zod schemas
2. `/api/kandidaten/[id]/match/route.ts` — Match suggestions
3. `/api/kandidaten/[id]/koppel/route.ts` — Batch application creation
4. `/api/opdrachten/[id]/match-kandidaten/route.ts` — Vacancy-side matching
5. `components/candidate-wizard/wizard-container.tsx` — Shared wizard wrapper
6. `components/candidate-wizard/types.ts` — TypeScript interfaces
7. `components/add-candidate-wizard.tsx` — Refactored wizard (from dialog)
8. `components/candidate-wizard/wizard-step-profile.tsx` — Step 1
9. `components/candidate-wizard/wizard-step-linking.tsx` — Step 2
10. `components/candidate-wizard/skills-input.tsx` — Reusable component
11. `components/candidate-wizard/experience-input.tsx` — Reusable component
12. `components/candidate-wizard/match-suggestion-card.tsx` — Reusable component
13. `components/link-candidates-dialog.tsx` — Vacancy-side UI

### MODIFIED FILES

1. `src/services/applications.ts` — Add stage param, new function
2. `src/services/jobs.ts` — Filter expired deadlines
3. `components/add-candidate-dialog.tsx` — Replace with new wizard
4. `app/professionals/page.tsx` — Swap dialog import
5. `app/opdrachten/[id]/page.tsx` — Add LinkCandidatesDialog button

---

## Testing Strategy

### Unit Tests

- [ ] `createApplicationsFromMatches()` handles constraints
- [ ] Transaction rollback on error
- [ ] Zod schema validation (valid/invalid inputs)
- [ ] Stage parameter defaults

### Integration Tests

- [ ] E2E: Create candidate → Fetch matches → Confirm linking
- [ ] E2E: Vacancy side → Fetch candidate matches → Confirm
- [ ] Constraint violation → graceful "Al gekoppeld" message
- [ ] Embedding timeout → degraded results shown

### Manual Testing

- [ ] [ ] Step 1 → Step 2 flow works
- [ ] [ ] CSV upload in Step 1 works
- [ ] [ ] Already-linked vacancies show badge (disabled)
- [ ] [ ] Skip option saves candidate without linking
- [ ] [ ] Mobile responsive on small screens
- [ ] [ ] Keyboard accessible (Tab, Enter, Escape)

---

## Rollback Plan

If issues discovered during implementation:

1. **Service layer issue** → Revert schema/service changes only, no data loss
2. **API route issue** → Revert routes, components unaffected
3. **Component issue** → Revert component changes, old dialog still available

Keep old `AddCandidateDialog` as fallback until Phase 3 complete and tested.

---

## Dependencies

### Already Available ✅

- `autoMatchCandidateToJobs()` — exists, works
- `createApplication()` — exists, needs stage param only
- `embedCandidate()` — exists, async
- shadcn components (Dialog, Button, etc.)
- Zod validation library

### No New Packages Needed

All dependencies already in `package.json`

---

## Success Criteria

After implementation:

- [ ] All 5 high-priority refinements applied
- [ ] Zod schemas validate all inputs
- [ ] Transactions prevent race conditions
- [ ] Proper HTTP status codes returned
- [ ] Embedding completion verified
- [ ] TypeScript clean: `pnpm exec tsc --noEmit`
- [ ] Biome clean: `pnpm lint`
- [ ] All tests pass: `pnpm test`
- [ ] Component tree: AddCandidateWizard → Step1 + Step2 + shared
- [ ] Bidirectional linking: Candidate and Vacancy sides work identically
- [ ] Dutch UI labels throughout
- [ ] Revalidation paths complete

---

## Timeline Estimate

| Phase | Task | Estimate | Dependencies |
|-------|------|----------|--------------|
| 0 | Refinements (schema, transaction, status codes) | 1-2h | None |
| 1 | Service layer changes | 2-3h | Phase 0 complete |
| 2 | API routes with error handling | 2-3h | Phase 1 complete |
| 3 | Components (wizard, dialog) | 4-5h | Phase 2 complete |
| 4 | Integration, testing, polish | 2-3h | Phase 3 complete |
| **TOTAL** | | **11-16h** | |

---

## Owner Assignments (Suggested)

- **Architecture/Service layer:** Code reviewer or backend-focused dev
- **API routes:** Full-stack dev (API + validation)
- **Component implementation:** Frontend-focused dev
- **Integration/testing:** QA or code reviewer

---

## Questions for Clarification

1. **Embedding verification:** How long should Step 2 wait for embedding? (Current: 10s)
2. **Idempotency:** Should we store idempotency keys in database or just client-side?
3. **Rate limiting:** Any specific limits for match endpoints? (Suggested: 10/min per IP)
4. **Draft recovery:** Should we implement sessionStorage draft recovery? (Suggested: Low priority)

---

**Review Status:** APPROVED WITH REFINEMENTS
**Next Step:** Apply high-priority changes (Phase 0) before starting Phase 1
