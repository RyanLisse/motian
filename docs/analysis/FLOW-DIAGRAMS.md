# User Flow Diagrams: Kandidaat Profiel + Pipeline Koppeling

---

## Flow 1: Happy Path (Complete Success)

```
Recruiter clicks "Nieuwe kandidaat"
        ↓
   Dialog opens (Step 1: Profile)
        ↓
   Enter: naam (required), rol (required), skills, experience, email, CV
        ↓
   Click "Volgende"
        ↓
   POST /api/kandidaten
        ↓ Success
   Candidate persisted, ID returned
        ↓
   Trigger embedding + matching
        ↓
   Display loading state "Bezig met matchen..." (2-14s)
        ↓
   POST /api/kandidaten/[id]/match
        ↓ Success (3+ matches found)
   Step 2: Matching displays top-3 vacancies
        ↓
   Top-1 pre-selected, user confirms 1+ vacancies
        ↓
   Click "Koppel"
        ↓
   POST /api/kandidaten/[id]/koppel with selectedMatchIds
        ↓ Success
   Create applications in "screening" stage
        ↓
   Show success message
        ↓
   Dialog closes → router.refresh()
        ↓
   Candidate visible in talentpool + pipeline
```

**Expected Duration:** 20-40 seconds
**Success Criteria:** Candidate persisted, 1+ applications created with source="match"

---

## Flow 2: No Matches Found (Empty State)

```
Step 1 completed → embedding complete → matching runs
        ↓
   All top-3 candidates have score < MIN_SCORE (40)
        ↓
   Step 2 shows empty state
   "Geen passende vacatures gevonden"
   Suggestion: "Sla kandidaat op en match later"
        ↓
        ┌─── User clicks "Skip" ────┐
        │                           │
        ↓                           ↓
   Candidate saved            (No change)
   No applications created
   Dialog closes
   Candidate in talentpool only
        │
        ├─── User clicks "Terug" ───┐
        │                           │
        ↓                           ↓
   Return to Step 1              (Edit profile)
   (Not clear if allowed)
```

**Question:** Can user go back to Step 1 to edit profile for re-matching?

---

## Flow 3: All Matches Already Linked (Conflict)

```
Matching completes → top-3 vacancies found
        ↓
   Check: do existing applications exist for (candidateId, jobId)?
        ↓
   All 3 vacancies already linked
        ↓
   Step 2 displays match cards with "Al gekoppeld" badges
   All checkboxes disabled (grayed out)
   Confirm button disabled
        ↓
        ┌─────────────────────────────────────┐
        │                                     │
        ↓                                     ↓
   User clicks "Skip"              User closes dialog
        │                                     │
        ↓                                     ↓
   Success message               Back to wizard start
   (or silent close?)
```

**Question:** Should "Skip" show success message if no new links created?

---

## Flow 4: Network Error During Step 1 (Create Candidate)

```
Form filled, user clicks "Volgende"
        ↓
   POST /api/kandidaten
        ↓ Error (500, timeout, etc.)
   Network error response
        ↓
   Show error toast: "Fout bij opslaan kandidaat"
   Suggest retry button
        ↓
        ┌────── User clicks "Retry" ────┐
        │                               │
        ↓                               ↓
   POST /api/kandidaten again      User closes dialog
   (form data persisted)           (data lost)
        │
        ├─ Success ─→ Step 2
        │
        └─ Error again ─→ Toast again
```

**Question:** Form data persisted for retry? Or reset?

---

## Flow 5: Network Error During Step 2 (Matching)

```
Step 1 completed → POST /api/kandidaten/[id]/match
        ↓
   Loading spinner: "Bezig met matchen..."
        ↓
   Network error (timeout, 500, etc.)
        ↓
   Option A: Show error toast
            "Kan suggesties niet laden. Probeer opnieuw."
            With retry button
                    ↓
            ├─ Retry → Success → Show matches
            │
            └─ Retry → Error → Toast again
        ↓
   Option B: Allow "Skip" even if matching failed
            (Customer saved, no applications, no suggestions)
        ↓
   Dialog closes
```

**Question:** Should matching error block wizard or allow skip?

---

## Flow 6: Timeout During Matching (>15 seconds)

```
Step 1 → POST /api/kandidaten → embedding generation
        ↓
   Embedding completes (typically <3s)
        ↓
   Quick scoring (rule-based) — 1-2s
        ↓
   Deep structured matching starts
        ↓
   Progress:
   • 3s: Quick scores available (option: show immediately)
   • 10s: Deep matching in progress
   • 15s: Timeout threshold (question: hard vs soft?)
   • 20s: User frustrated, consider degradation
        ↓
   Option A: Show quick scores at 3s, replace with full at 12s when ready
   "Loading full matches..." message
        ↓
   Option B: Timeout at 15s, show quick scores only
   "Full matching unavailable, showing quick scores"
        ↓
   Option C: Wait forever (hard to use, not recommended)
        ↓
   Step 2 displays (quick or full), user proceeds
```

**CRITICAL QUESTION:** Define timeout threshold and degradation strategy

