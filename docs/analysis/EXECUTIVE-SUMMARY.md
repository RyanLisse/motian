# Executive Summary: Kandidaat Profiel + Pipeline Koppeling

**Feature Analysis:** Complete ✓
**Date:** 2026-03-05
**Status:** Ready for Clarification Phase

---

## The Numbers

- **42+ User Flows Identified** across 10 primary scenarios + 32 edge cases
- **31 Specification Gaps** across 10 categories
- **5 Critical Blockers** requiring immediate clarification
- **8 Important Ambiguities** affecting UX quality
- **10 Nice-to-Have** improvements for polish

---

## Critical Blockers (MUST ANSWER)

### **C1: Timeout Behavior for Matching >15s**
When Step 2 matching takes >15 seconds, what exactly should happen?
- Show quick scores immediately while waiting for full results?
- Cancel deep matching and fallback at timeout?
- What UX transition message?

**Impact:** Blocks Step 2 UI implementation

---

### **C2: Idempotency & Race Condition Prevention**
If two recruiters simultaneously link same candidate to same job, how to handle gracefully?
- Partial success (create 2 of 3, fail on 1)?
- Rollback all?
- Silent skip of already-linked?

**Impact:** Blocks API design and error handling

---

### **C3: Step 1 Validation Timing**
When is form validation applied?
- Real-time (as user types)?
- Submit-time (after click)?
- Blur-time (when field loses focus)?

**Impact:** Blocks form UX and error message strategy

---

### **C4: CV Impact on Step 2 Matching**
Does CV uploaded in Step 1 immediately improve Step 2 results?
- CV text extracted synchronously or async?
- Does Step 2 wait for CV-enriched embedding or use initial profile embedding?
- Fallback if CV parsing fails?

**Impact:** Blocks embedding/matching implementation sequence

---

### **C5: Step 2 Abandonment Final State**
If candidate completes Step 1 but exits Step 2 without confirming links, what persists?
- Candidate in talentpool? (Yes/No)
- Applications created? (No)
- Can re-open wizard later? (Yes/No)

**Impact:** Blocks data persistence strategy

---

## High-Impact Issues (IMPORTANT)

| Issue | Impact | Clarification Needed |
|-------|--------|---------------------|
| Mobile Dialog Height | Medium | Max height on <640px? Scrolling? Fixed footer buttons? |
| "Al gekoppeld" Badge UX | Low | Visual treatment (gray, badge, opacity)? Tooltip? |
| Empty State Messaging | Low | Suggest CV upload? Edit profile? Manual matching link? |
| Error Toast vs. Inline | Medium | Form errors as toast or inline validation? |
| Keyboard Tab Order | Medium | Exact sequence through Step 1 & 2? |
| Concurrent Embeddings | Medium | Queue embeddings or fire all simultaneously? Rate limit? |
| Application Stage Semantics | Medium | Why `"screening"` instead of `"new"`? Implications? |
| Match vs. Application Lifecycle | Medium | What happens to jobMatch when application deleted? |

---

## What's Well-Defined

✓ **2-Step Wizard Architecture** — Clear separation of Profile (Step 1) vs. Linking (Step 2)
✓ **Happy Path Flow** — Create → Match → Link → Done
✓ **Vacancy-Side Bidirectional** — Same UX from vacancy detail page
✓ **Existing Services** — Auto-matching, embedding, scoring already exist
✓ **Database Schema** — All columns exist, no migrations needed
✓ **Duplicate Prevention** — Unique constraint (jobId, candidateId) on applications

---

## What's Ambiguous

✗ **Matching Timeout Handling** — Plan says "show degraded results" but no definition
✗ **Error Recovery Paths** — Network errors during each step undefined
✗ **Form Validation** — When applied, how errors shown, recovery strategy
✗ **Mobile Responsive** — Dialog height, scrolling, button positioning
✗ **Accessibility Details** — Tab order, ARIA labels, screen reader announcements
✗ **Data Consistency** — Race conditions, partial updates, rollback semantics
✗ **Performance at Scale** — Behavior with 10k+ jobs, concurrent embeddings

---

## Risk Assessment

| Risk | Likelihood | Impact | Mitigation |
|------|------------|--------|-----------|
| Matching timeout (>15s) | Medium | High | Define threshold & degradation strategy now |
| Duplicate applications (race) | Low | Medium | Idempotency key + batch endpoint design |
| Network errors during linking | Low | Medium | Implement retry + specific error messages |
| Embedding API failure | Low | Medium | Fallback to rule-based scoring (exists) |
| Mobile form overflow | Medium | Low | Test on real devices, ensure scrollable |
| Keyboard nav broken | Low | High | Automated a11y testing + manual testing |

---

## Recommended Path Forward

### **Day 1: Clarification**
- Answer 5 critical questions above
- Create UI mockups for Step 1 & Step 2
- Define complete Dutch string labels
- Finalize tab order spec for accessibility

### **Day 2: Design & Testing Plan**
- Create error state UI specs
- Write test plan (happy + error paths)
- Accessibility checklist
- Performance targets (matching <15s, etc.)

### **Days 3-9: Implementation**
- Phase 1: Service layer + 3 new API endpoints (2 days)
- Phase 2: Candidate wizard UI + Step 2 matching UI (3 days)
- Phase 3: Vacancy-side linking dialog (1 day)
- Phase 4: Integration, error handling, polish (1 day)

### **Days 10-11: Testing & Review**
- Manual testing on desktop + mobile
- Accessibility audit (keyboard, screen reader)
- Performance testing (matching latency, concurrent load)
- Code review + QA sign-off

---

## Decision Log

| Decision | Choice | Rationale |
|----------|--------|-----------|
| Role required? | UI only (API optional) | MCP/CLI/AI tools use optional role; prevent breaking changes |
| Persist at Step 1? | Yes | User doesn't lose candidate even if Step 2 abandoned |
| Already-linked definition | Existing application (non-deleted) | Match = proposal, Application = confirmation |
| Back navigation Step 2→1? | No | Candidate already saved; edit later from detail page |
| CV upload impact? | **UNDEFINED** | See Critical Blocker C4 |
| Application stage? | Always `"screening"` | Per spec; may need semantic justification |

---

## Completeness Checklist

- [x] All 10 primary user flows mapped
- [x] 32 edge cases identified
- [x] Error paths documented
- [x] Mobile behavior considered
- [x] Accessibility requirements listed
- [x] Performance concerns flagged
- [x] Data consistency issues raised
- [ ] **5 Critical questions answered** ← BLOCKING
- [ ] **8 Important ambiguities resolved** ← BLOCKING
- [ ] UI mockups created
- [ ] Test plan finalized
- [ ] Implementation can begin

---

## Key Insight

**This feature is 85% specified and 100% feasible.** The remaining 15% is critical timeout/error handling logic that, once defined, becomes straightforward to implement. The plan shows excellent product thinking (reduced friction, immediate pipeline placement, bidirectional UX), but leaves implementation details to engineering.

**Recommendation:** Schedule 1-hour clarification call to answer C1-C5, then proceed immediately to implementation. All other gaps are lower-risk and can be resolved during design phase.

---

**Full Analysis:** See `2026-03-05-ux-flow-analysis-kandidaat-profiel-pipeline-koppeling.md`

