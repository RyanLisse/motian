# UX Flow Analysis — Kandidaat Profiel + Pipeline Koppeling

**Analysis Completed:** 2026-03-05
**Analyst:** UX Flow & Requirements Engineer
**Status:** Ready for Implementation Clarification

---

## Documents in This Analysis

1. **EXECUTIVE-SUMMARY.md** — High-level findings (5 min read)
   - The numbers: 42 flows, 31 gaps, 5 critical blockers
   - Risk assessment and path forward
   - Decision log and completeness checklist

2. **2026-03-05-ux-flow-analysis-kandidaat-profiel-pipeline-koppeling.md** — Deep dive (30 min read)
   - Part 1: All 10 primary flows + 32 edge cases
   - Part 2: Permutation matrix (22 variations)
   - Part 3: All 31 specification gaps organized by category
   - Part 4: 41 questions prioritized (5 critical, 8 important, 10 nice-to-have)
   - Part 5: Implementation checklist and risk mitigation

3. **FLOW-DIAGRAMS.md** — Visual user journeys (15 min read)
   - 15 detailed flow diagrams showing branches, decisions, errors
   - Happy path, error paths, race conditions, mobile behavior
   - Timeout degradation, data consistency, keyboard navigation

---

## Quick Navigation

**If you have 5 minutes:**
→ Read `EXECUTIVE-SUMMARY.md`

**If you have 15 minutes:**
→ Read `EXECUTIVE-SUMMARY.md` + skim `FLOW-DIAGRAMS.md` (flows 1, 2, 6, 9)

**If you have 30+ minutes:**
→ Read all three documents in order

**If you're implementing:**
→ Start with `EXECUTIVE-SUMMARY.md`, answer 5 critical questions, then reference `2026-03-05-ux-flow-analysis-kandidaat-profiel-pipeline-koppeling.md` Part 5 (Implementation Checklist)

**If you're testing:**
→ See `2026-03-05-ux-flow-analysis-kandidaat-profiel-pipeline-koppeling.md` Part 5 (Phase 2: Test Planning)

**If you're reviewing:**
→ See `FLOW-DIAGRAMS.md` for visual validation of all flows

---

## Key Findings

### What's Well-Defined ✓

- 2-step wizard architecture (Profile → Linking)
- Happy path flow (create → match → link → done)
- Vacancy-side bidirectional UX
- Existing services and database schema
- Duplicate prevention mechanism (unique constraint)

### What's Missing (Critical Blockers)

| # | Issue | Impact | Expected Answer |
|---|-------|--------|-----------------|
| C1 | Matching timeout (>15s) behavior | Blocks Step 2 UI | "Show quick scores at 3s, keep waiting up to 15s, then degrade" |
| C2 | Idempotency & race condition handling | Blocks API design | "Skip already-linked jobs, return { created, alreadyLinked }" |
| C3 | Form validation timing (real-time vs. submit) | Blocks form UX | "Submit-time validation with error toast" |
| C4 | CV impact on Step 2 matching | Blocks embedding logic | "CV extracted synchronously, Step 2 uses enriched embedding" |
| C5 | Step 2 abandonment final state | Blocks data persistence | "Candidate persisted even if Step 2 abandoned, no apps created" |

---

## Implementation Readiness

**Status:** 85% Specified, 100% Feasible

**Blockers:** 5 Critical questions must be answered before coding
**Gaps:** 8 Important issues should be clarified before design
**Polish:** 10 Nice-to-have improvements for after MVP

**Estimated Timeline:**
- **Day 1:** Answer critical questions + create mockups
- **Day 2:** Design + testing plan
- **Days 3-9:** Implementation (4 phases)
- **Days 10-11:** Testing + QA

---

## How to Use This Analysis

### For Product Managers
→ Use `EXECUTIVE-SUMMARY.md` to understand scope and risk
→ Use critical questions (C1-C5) to drive clarification discussion

### For Designers
→ Use `FLOW-DIAGRAMS.md` to understand all user journeys
→ Reference important issues (I1-I8) when creating mockups
→ Ensure accessible keyboard navigation (I5, N3)