---

## Flow 7: Step 2 Abandonment (Incomplete Wizard)

```
Step 1 completed → Embedding starts → Loading state begins
        ↓
        ┌─ Exit during loading ─────┐
        │                           │
        ↓                           ↓
   User closes dialog          In-flight requests?
   (Escape, X, or click out)   (cancel or let complete?)
        │                           │
        ├─────────────────────────┘
        │
        ↓
   Candidate already persisted (Step 1 success)
        ↓
        ┌─ Candidate in talentpool? ─┐
        │                            │
        ├─── After Step 2 loads ────┐
        │                           │
        ↓                           ↓
   User closes without      Candidate visible +
   confirming links          matches recomputable
        │
        ├─ Candidate + applications?
        │
        └─ No applications created
             (links not confirmed)
```

**Question:** If user exits during embedding, is candidate rolled back or persisted?

---

## Flow 8: Vacancy-Side Linking (Bidirectional)

```
Recruiter on vacancy detail page
        ↓
   Clicks "Koppel kandidaten" button
        ↓
   LinkCandidatesDialog opens
        ↓
   Loading: POST /api/opdrachten/[id]/match-kandidaten
        ↓
   Top-3 matching candidates displayed
   (name, role, skills, score, reasoning)
        ↓
   Top-1 pre-selected
   Already-linked candidates show "Al gekoppeld" badge
        ↓
        ┌──── User confirms selection ────┐
        │                                 │
        ↓                                 ↓
   POST /api/opdrachten/[id]/koppel   User closes dialog
   Create applications in "screening"
        │
        └─ Success → Toast → Vacancy page refreshes
```

**Same UX as Step 2 of candidate wizard**

---

## Flow 9: Race Condition (Concurrent Linking)

```
Recruiter A (candidate view)           Recruiter B (vacancy view)
     │                                      │
     ├─ Confirm job X for candidate ───┐   │
     │                                 │   ├─ Confirm same candidate for job X
     │                                 │   │
     ↓                                 ↓   ↓
   POST /api/kandidaten/[id]/koppel       POST /api/opdrachten/[id]/koppel
   (jobId: X)                             (candidateId: Y)
     │                                 │
     ├─────────────────────────────────┤
     │ Database Unique Constraint       │
     │ (jobId, candidateId) violation   │
     │
     ├─ Success (first request)
     │
     └─ Error (second request)
        "Kandidaat al gekoppeld aan vacature"
        │
        ├─ Retry? → Still fails (idempotent)
        │
        └─ Show user graceful error
           (not "Constraint violation")
```

**Critical:** Need idempotency strategy and graceful error handling

---

## Flow 10: Mobile Form on Small Screen (<640px)

```
Dialog opens Step 1 on mobile (e.g., iPhone SE 320px)
        ↓
   Dialog max-width: 100vw - safe area
   Dialog max-height: 90vh (not full screen)
        ↓
   Form content scrollable inside dialog
        ↓
   ┌─ Scrolling viewport ──────────────────┐
   │                                       │
   │ [Header] Step 1: Profiel             │
   │                                       │
   │ [Scrollable form body]               │
   │  - Naam input                        │
   │  - Email input                       │
   │  - Role select                       │
   │  - Location input                    │
   │  - ... (more fields below)           │
   │  - CV file upload                    │
   │  - Notes textarea                    │
   │                                       │
   │ [Fixed footer]                       │
   │  [Volgende button]  [Cancel button]  │
   │                                       │
   └───────────────────────────────────────┘
        ↓
   Question: Are footer buttons always visible?
   Option A: Fixed position (always visible)
   Option B: Inside scroll area (user must scroll down)
```

**Question:** Responsive dialog max-height and footer behavior on mobile

---

## Flow 11: Error Recovery Path (Form Validation)

```
Step 1 form submitted
        ↓
   Server validation:
   • naam: not empty ✓
   • role: not empty ✓
   • email: valid format ✓
   • hourlyRate: valid number ✓
        ↓
   Option A: All valid → Step 2
        ↓
   Option B: Email exists → Error
        ✗ "Email adres al in gebruik"
        │
        ├─ Show inline error under email field
        │ OR
        └─ Show toast notification
        │
        ├─ User updates email
        │
        └─ Resubmit form
        ↓
   Step 2
```

**Question:** Should validation be real-time (blur), submit-time, or both?

---

## Flow 12: Matching Quality with vs. without CV

```
Scenario A: Candidate without CV
        ↓
   Profile data only: naam, rol, skills (3-4), experience (text)
        ↓
   Embedding computed from structured + text data
        ↓
   Matching quality: medium (rule-based scoring emphasized)
        ↓

Scenario B: Same candidate + CV upload
        ↓
   Profile data + CV text (extracted from file)
        ↓
   Embedding computed from rich text (profile + CV)
        ↓
   Matching quality: high (deep structured matching emphasized)
        ↓

Question: Does Step 2 receive Scenario B results if CV uploaded in Step 1?
Option A: Yes, embedding includes CV content immediately
Option B: No, embedding async, Step 2 uses profile-only embedding
Option C: Partial, embedding in progress, Step 2 shows quick scores
```

