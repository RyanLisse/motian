# Critical Clarification Checklist

**Purpose:** Quick reference for answering the 5 blocking questions before implementation
**Format:** Copy into meeting notes, answer each, mark completed
**Estimated Duration:** 1 hour discussion

---

## CRITICAL BLOCKERS (Must Answer)

### C1: Timeout Behavior for Matching >15s

**Status:** [ ] Answered [ ] Pending [ ] Deferred

**Question:** When Step 2 matching takes >15 seconds, what should happen?

**Options to choose from:**

- [ ] Option A: Show quick scores (rule-based) immediately at ~3s, keep waiting for full structured results, replace with full when ready (up to 15s), then degrade to quick if still loading

- [ ] Option B: Timeout strictly at 15s — cancel deep matching, show quick scores only with degradation message

- [ ] Option C: Keep waiting indefinitely (no timeout, just slow spinner)

- [ ] Option D: Custom threshold (specify seconds): ___

**Secondary details:**

- [ ] How should loading message progression work?
  - [ ] Single message "Bezig met matchen..." throughout
  - [ ] Progressive: "Embedding..." → "Matching..." → "Finalizing..."
  - [ ] With time estimate: "Dit zal 10-20 seconden duren"

- [ ] What about user interaction during loading?
  - [ ] User can click "Skip" anytime?
  - [ ] Or must wait for results?

**Decided:** ____________________________
**Rationale:** ____________________________

---

### C2: Idempotency & Race Condition Prevention

**Status:** [ ] Answered [ ] Pending [ ] Deferred

**Question:** How should the system handle duplicate applications if two recruiters simultaneously link the same candidate to the same job?

**Scenario:**
- Recruiter A on candidate page confirms: Job X, Job Y, Job Z
- Recruiter B on Job Y page confirms same candidate
- Both POST simultaneously to create applications

**Options to choose from:**

- [ ] Option A (Partial Success): Create Job X + Z for recruiter A, skip Job Y (already linked), return `{ created: [X, Z], alreadyLinked: [Y], message: "..." }`

- [ ] Option B (All-or-Nothing): If any job already linked, rollback all, return error "1 vacancy already linked"

- [ ] Option C (Silent Skip): Create Job X + Z, silently skip Job Y, show success (user unaware of skip)

**Secondary details:**

- [ ] Should response include which jobs were already linked?
  - [ ] Yes, always show `{ created: [...], alreadyLinked: [...] }`
  - [ ] No, just create and ignore duplicates

- [ ] Idempotency key strategy for safe retries?
  - [ ] Per (candidateId, jobId) pair (database unique constraint)
  - [ ] Explicit idempotency key in request header
  - [ ] No idempotency key (rely on database constraint)

- [ ] If linking endpoint called twice with same payload:
  - [ ] First succeeds, second returns error (or success with already-linked annotation)?
  - [ ] Both appear as duplicates in logs?

**Decided:** ____________________________
**Rationale:** ____________________________

---

### C3: Step 1 Form Validation Timing

**Status:** [ ] Answered [ ] Pending [ ] Deferred

**Question:** When is form validation applied?

**Options to choose from:**

- [ ] Option A (Real-time): Validate as user types in each field
  - [ ] Show inline errors immediately
  - [ ] Disable "Volgende" button if errors present

- [ ] Option B (Blur Validation): Validate when user leaves field (blur event)
  - [ ] Show inline error when field loses focus
  - [ ] "Volgende" button disabled if any field has error

- [ ] Option C (Submit-time): Validate only when "Volgende" clicked
  - [ ] Show all errors at once (inline + toast)
  - [ ] Form doesn't advance if any error

- [ ] Option D (Hybrid): Blur for real-time feedback, submit for final validation

**Secondary details:**

- [ ] Required field indicators:
  - [ ] Asterisk (*)?
  - [ ] Text "(required)" in Dutch or English?
  - [ ] "Verplicht" in Dutch?
  - [ ] Color + icon + text?

- [ ] For `rol` field (required at UI level):
  - [ ] Is it also API-required, or can API accept empty?
  - [ ] Same validation level as `naam`?

- [ ] Email validation:
  - [ ] Check format (RFC 5322)?
  - [ ] Check if email already exists in database?
  - [ ] If exists, error message: "Email already in use" or suggest merge?

- [ ] If validation fails and user closes dialog:
  - [ ] Confirm before closing? "You have unsaved changes"
  - [ ] Or just discard form?

**Decided:** ____________________________
**Rationale:** ____________________________

---

### C4: CV Upload Impact on Step 2 Matching

**Status:** [ ] Answered [ ] Pending [ ] Deferred

**Question:** Does CV uploaded in Step 1 immediately improve Step 2 results?

**Scenario:**
- User uploads CV in Step 1 form
- CV file submitted with candidate data
- Server must: extract text, generate embedding, run matching
- Step 2 needs to display results

**Options to choose from:**