### For Developers
→ Use `2026-03-05-ux-flow-analysis-kandidaat-profiel-pipeline-koppeling.md` Part 5 for implementation checklist
→ Reference Gap categories when coding (error handling, validation, etc.)
→ Use flow diagrams to test all paths (happy + error)

### For QA/Testers
→ Use `2026-03-05-ux-flow-analysis-kandidaat-profiel-pipeline-koppeling.md` Part 5 (Phase 2: Test Planning)
→ Test all 15 flows from `FLOW-DIAGRAMS.md`
→ Verify error paths (network failures, timeouts, duplicates)
→ Test on mobile (<640px) and with keyboard only

---

## What This Analysis Covers

✓ All 10 primary user flows (happy path + variations)
✓ 32 edge cases and error states
✓ Mobile & responsive behavior (3+ breakpoints)
✓ Accessibility requirements (keyboard, screen reader)
✓ Data consistency & race conditions
✓ Error recovery paths
✓ Performance considerations
✓ Database constraints & indexes
✓ Integration points & revalidation

---

## What This Analysis Does NOT Cover

✗ Implementation code or pseudocode (see spec document instead)
✗ Detailed visual design (see design team for mockups)
✗ API request/response examples (will be in Zod schemas)
✗ Database migration scripts (no schema changes needed)
✗ Deployment or infrastructure changes
✗ Analytics event definitions (beyond "application:created")

---

## Critical Path to Implementation

```
Week 1:
  Mon: Answer C1-C5 critical questions (1 hour meeting)
  Tue: Create mockups + finalize specs (design team)
  Wed: Write Zod schemas + test plan (dev + QA)
  Thu-Fri: Phase 1 (service layer + API endpoints)

Week 2:
  Mon-Wed: Phase 2 (candidate wizard UI)
  Thu: Phase 3 (vacancy-side linking)
  Fri: Phase 4 (integration + error handling)

Week 3:
  Mon-Tue: Testing + bug fixes
  Wed: Code review + QA sign-off
  Thu: Deploy to staging
  Fri: Final review + production release
```

---

## Questions? Issues?

**Unclear flows?** → See `FLOW-DIAGRAMS.md` for visual representation

**Want details on a specific gap?** → Search `2026-03-05-ux-flow-analysis-kandidaat-profiel-pipeline-koppeling.md` by category (1-10)

**Need implementation guidance?** → See Part 5 (Implementation Checklist) in deep-dive document

**Questions about accessibility?** → See Category 5 (Accessibility) in deep-dive document

**Need mobile specs?** → See Category 4 (Mobile & Responsive) + Flow 12 in diagrams

---

## Analysis Methodology

**Approach:** Exhaustive flow enumeration + edge case generation + specification gap analysis

**Rigor Level:** Engineering-grade (suitable for production feature)

**Data Sources:**
- Feature plan: `/docs/plans/2026-03-05-feat-kandidaat-profiel-pipeline-koppeling-plan.md`
- Brainstorm: `/docs/brainstorms/2026-03-05-kandidaat-profiel-pipeline-koppeling-brainstorm.md`
- Codebase: `src/services/`, `src/db/schema.ts`, `components/add-candidate-dialog.tsx`

**Analysis Dimensions:**
- User journeys (10 primary flows)
- Flow permutations (22 variations)
- Edge cases (42+ identified)
- Error states & recovery paths (7 primary error flows)
- Mobile & responsive behavior (4 flows)
- Accessibility & keyboard navigation (4 flows)
- Data consistency & transactions (4 flows)
- System resilience & performance (6 flows)

**Deliverables:**
- 42+ distinct user flows mapped
- 31 specification gaps identified
- 5 critical blockers flagged
- 8 important clarifications listed
- 10 nice-to-have improvements documented
- 41 discrete questions requiring answers
- 15 detailed flow diagrams
- Implementation checklist (80+ items)
- Risk assessment + mitigation strategies

---

## Last Updated

**2026-03-05** — Full analysis complete
**Next Review:** After critical questions answered (C1-C5)

---

**Status:** Ready to proceed to clarification phase.
**Recommendation:** Answer 5 critical questions, then proceed to design + implementation.