**CRITICAL QUESTION:** When is CV-enriched embedding available for Step 2?

---

## Flow 13: Candidate Profile to Pipeline Mapping

```
State at different points:

AFTER Step 1 (candidate created):
├─ Talentpool: candidate VISIBLE (with profile data)
├─ Pipeline: NOT visible (no applications)
├─ Embedding: generated (or generating if async)
└─ Ready for Step 2? Yes, candidates has ID

AFTER Step 2 with No Matches:
├─ Talentpool: candidate VISIBLE
├─ Pipeline: NOT visible (skipped linking)
├─ Embedding: complete
└─ Status: "No suggestions found" (can match later)

AFTER Step 2 with Confirmed Links (1+ applications):
├─ Talentpool: candidate VISIBLE (now with application links)
├─ Pipeline: candidate VISIBLE in "screening" stage
├─ Applications: 1+ created with source="match"
├─ Job Matches: 1+ created (for traceability)
└─ Status: "Gekoppeld aan X vacatures"

AFTER Step 2 Abandoned (no confirmation):
├─ Talentpool: candidate VISIBLE
├─ Pipeline: NOT visible (exit without linking)
├─ Embedding: complete
└─ Status: "In talentpool, not yet matched"
```

---

## Flow 14: Tab Order & Keyboard Navigation (Step 1)

```
Dialog opens, focus on first field (naam)
        ↓
┌─────────────────────────────────────┐
│ Focus chain (Tab key traversal):    │
│                                     │
│ 1. naam input [required]           │
│    └─ Tab                          │
│ 2. email input [optional]          │
│    └─ Tab                          │
│ 3. phone input [optional]          │
│    └─ Tab                          │
│ 4. role select [required]          │
│    └─ Tab                          │
│ 5. location input [optional]       │
│    └─ Tab                          │
│ 6. hourlyRate number [optional]    │
│    └─ Tab                          │
│ 7. availability select [optional]  │
│    └─ Tab                          │
│ 8. linkedinUrl input [optional]    │
│    └─ Tab                          │
│ 9. skills tag input + add button   │
│    └─ Tab                          │
│10. experience list + add button    │
│    └─ Tab                          │
│11. CV file input                   │
│    └─ Tab                          │
│12. notes textarea [optional]       │
│    └─ Tab                          │
│13. "Volgende" button               │
│    └─ Tab (circles back to naam)   │
│                                     │
│ Escape: Close dialog               │
│ Enter on button: Submit             │
└─────────────────────────────────────┘
```

**Question:** Is exact tab order defined? Does it match visual layout?

---

## Flow 15: Matching Service Degradation Path

```
Matching request received: embed + score candidate against active jobs
        ↓
   PHASE 1: Quick Scoring (rule-based)
   • Duration: 1-2 seconds
   • Method: keyword match, location distance, salary range
   • Result: Top-3 by rule-based score
        ↓
   User sees at 3s: [loading spinner] "Bezig met matchen..."
   (Option: show quick results now)
        ↓
   PHASE 2: Deep Structured Matching
   • Duration: 5-12 seconds (depending on CV)
   • Method: LLM extracts requirements, matches against candidate
   • Result: Top-3 with reasoning, confidence scores
        ↓
   User sees at 12s: [results replace quick scores]
        ↓
   PHASE 3: Timeout (>15 seconds)
   • Option A: Keep waiting (poor UX)
   • Option B: Fallback to quick scores
   • Option C: Show partial results with degradation message
        ↓
   Step 2 receives: (quick scores OR full results OR timeout error)
        ↓
   Display matches to user with available data
```

**CRITICAL:** Define timeout threshold and Phase 3 UX

---

## Summary: All Entry & Exit Points

```
ENTRY POINTS:
├─ Candidate-side: Click "Nieuwe kandidaat" → Step 1
├─ Vacancy-side: Click "Koppel kandidaten" on vacancy detail → Dialog
└─ Manual: Navigate to candidates page → AddCandidateWizard

EXIT POINTS (Happy):
├─ Step 1 → Step 2 (success)
├─ Step 2 → Success message → Dialog closes → Router refresh
├─ Vacancy dialog → Success message → Dialog closes → Vacancy refresh

EXIT POINTS (Sad):
├─ Step 1 validation error → Toast → Retry or Close
├─ Step 1 network error → Toast → Retry or Close
├─ Step 2 matching error → Toast → Retry/Skip or Close
├─ Step 2 no matches → Empty state → Skip/Back or Close
├─ Step 2 timeout (>15s) → Degraded results → Confirm/Skip
├─ Step 2 linking error → Toast → Retry or Close
├─ Abandoned (any step) → Close dialog → Candidate saved (or not?)

FINAL STATES (Candidate):
├─ Talentpool (no applications) — if Step 1 only, or Step 2 skipped
├─ Pipeline (screening stage) — if Step 2 confirmed 1+ links
├─ Hidden (soft-deleted) — if recruiter deletes candidate later
```

---