- [ ] Option A (Synchronous Parsing):
  - [ ] CV parsed/extracted immediately in POST `/api/kandidaten`
  - [ ] Embedding includes CV content before Step 2 load
  - [ ] Step 2 shows matches based on CV-enriched embedding
  - [ ] Adds 3-5 seconds to Step 1 latency

- [ ] Option B (Async Parsing):
  - [ ] CV parsing happens in background after Step 1 persists
  - [ ] Step 2 uses initial profile-only embedding immediately
  - [ ] CV-enriched embedding available later (re-match or next wizard open)

- [ ] Option C (Queued):
  - [ ] CV parsing queued, user sees "Processing in background"
  - [ ] Step 1 completes, Step 2 shows placeholder
  - [ ] Results update when CV parsing completes

**Secondary details:**

- [ ] If CV extraction fails (corrupt PDF, unreadable OCR):
  - [ ] Show error "CV could not be parsed. Try again"?
  - [ ] Fallback to profile-only matching (silent degradation)?
  - [ ] Ask user to re-upload or continue without CV?

- [ ] CV storage location:
  - [ ] File system?
  - [ ] Cloud storage (S3, GCS)?
  - [ ] Database BYTEA?
  - [ ] Where is extracted text stored?

- [ ] Matching quality impact:
  - [ ] How much does CV improve matching score? (5-10 points? 20 points?)
  - [ ] Is this measurable in Step 2 results?

**Decided:** ____________________________
**Rationale:** ____________________________

---

### C5: Step 2 Abandonment Final State

**Status:** [ ] Answered [ ] Pending [ ] Deferred

**Question:** If user completes Step 1 but exits Step 2 without confirming links, what's the final state?

**Scenarios:**

1. **Exit during Step 2 loading (before matches shown):**
   - [ ] Candidate persisted? Yes / No
   - [ ] Embedding complete? Yes / No
   - [ ] Matches computed? Yes / No
   - [ ] In-flight requests cancelled or allowed to complete?

2. **Exit on Step 2 (after matches shown, no confirm):**
   - [ ] Candidate persisted? Yes / No
   - [ ] Matches cached for next wizard open? Yes / No / Recompute fresh
   - [ ] Applications created? No
   - [ ] Visible in talentpool? Yes / No

3. **Click "Skip" button on Step 2:**
   - [ ] Candidate persisted? Yes / No
   - [ ] Success message shown? Yes / No
   - [ ] What message? "Kandidaat opgeslagen in talentpool"
   - [ ] Dialog closes? Yes

4. **Click "Terug" button if provided (go back to Step 1):**
   - [ ] Is "Terug" button shown on Step 2? Yes / No
   - [ ] Can user edit Step 1 and re-match? Yes / No
   - [ ] If no "Terug": how does user know they can't go back?

**Secondary details:**

- [ ] Candidate visibility in talentpool:
  - [ ] Appears immediately after Step 1 submit? Or after Step 2 confirm?
  - [ ] Has embedding status indicator (pending vs. complete)?
  - [ ] Filterable by "pending embedding"?

- [ ] Can user re-open wizard for same candidate?
  - [ ] If yes, does it reshow Step 1 or jump to Step 2?
  - [ ] Matches from previous attempt reused or recomputed?

- [ ] Browser back button behavior:
  - [ ] Does back go to candidates list? Or re-open Step 1?
  - [ ] Is back prevented to avoid navigation confusion?

**Decided:** ____________________________
**Rationale:** ____________________________

---

## DECISION SUMMARY

After answering C1-C5, fill in this summary:

**C1 - Timeout Behavior:** [Your chosen option]
- Threshold: _____ seconds
- Message progression: [chosen]

**C2 - Race Condition Handling:** [Your chosen option]
- Response format: { created, alreadyLinked }? [Yes/No]
- Idempotency strategy: [chosen]

**C3 - Validation Timing:** [Your chosen option]
- Required field indicator: [chosen]
- Email duplicate check: [Yes/No]

**C4 - CV Impact:** [Your chosen option]
- CV parsing: [Sync/Async/Queued]
- Extraction failure: [Error/Fallback/Re-upload]

**C5 - Step 2 Abandonment:** [Your chosen option]
- Candidate persisted: [Yes/No]
- Matches cached: [Yes/No/Recompute]
- "Terug" button: [Shown/Hidden]

---

## Next Steps After Clarification

Once all 5 critical questions answered:

- [ ] Share answers with design team
- [ ] Create mockups for Step 1 form validation UX
- [ ] Create mockups for Step 2 timeout/loading progression
- [ ] Create mockups for already-linked badge appearance
- [ ] Write Zod schemas with validation rules
- [ ] Schedule testing planning session
- [ ] Begin Phase 1 implementation (service layer)

---

## Sign-off

**Clarification Meeting Date:** __________
**Participants:** __________
**Answers Recorded By:** __________
**Reviewed By:** __________

---

**Status:** [ ] Ready for design [ ] Ready for implementation [ ] Awaiting clarification

