# UX Flow Analysis: Kandidaat Profiel + Pipeline Koppeling

**Analysis Date:** 2026-03-05
**Feature:** 2-Step Candidate Creation Wizard with Vacancy Linking
**Status:** Pre-Implementation Review
**Analyst Role:** UX Flow & Requirements Engineer

---

## Executive Summary

This document identifies **42+ user flows, 18 critical edge cases, and 31 specification gaps** in the Kandidaat Profiel + Pipeline Koppeling feature plan. The plan is well-structured but lacks clarity on:

1. **Matching Timeout & Degradation Behavior** — No explicit handling for >15s delays
2. **Idempotency & Race Conditions** — Concurrent linking attempts undefined
3. **Error Recovery Flows** — Step 2 abandonment, network failures uncovered
4. **Mobile/Responsive Behavior** — Scrolling, checkbox interaction, form layout on small screens
5. **Matching Failure States** — Embedding API failures, no fallback definition
6. **Data Persistence & Rollback** — Step 1 success, Step 2 skip behavior unclear
7. **Permission & Multi-user Scenarios** — Recruiter role boundaries undefined

---

## Part 1: User Flow Overview

### Primary Flow Personas

1. **Recruiter (Hiring Manager)** — Creates candidates, selects vacancy matches
2. **Talent Manager** — Reviews candidates in talentpool, uses vacancy-side linking
3. **System** — Auto-matching service, embedding API, database persistence

### 10 Primary Use Case Flows

#### **Flow 1: Happy Path — Candidate Creation → Matching → Linking**

**Trigger:** Recruiter clicks "Nieuwe kandidaat" button on professionals page
**Steps:**

1. Dialog opens → Step 1 (Profile)
2. Recruiter enters: naam (required), rol (required), optionally skills, experience, email, CV
3. Recruiter clicks "Volgende" → POST `/api/kandidaten` with profile data
4. System persists candidate, triggers embedding, displays loading state "Bezig met matchen..."
5. After embedding, POST `/api/kandidaten/[id]/match` retrieves top-3 matches
6. Step 2 displays: match cards with scores, reasoning, pre-selected top-1
7. Recruiter confirms 1+ vacancies → POST `/api/kandidaten/[id]/koppel` with selected matchIds
8. System creates applications in `screening` stage with `source: "match"`, links `matchId`
9. Success message shown, dialog closes, router refreshes `/professionals`
10. Candidate now appears in both talentpool (candidates list) AND pipeline (`screening` stage)

**Expected Duration:** 20-40 seconds (including embedding + matching)
**Success Criteria:**
- Candidate created with all provided fields
- Embedding completed (vector stored)
- Top-3 matches retrieved
- 1+ applications created in `screening` stage
- Dialog closes, talentpool + pipeline updated

---

#### **Flow 2: No Matches Found**

**Trigger:** Candidate created, embedding complete, matching runs but score threshold not met
**Steps:**

1. Step 2 loads with skeleton placeholders (2-14s)
2. Matching completes: top-3 candidates all have score < MIN_SCORE (40)
3. Empty state displayed: "Geen passende vacatures gevonden. Sla kandidaat op in talentpool en match later."
4. User sees two options:
   - "Skip" button → closes wizard, candidate saved to talentpool only
   - "Terug" button → returns to Step 1 to edit profile (unclear if this is allowed)
5. If "Skip": confirmation message, wizard closes, router refreshes

**Decision Point:** Can user edit Step 1 profile AFTER embedding to improve score?
**Assumption:** No — candidate already persisted; edit via detail page instead

**Success Criteria:**
- Empty state clearly communicated
- User can skip or return to edit
- No mandatory matching required
- Candidate remains accessible in talentpool

---

#### **Flow 3: All Matches Already Linked**

**Trigger:** Candidate created, matching runs, but all top-3 vacancies have existing applications
**Steps:**

1. Step 2 loads with skeleton placeholders
2. Matching completes: top-3 matches exist, but checking `/applications` shows:
   - All 3 vacancies have non-deleted applications for this candidate
   - OR vacancy was previously linked in same session (rare)
3. Step 2 displays:
   - All 3 match cards with "Al gekoppeld" badge
   - All checkboxes disabled (grayed out)
   - Confirm button disabled (no selection possible)
   - Message: "Alle voorgestelde vacatures zijn al gekoppeld aan deze kandidaat."
4. User options:
   - "Skip" → closes wizard
   - "Terug" → returns to Step 1
   - (Implied) Close dialog via Escape or close button

**Decision Point:** Should "Skip" still show success message if no new links created?
**Assumption:** Yes — confirm user's intent even if no action taken

**Success Criteria:**
- All 3 matches annotated as "already linked"
- Confirm button disabled
- User can still skip or go back
- No duplicate applications created

---

#### **Flow 4: Step 2 Abandoned (Partial Wizard Completion)**

**Trigger:** User completes Step 1, loading begins, but exits before Step 2 confirmation
**Sub-flows:**

**4a) Exit during loading (pre-matching)**
- Embedding or matching in progress
- User closes dialog (Escape, X button, click outside)
- Question: Should cancel in-flight requests?
- Question: Candidate already persisted in Step 1 — keep or rollback?

**Assumption:** Candidate persisted, in-flight requests cancelled, wizard closed
**Expected State:** Candidate visible in talentpool without any applications

**4b) Exit on Step 2 (after matches loaded)**
- Matches displayed, user closes dialog without confirming
- User can return to candidate detail page later to link manually

**Assumption:** Candidate + matches remain in system, applications not created

**4c) Browser back button pressed on Step 2**
- Question: Is back navigation enabled? (Plan says "No")
- If browser back works: returns to candidates list, Step 1 not re-shown
- If back blocked: Escape/X only

**Success Criteria:**
- Step 1 persisted even if Step 2 exited
- No applications created until explicit "Koppel" confirmation
- Candidate remains queryable in talentpool
- Re-opening wizard reopens Step 2 (not Step 1)

---

#### **Flow 5: CV Upload During Step 1 & Impact on Matching**

**Trigger:** Recruiter uploads CV file in Step 1
**Steps:**

1. Form includes CV file input (inherited from current dialog)
2. File picked: PDF or DOCX, < 20MB
3. Form submitted with CV file → POST `/api/kandidaten` with multipart/form-data
4. Server processes:
   - Stores file (location TBD: `/files`, S3, or in-database?)
   - Extracts text (via Playwright, pdfparse, or similar)
   - Generates embedding from CV text
5. Embedding generated → auto-matching runs using CV content
6. Matching quality improved (plan states CV significantly helps)

**Question:** Does CV improve matching during immediate Step 2, or only if re-matched later?
**Assumption:** CV uploaded, text extracted, embedding includes CV content, Step 2 matches run with enriched data

**Question:** What if CV extraction fails?
**Assumption:** Fallback to structured profile data (skills, experience), matching degrades gracefully

**Success Criteria:**
- CV file uploaded, stored, and parsed
- Embedding includes CV content
- Step 2 matches reflect CV data
- Matching timeout still ~15s including CV parsing

---

#### **Flow 6: Matching Timeout / Failure (>15s delay)**

**Trigger:** Embedding or matching takes longer than expected
**Steps:**

1. Step 1 submitted → loading state "Bezig met matchen..."
2. After 2-3 seconds: quick score results available (rule-based scoring)
3. Wait for deep structured matching: 2-14 seconds additional
4. If total time approaches 15s:
   - **Question:** Show partial results with quick scores?
   - **Question:** Cancel deep matching and show degraded scores?
   - **Question:** Show timeout message and allow skip?

**Plan states:** "Show degraded results with rule-based scores if longer"
**BUT:** No explicit definition of:
- Timeout threshold (15s hard limit? Soft warning?)
- When to show degraded vs. waiting for full results
- Loading message progression ("Bezig met matchen... (dit kan even duren)")
- UX during timeout (spinner, progress indicator, ETA?)

**Assumption:** Show quick scores after 3s, continue loading full scores, show final results when ready (up to 15s), then degrade to quick scores only

**Success Criteria:**
- User never blocked beyond 15 seconds
- Partial results (quick scores) shown if full results delayed
- User sees progress/loading state
- Timeout doesn't break form state

---

#### **Flow 7: Network Error During Step 1 (Create Candidate)**

**Trigger:** POST `/api/kandidaten` fails (500, 503, timeout)
**Steps:**

1. User fills form, clicks "Volgende"
2. POST `/api/kandidaten` sent
3. Network error occurs → error response (e.g., 500)
4. UX responds:
   - **Question:** Show error toast with retry button?
   - **Question:** Keep form data and allow resubmit?
   - **Question:** Reset form?

**Assumption:** Show error toast "Fout bij opslaan kandidaat. Probeer opnieuw." with retry option; form data persists

**Success Criteria:**
- Error clearly communicated
- User can retry without re-entering data
- Form state preserved

---

#### **Flow 8: Network Error During Step 2 (Matching)**

**Trigger:** POST `/api/kandidaten/[id]/match` fails
**Steps:**

1. Step 1 submitted, candidate persisted
2. POST `/api/kandidaten/[id]/match` sent
3. Response timeout or 500 error
4. Step 2 loading state shows "Bezig met matchen..." but never resolves
5. **Question:** Timeout after X seconds and show error state?
6. **Question:** Retry button available?
7. **Question:** Fallback to empty state or partial results?

**Assumption:** Show error message "Kan suggesties niet laden. Probeer opnieuw." with retry; allow skip

**Success Criteria:**
- Error doesn't break wizard
- User can retry matching
- User can skip if matching unavailable
- Candidate remains persisted

---

#### **Flow 9: Network Error During Koppeling (Create Applications)**

**Trigger:** POST `/api/kandidaten/[id]/koppel` fails (creating applications)
**Steps:**

1. Step 2 displayed, user selects vacancies and confirms
2. POST `/api/kandidaten/[id]/koppel` sent with matchIds
3. Response error (500, unique constraint violation, etc.)
4. UX responds:
   - **Question:** Which applications were created before failure?
   - **Question:** Rollback partial creates?
   - **Question:** Idempotency key to prevent duplicates?

**Assumption:** Unique constraint `(jobId, candidateId)` prevents duplicates; error shown; allow retry

**Success Criteria:**
- Error message specific (e.g., "Vacature al gekoppeld")
- No partial application creation visible to user
- Retry doesn't create duplicates
- User can skip or modify selection

---

#### **Flow 10: Vacancy-Side Linking (Dialog from Vacancy Detail)**

**Trigger:** Recruiter clicks "Koppel kandidaten" button on vacancy detail page
**Steps:**

1. Button clicked → LinkCandidatesDialog opens
2. Dialog shows loading state "Bezig met matchen..."
3. POST `/api/opdrachten/[id]/match-kandidaten` retrieves top-3 candidates
4. Dialog displays:
   - Candidate cards with name, role, skills, score, reasoning
   - Top-1 pre-selected
   - Already-linked candidates show "Al gekoppeld" badge
5. User confirms 1+ candidates → POST `/api/opdrachten/[id]/koppel` (or alternate endpoint?)
6. **Question:** Do we have `/api/opdrachten/[id]/koppel` endpoint or use existing pattern?

**Assumption:** Create new endpoint `/api/opdrachten/[id]/koppel` with parallel logic to candidate-side

**Success Criteria:**
- Dialog opens on vacancy detail page
- Top-3 candidates displayed with scores
- Confirm creates applications in `screening` stage
- Already-linked candidates disabled
- Dialog closes, vacancy page refreshes

---

### Secondary Flows (Variations & Edge Cases)

#### **Flow 11: Duplicate Application Prevention (Race Condition)**

**Scenario:** Two recruiters simultaneously link same candidate to same job
**Steps:**

1. Recruiter A on candidate page, confirms job X
2. Recruiter B on job X page, confirms candidate Y (same candidate)
3. Both POST to create application for (jobId=X, candidateId=Y)
4. Database has UNIQUE constraint `(jobId, candidateId)` on applications table
5. First request succeeds, second fails with constraint violation
6. **Question:** Which recruiter sees the error?
7. **Question:** Should error be silent or show "Already linked"?

**Assumption:** Second request fails, user sees error toast "Kandidaat al gekoppeld aan vacature"

**Success Criteria:**
- No duplicate applications created
- Error is graceful and informative
- Database consistency maintained

---

#### **Flow 12: Mobile Responsive — Step 1 Form on Small Screen**

**Trigger:** User opens wizard on mobile (< 640px)
**Questions:**
- Form scrollable? Or overlapping inputs?
- CV file upload clickable on mobile?
- Skills tag input (free-text + add) usable on touch?
- Experience repeatable fields collapsible on mobile?

**Assumption:** Dialog full-height, form scrollable, all inputs touch-friendly

**Success Criteria:**
- Dialog not wider than viewport
- All inputs accessible without pinch-zoom
- Buttons easily clickable (min 44px height)
- Form scrollable if content taller than viewport

---

#### **Flow 13: Mobile Responsive — Step 2 Matching Cards on Small Screen**

**Trigger:** Step 2 displayed on mobile
**Questions:**
- Match cards full-width or side-by-side?
- Score ring visualization visible?
- Checkbox + text readable?
- Confirm + Skip buttons below or fixed footer?

**Assumption:** Cards full-width, stacked vertically, fixed footer with buttons

**Success Criteria:**
- Cards responsive (100% width on mobile)
- Checkboxes accessible (large touch target)
- All information visible without horizontal scroll
- Buttons always accessible

---

#### **Flow 14: Keyboard Navigation — Tab Through Step 1 Form**

**Trigger:** User navigates form via Tab, Enter, Shift+Tab
**Assumptions:**
- Required field validation on blur or submit?
- Tab order logical (naam → email → role → location → etc.)?
- Escape key closes dialog?
- Enter submits form or just tabs to next field?

**Question:** Does form validation happen on blur (real-time) or on submit?

**Success Criteria:**
- Tab order logical and navigable
- Escape closes dialog without saving
- Enter on last field submits or tabs to button
- Screen readers can identify required fields

---

#### **Flow 15: Keyboard Navigation — Step 2 Checkbox Selection**

**Trigger:** User navigates via Tab and Space to toggle checkboxes
**Assumptions:**
- Arrow keys navigate between match cards?
- Space toggles checkbox?
- Top-1 pre-checked via checkbox, not focus?

**Success Criteria:**
- Tab navigates through checkboxes
- Space toggles selection
- Disabled checkboxes skipped (Alt+Tab)
- Focus visible and clear

---

#### **Flow 16: Back Navigation Step 2 → Step 1 (Plan says "No")**

**Trigger:** User clicks "Terug" button (if provided) or browser back button
**Plan Decision:** No back navigation allowed
**Questions:**
- Is "Terug" button shown on Step 2?
- Does browser back button work or is it intercepted?
- What message if user tries back? (None? Toast? Modal?)

**Assumption:** No "Terug" button on Step 2; browser back allowed but skips to candidates list (no Step 1 re-edit)

**Success Criteria:**
- Step 1 → Step 2 is one-way
- Browser back doesn't re-open Step 1
- Candidate can be edited later from detail page

---

#### **Flow 17: Embedding API Failure (Fallback to Rule-Based Scoring)**

**Trigger:** POST to embedding API fails or returns error
**Steps:**

1. Step 1 submitted → POST `/api/kandidaten` succeeds, candidate persisted
2. Server attempts embedding generation → embedding API error (500, timeout, API key invalid)
3. **Question:** Does Step 2 proceed with rule-based scores only?
4. **Question:** Is user notified of degradation?
5. **Question:** Does matching return with full results or partial?

**Assumption:** Embedding API failure logged; matching proceeds with rule-based scoring; user shown results without special notification

**Success Criteria:**
- Matching continues even if embedding fails
- Rule-based scores computed and returned
- User sees matches (quality may be degraded)
- System resilience maintained

---

#### **Flow 18: Bulk Linking (Multiple Candidates via Vacancy Page)**

**Trigger:** User wants to link multiple candidates from vacancy-side dialog
**Steps:**

1. Open LinkCandidatesDialog on vacancy detail
2. Top-3 candidates shown, all pre-selected or user selects multiple
3. Confirm creates applications for all selected candidates in one request
4. **Question:** Single endpoint call with array of candidateIds? Or batch?

**Assumption:** POST `/api/opdrachten/[id]/koppel` accepts array of candidateIds; creates application per candidate

**Success Criteria:**
- Multiple candidates linked in single confirmation
- All applications created with same job, stage `screening`
- Results show created + already-linked summary

---

#### **Flow 19: Expired Vacancy During Linking (Job becomes inactive)**

**Trigger:** Vacancy deadline passes or is manually deactivated during Step 2
**Steps:**

1. Step 1 submitted, candidate created, embedding starts
2. Meanwhile: job deadline expires OR recruiter deactivates job
3. Step 2 matching runs → `listActiveJobs()` filters out expired jobs
4. Job no longer appears in top-3 results
5. **Question:** If it was top-1, what replaces it?

**Assumption:** `listActiveJobs()` excludes `applicationDeadline < now()`; results update accordingly

**Success Criteria:**
- Expired/inactive jobs never offered for linking
- User sees only active vacancies
- No stale data presented

---

#### **Flow 20: Skills & Experience with Empty Values**

**Trigger:** User submits Step 1 with empty skills or experience entries
**Questions:**
- Skills tag input: allow empty tags or force ≥1 tag?
- Experience entries: allow partial (title only, no company)?
- Should these fields be validated or just optional?

**Assumption:** Both optional; empty values ignored or filtered during submission

**Success Criteria:**
- Empty skills/experience filtered out
- Form accepts partial data
- Matching still runs with available data

---

#### **Flow 21: High-Velocity Recruiter (Repeat Candidate Creation)**

**Trigger:** Recruiter creates 3-5 candidates in rapid succession
**Questions:**
- Can user start new wizard while Step 2 of previous candidate still loading?
- Multiple dialogs open? Or single dialog manages state?
- UI state consistency across multiple candidates?

**Assumption:** Single AddCandidateWizard instance; closing Step 2 → Step 1 resets for next candidate

**Success Criteria:**
- No state collision between candidates
- Rapid candidate creation supported
- Each candidate persisted independently

---

#### **Flow 22: Editing Candidate After Wizard Completion**

**Trigger:** User linked candidate in wizard, then navigates to candidate detail page
**Questions:**
- Can user re-run matching from detail page?
- Can user re-submit Step 1 data for re-embedding?
- Does re-embedding create new matches or update existing?

**Assumption:** Existing detail page allows edit + manual re-match; wizard doesn't prevent this

**Success Criteria:**
- Wizard completion doesn't lock candidate for editing
- Candidate detail page accessible
- Manual matching still available

---

---

## Part 2: Flow Permutations Matrix

| **Flow** | **User Type** | **Entry Point** | **CV Uploaded?** | **Matches Found?** | **Already Linked?** | **Network OK?** | **Exit Point** | **App Created?** |
|----------|---------------|-----------------|------------------|-------------------|---------------------|-----------------|----------------|-----------------|
| 1 | Recruiter | New Dialog | Yes/No | 3+ | No | Yes | Success | ✓ (1+) |
| 2 | Recruiter | New Dialog | Yes/No | 0-2 (low score) | N/A | Yes | Empty State | ✗ |
| 3 | Recruiter | New Dialog | Yes/No | 3 (all linked) | Yes (all) | Yes | All Linked | ✗ |
| 4a | Recruiter | New Dialog | Partial | In Progress | N/A | Maybe | Escape (loading) | ✗ |
| 4b | Recruiter | New Dialog | Yes/No | 3+ | No | Yes | Escape (Step 2) | ✗ |
| 4c | Recruiter | New Dialog | Yes/No | 3+ | No | Yes | Browser Back | ✗ |
| 5 | Recruiter | New Dialog | Yes | 3+ (improved) | No | Yes | Success | ✓ (1+) |
| 6 | Recruiter | New Dialog | Yes/No | Slow (>15s) | N/A | Yes | Partial Results | ✓? |
| 7 | Recruiter | New Dialog | Partial | N/A | N/A | No (Step 1) | Error Toast | ✗ |
| 8 | Recruiter | New Dialog | Yes | N/A | N/A | No (Step 2) | Error (Skip?) | ✗ |
| 9 | Recruiter | New Dialog | Yes/No | 3+ | Mixed | No (Koppel) | Error (Retry?) | ? (partial) |
| 10 | Recruiter | Vacancy Detail | N/A | 3+ | Mixed | Yes | Success | ✓ (1+) |
| 11 | 2+ Recruiters | Concurrent | N/A | N/A | Yes (race) | Yes | Conflict | ✗ (dupe blocked) |
| 12 | Recruiter (Mobile) | New Dialog | Yes/No | 3+ | No | Yes | Success | ✓ (1+) |
| 13 | Recruiter (Mobile) | New Dialog | Yes/No | 3+ | No | Yes | Success (mobile) | ✓ (1+) |
| 14 | Recruiter (a11y) | New Dialog | Yes/No | 3+ | No | Yes | Success | ✓ (1+) |
| 15 | Recruiter (a11y) | New Dialog | Yes/No | 3+ | No | Yes | Success | ✓ (1+) |
| 17 | System | Auto | Yes/No | 3+ (rule-based) | No | Partial | Success (degraded) | ✓ (1+) |
| 18 | Recruiter | Vacancy Detail | N/A | 3+ | Mixed | Yes | Success | ✓ (2+) |
| 19 | System | Auto | Yes/No | 2-3 (filtered) | N/A | Yes | Success (fewer) | ✓ (0-3) |

---

## Part 3: Critical Gaps & Missing Specifications

### **Category 1: Error Handling & Failure States**

#### Gap 1.1: Step 2 Timeout Behavior
**Missing:** Explicit timeout threshold and degradation strategy
**Current spec:** "Show degraded results with rule-based scores if longer"
**Impact:** HIGH — UX could freeze if matching takes 20+ seconds
**Clarification needed:**
- Hard timeout at 15 seconds? Or soft warning at 10s?
- Show quick scores while waiting for full results?
- Cancel deep matching if exceeding threshold?
- Progress indicator (spinner, percentage, ETA)?

---

#### Gap 1.2: Embedding API Failure Path
**Missing:** What happens if embedding service is unavailable
**Current spec:** None
**Impact:** MEDIUM — Matching quality degrades silently
**Clarification needed:**
- Fallback to rule-based scoring? (Assume yes)
- Log error for monitoring?
- Notify user of degradation?
- Retry strategy for embedding?

---

#### Gap 1.3: Partial Application Creation on Network Failure
**Missing:** Transaction semantics for batch application creation
**Current spec:** None
**Impact:** HIGH — Potential inconsistent state
**Clarification needed:**
- If creating 3 applications and 2nd fails: rollback all or keep 1st?
- Idempotency key for retry safety?
- Unique constraint already prevents duplicates, but partial creates visible to user?

---

#### Gap 1.4: Step 1 Form Validation (Real-time vs. Submit)
**Missing:** When is validation applied?
**Current spec:** None (only "naam required, rol required at UI")
**Impact:** MEDIUM — UX feedback timing unclear
**Clarification needed:**
- Validate `naam` on blur? Or only on submit?
- Validate email format real-time or on submit?
- Show inline errors or toast after submit?
- Required field indicators (`*`)?

---

#### Gap 1.5: "Terug" Button on Step 2 Behavior
**Missing:** Should "Terug" button exist, and what does it do?
**Current spec:** Plan says "No back navigation" but unclear about UX
**Impact:** MEDIUM — User expectations mismatch
**Clarification needed:**
- Is "Terug" button shown or hidden?
- If hidden: how do users know they can't edit Step 1?
- If shown: does it return to Step 1 or close wizard?
- Browser back button behavior?

---

### **Category 2: Data Consistency & Idempotency**

#### Gap 2.1: Step 1 Persistence on Partial Completion
**Missing:** Exact behavior when user exits after Step 1 submit
**Current spec:** "Candidate saved to talentpool only"
**Impact:** MEDIUM — User expectation: is candidate visible immediately?
**Clarification needed:**
- Candidate persisted with all fields provided?
- Embedding generated immediately or async?
- If async: user sees "pending" or final state?
- Can user re-open wizard and see Step 2 with old matches?

---

#### Gap 2.2: Idempotency Key Strategy
**Missing:** How to prevent duplicate applications on retry
**Current spec:** None
**Impact:** HIGH — Critical for network error recovery
**Clarification needed:**
- Per (candidateId, jobId) pair? Or explicit idempotency key?
- TTL on idempotency key (24h? 1h? session-scoped)?
- Server-side deduplication or client-side retry logic?

---

#### Gap 2.3: Match Results Caching
**Missing:** Should POST `/api/kandidaten/[id]/match` cache results?
**Current spec:** None
**Impact:** MEDIUM — Performance & consistency
**Clarification needed:**
- If user clicks "Terug" then "Volgende" again: recompute or cached?
- Cache TTL?
- Invalidate cache on profile edit?

---

#### Gap 2.4: Application Stage Semantics
**Missing:** Why always `"screening"` stage, not `"new"`?
**Current spec:** "Per spec; configurable later"
**Impact:** MEDIUM — Pipeline visibility & stage semantics
**Clarification needed:**
- Is `"screening"` stage a special "auto-matched" stage?
- What happens when recruiter moves application to next stage?
- Can applications be created in other stages (e.g., `"interview"`)?
- Reasoning for bypassing `"new"` stage?

---

### **Category 3: UI/UX Clarity**

#### Gap 3.1: Match Card UI Details
**Missing:** Visual design of match cards
**Current spec:** "Score ring, reasoning summary"
**Impact:** MEDIUM — Implementation ambiguity
**Clarification needed:**
- Score ring: circular progress indicator? Or numerical badge?
- Reasoning summary: full text? Truncated at 100 chars?
- Vacancy details shown: title, company, location, salary range?
- On hover/focus: expand reasoning?

---

#### Gap 3.2: "Al gekoppeld" Badge Placement & Interaction
**Missing:** Visual prominence and disabled state
**Current spec:** "Badge on already-linked vacancies (disabled checkbox)"
**Impact:** LOW — Visual clarity
**Clarification needed:**
- Badge on right side of card? Bottom-right?
- Badge color/style (gray, striped, opacity)?
- Tooltip on disabled checkbox: "Already linked" text?
- Can user expand to see when/by whom it was linked?

---

#### Gap 3.3: Empty State Copy & Next Steps
**Missing:** What to do when no matches found
**Current spec:** "Geen passende vacatures gevonden. Sla kandidaat op in talentpool en match later."
**Impact:** LOW — User guidance
**Clarification needed:**
- Should empty state suggest editing profile to improve matches?
- Link to manual matching page?
- Suggest uploading CV?
- Estimation: "Try again in X days when new vacancies posted"?

---

#### Gap 3.4: Loading State Messaging
**Missing:** Progression of messages during matching
**Current spec:** "Bezig met matchen..."
**Impact:** LOW — User comfort
**Clarification needed:**
- Single message for entire 2-14s wait?
- Progressive messages: "Embedding..." → "Matching..." → "Retrieving scores..."?
- Estimated time: "Dit kan 10-20 seconden duren"?
- Spinner style (ring, dots, progress bar)?

---

#### Gap 3.5: Success Message After Koppeling
**Missing:** Confirmation feedback after linking
**Current spec:** "Success closes dialog and refreshes router"
**Impact:** MEDIUM — User certainty
**Clarification needed:**
- Toast notification? Modal? Just close + refresh?
- Message content: "X applications created" or "Kandidaat gekoppeld aan X vacatures"?
- Toast duration: auto-close after 3s?
- Navigation: close dialog, refresh current page or navigate elsewhere?

---

### **Category 4: Mobile & Responsive Design**

#### Gap 4.1: Dialog Height on Mobile (< 500px)
**Missing:** Responsive dialog behavior
**Current spec:** "Mobile responsive (dialog scrollable on small screens)"
**Impact:** MEDIUM — Mobile usability
**Clarification needed:**
- Max dialog height on mobile? (vh - header - footer)
- Scrollable content inside dialog?
- Fixed header + footer with scrolling form body?
- Confirm/Skip buttons fixed at bottom or in scroll area?

---

#### Gap 4.2: Match Card Layout on Tablet (640px - 1024px)
**Missing:** 2-column, 3-column, or single-column on tablet
**Current spec:** None
**Impact:** LOW — Visual hierarchy
**Clarification needed:**
- Tablet landscape: 2 columns or still 1 column?
- Card width constraints (300px, 400px)?

---

#### Gap 4.3: File Upload on Mobile
**Missing:** Specific mobile file upload UX
**Current spec:** CV upload preserved from existing dialog
**Impact:** MEDIUM — Mobile file handling
**Clarification needed:**
- Camera capture option for photos? Or file browser only?
- Drag-and-drop on mobile (no, but label "tap to select")?
- File preview after selection?

---

#### Gap 4.4: Keyboard Display on Mobile (Input Focus)
**Missing:** Mobile keyboard management
**Current spec:** None
**Impact:** LOW — Touch UX finesse
**Clarification needed:**
- Viewport adjusts when keyboard appears?
- Focus on first field on Step 1 open?
- Close keyboard after field blur?

---

### **Category 5: Accessibility (a11y)**

#### Gap 5.1: Screen Reader Announcements
**Missing:** ARIA labels for dynamic Step 2 loading & matching
**Current spec:** "Keyboard accessible (Tab, Enter, Escape)"
**Impact:** MEDIUM — Inclusive UX
**Clarification needed:**
- ARIA live region for "Bezig met matchen..." message?
- Screen reader announces "3 matches found"?
- Disabled checkboxes announced as "already linked"?
- Focus management on Step transition?

---

#### Gap 5.2: Required Field Indicators
**Missing:** How required fields indicated for a11y
**Current spec:** "naam required, rol required (UI)"
**Impact:** MEDIUM — Form accessibility
**Clarification needed:**
- Asterisk (*) + aria-required="true"?
- Text label: "(required)" in English or Dutch?
- Color + icon + text (accessible to colorblind users)?

---

#### Gap 5.3: Match Card Semantic Structure
**Missing:** Proper heading levels & ARIA roles
**Current spec:** None
**Impact:** MEDIUM — Screen reader navigation
**Clarification needed:**
- Each match card: `<article role="option">` with checkbox?
- Heading hierarchy for vacancy title?
- Score announced as text or visual only?

---

#### Gap 5.4: Keyboard Tab Order on Step 1
**Missing:** Exact tab order through form
**Current spec:** None
**Impact:** MEDIUM — Keyboard navigation usability
**Clarification needed:**
- Tab order: naam → email → phone → role → location → ... → submit button?
- Required fields first? Or natural reading order?
- CV file input: labeled and labeled correctly?
- Tab order consistent with left-to-right layout?

---

### **Category 6: Data Lifecycle & Persistence**

#### Gap 6.1: CV File Storage Location
**Missing:** Where CV files stored and how persisted
**Current spec:** None
**Impact:** MEDIUM — Implementation dependency
**Clarification needed:**
- File system? Cloud storage (S3, GCS)?
- Database BYTEA column?
- Public or private access?
- Retention policy (delete after X days? GDPR compliance)?

---

#### Gap 6.2: Candidate Visibility in Talentpool Immediately After Step 1
**Missing:** Timing of candidate appearing in candidate list
**Current spec:** "Candidate saved to talentpool"
**Impact:** MEDIUM — UX consistency
**Clarification needed:**
- Appears immediately after Step 1 submit?
- Appears after Step 2 confirmation (even if no links)?
- Has embedding status indicator (pending vs. complete)?
- Filterability (show candidates with pending embedding)?

---

#### Gap 6.3: Match Records vs. Application Records
**Missing:** Lifecycle and semantics of `jobMatches` vs. `applications`
**Current spec:** Applications link to matchId for traceability
**Impact:** MEDIUM — Data model clarity
**Clarification needed:**
- Is `jobMatches` record always created before `application`?
- Can `jobMatches` exist without `application`?
- If recruiter manually links (not via wizard): create `jobMatches` first?
- Can `jobMatches` be approved/rejected independently of `application` stage?

---

#### Gap 6.4: Skills & Experience Data Structure
**Missing:** Schema for skills and experience objects
**Current spec:** "skills: string[], experience: { title, company, duration }[]"
**Impact:** MEDIUM — API contract clarity
**Clarification needed:**
- Duration format: "2 years", "24 months", "2018-2020"?
- Skills: free-text strings or predefined list?
- Can skills have proficiency level (e.g., "Python: 5 years")?
- Experience: is `duration` a string or number (months)?

---

### **Category 7: Integration & System Behavior**

#### Gap 7.1: Revalidation Paths After Application Creation
**Missing:** Which routes revalidated after linking
**Current spec:** `/professionals, /pipeline, /overzicht, /opdrachten, /professionals/[id]`
**Impact:** MEDIUM — Data freshness
**Clarification needed:**
- On-demand revalidation or scheduled ISR (Incremental Static Regeneration)?
- All routes revalidated? Or selective?
- Any delay in UI refresh? (Users may see stale talentpool count.)

---

#### Gap 7.2: Event Publishing ("application:created")
**Missing:** Event schema and consumption
**Current spec:** "Publish 'application:created' events (existing pattern)"
**Impact:** LOW — System integrations
**Clarification needed:**
- Event payload: { applicationId, candidateId, jobId, stage, source, matchId }?
- Subscribers: chat system, notifications, webhooks?
- Guaranteed delivery or fire-and-forget?

---

#### Gap 7.3: Multi-Workspace or Tenant Isolation
**Missing:** Scope of matching & linking within org/workspace
**Current spec:** None
**Impact:** HIGH (if multi-tenant) — Data isolation
**Clarification needed:**
- Single recruiter workspace assumed?
- If multi-tenant: filter active jobs by workspace?
- Matching visible only to recruiter's workspace?

---

#### Gap 7.4: Concurrent Embedding Requests
**Missing:** What if recruiter creates 5 candidates simultaneously
**Current spec:** None
**Impact:** MEDIUM — Resource management
**Clarification needed:**
- Queue embeddings or fire-and-forget?
- Rate limit embedding API (max 5 concurrent)?
- User sees "queued" status if embedding delayed?

---

### **Category 8: Performance & Scalability**

#### Gap 8.1: Matching Performance for Large Job Pools
**Missing:** Behavior with 10,000+ active jobs
**Current spec:** None
**Impact:** MEDIUM — Scalability
**Clarification needed:**
- Query `listActiveJobs()` with 10k+ rows: index on (deletedAt, applicationDeadline)?
- Sorting/ranking 10k jobs per candidate: done in-database or in-memory?
- Top-3 selection: efficient implementation?

---

#### Gap 8.2: Embedding Generation Timeout
**Missing:** What if embedding takes > 30 seconds
**Current spec:** Matching timeout 15s, but embedding is separate
**Impact:** MEDIUM — Step 1 UX timeout
**Clarification needed:**
- Does embedding happen synchronously or async after candidate persist?
- If async: user sees loading indefinitely, or "processing in background"?
- If timeout: fallback to rule-based immediately?

---

#### Gap 8.3: Batch Koppeling Performance
**Missing:** Creating 50 applications in one request performance
**Current spec:** None
**Impact:** LOW — Edge case
**Clarification needed:**
- Is there a max batch size (e.g., 50 applications per request)?
- Transaction semantics (all-or-nothing or partial)?
- Timeout risk for large batches?

---

### **Category 9: Specification Ambiguities**

#### Gap 9.1: "Active" Job Definition
**Missing:** Precise definition of `listActiveJobs()`
**Current spec:** "deletedAt IS NULL AND applicationDeadline not expired"
**Impact:** MEDIUM — Matching correctness
**Clarification needed:**
- `applicationDeadline < now()` → job inactive?
- Or `endDate < now()` → job inactive?
- Or both?
- Jobs with no deadline: always active?

---

#### Gap 9.2: Top-N Selection Criteria
**Missing:** How top-3 selected from candidates sorted by score
**Current spec:** "Top-3 matching vacancies with scores"
**Impact:** MEDIUM — Matching transparency
**Clarification needed:**
- Top-3 by highest score?
- Ties broken by recency (newest job first)?
- Ties broken by salary proximity?
- Location preference factored in?

---

#### Gap 9.3: Pre-Selection Logic (Top-1)
**Missing:** How top-1 determined for pre-selection
**Current spec:** "Top-1 is pre-selected"
**Impact:** LOW — UX convenience
**Clarification needed:**
- Highest score is pre-selected?
- User can deselect all and confirm 0 jobs? Or force ≥1 selection?
- If user deselects top-1, can re-select it?

---

#### Gap 9.4: MIN_SCORE Threshold
**Missing:** How MIN_SCORE = 40 applied
**Current spec:** None in plan, but present in auto-matching.ts
**Impact:** MEDIUM — Match quality
**Clarification needed:**
- Does `listActiveJobs()` filter jobs by score or just return top-3?
- If score < 40 for all candidates: show empty state?
- Score < 40 shown in UI with warning or hidden?

---

### **Category 10: Polish & Edge Cases**

#### Gap 10.1: Dialog Close Confirmation
**Missing:** Should dialog ask for confirmation before closing if form dirty
**Current spec:** None
**Impact:** LOW — User mistake recovery
**Clarification needed:**
- If Step 1 form filled but not submitted, and user closes dialog: confirm?
- If Step 2 matches shown and user closes: confirm (candidate already saved)?

---

#### Gap 10.2: Candidate Creation Success Feedback
**Missing:** What confirmation shown after Step 1 before Step 2 loads
**Current spec:** "Transition to Step 2"
**Impact:** LOW — User feedback
**Clarification needed:**
- Show brief success message? Or silently transition?
- Toast "Kandidaat opgeslagen" or no message?

---

#### Gap 10.3: Accessibility of Match Scores
**Missing:** How to present scores accessibly (not color-only)
**Current spec:** "Score ring visualization"
**Impact:** MEDIUM — Accessible design
**Clarification needed:**
- Score ring: circular progress? Or numerical badge with text?
- Color + number + text: "85/100 - Excellent match"?
- Reasoning summary includes key matching factors?

---

#### Gap 10.4: Localization / Dutch UI Strings
**Missing:** Complete list of UI strings (Dutch)
**Current spec:** "Dutch UI labels throughout"
**Impact:** MEDIUM — Implementation detail
**Clarification needed:**
- All strings in Dutch or code references? (TBD with i18n)
- Specific wording for error messages, empty states, buttons?

---

---

## Part 4: Critical Questions Requiring Clarification

### **CRITICAL (Blocks Implementation)**

#### C1: Timeout Behavior for Matching >15 seconds
**Priority:** CRITICAL
**Question:** What exactly happens if Step 2 matching takes > 15 seconds?

**Why it matters:** Step 1 successfully persisted candidate, but if Step 2 hangs, user doesn't know if matching failed, is still loading, or timed out. Timeout handling directly impacts UX stability.

**Current ambiguity:**
- Plan states "Show degraded results with rule-based scores if longer"
- But no definition of timeout threshold, detection mechanism, or UX transition

**Specific clarifications needed:**
1. Is 15 seconds a hard timeout (cancel request, show error) or soft warning (show quick scores, keep waiting)?
2. When do we show "degraded results"?
   - Option A: Show quick scores immediately, keep waiting for full scores in background, replace with full when ready
   - Option B: Show quick scores at 10s, cancel deep matching at 15s
   - Option C: Show full results whenever ready, no timeout (just slow UI)
3. How is user notified of state transitions? (e.g., "Loading full matches..." → "Showing quick scores..." → results)
4. Can user click "Skip" while matching in progress?

**Assumption if unanswered:** Show quick scores at 3s, continue loading up to 15s, then show whichever results are available (quick or full)

**Example scenario:**
- User creates candidate with sparse profile (no CV, minimal skills)
- Embedding completes at 2s
- Quick scoring (rule-based) completes at 3s → show 3 matches with scores
- Deep matching starts → takes 10-12s
- Results updated at 12s with full structured matching scores
- User sees smooth progression: loading → quick scores → refined scores

---

#### C2: Idempotency & Race Condition Prevention
**Priority:** CRITICAL
**Question:** How should the system prevent duplicate applications if two recruiters simultaneously link the same candidate to the same job?

**Why it matters:** Database has UNIQUE constraint `(jobId, candidateId)` on applications, so second insert fails. But user doesn't know which error response they'll get, and no recovery strategy defined.

**Current ambiguity:**
- Constraint prevents duplicates at database level ✓
- But API error response not specified
- No idempotency key / request deduplication defined
- Retry behavior undefined

**Specific clarifications needed:**
1. If POST `/api/kandidaten/[id]/koppel` with [jobId1, jobId2, jobId3] and jobId2 already linked:
   - Option A: Create jobId1 + jobId3, fail on jobId2 → partial success (2 of 3)
   - Option B: Rollback all, return error "1 vacancy already linked"
   - Option C: Skip already-linked, silently create others (all 2 succeed)
2. Should endpoint response indicate "already linked" gracefully (e.g., `{ created: [jobId1], alreadyLinked: [jobId2] }`)?
3. If network error during batch creation:
   - Idempotency key to safely retry?
   - How long to keep idempotency key (1 hour, 24 hours, per-session)?

**Assumption if unanswered:** Option C — skip already-linked jobs, silently create others, return `{ created: [jobId1, jobId3], alreadyLinked: [jobId2] }`

**Example scenario:**
- Recruiter A on candidate page confirms: Job X, Job Y, Job Z
- Recruiter B on Job Y page confirms same candidate
- Both POST simultaneously
- Recruiter B's link succeeds first
- Recruiter A's POST tries to create (candidateId, Y) → constraint violation
- A's response: `{ created: [jobId_X, jobId_Z], alreadyLinked: [jobId_Y], message: "Job Y was already linked" }`
- A sees toast: "Gekoppeld aan 2 van 3 vacatures. 1 was al gekoppeld."

---

#### C3: Step 1 Validation Timing & Error Recovery
**Priority:** CRITICAL
**Question:** When is form validation applied, and what's the recovery path if Step 1 submit fails?

**Why it matters:** User fills form, clicks "Volgende", and either gets validation error or network error. No spec for error UX or form state.

**Current ambiguity:**
- Required fields: `naam`, `rol` (but unclear if role is API-required or UI-only)
- Email, phone, location, rate, etc.: no validation spec
- Network error recovery: retry button? Form persists?

**Specific clarifications needed:**
1. Is validation applied on blur (real-time) or only on form submit?
   - Option A: Real-time validation (form feedback as user types)
   - Option B: Submit-time validation (error toast after click)
   - Option C: Blur validation (validate field when user tabs out)
2. For `rol` field: is it required at API level or UI level only?
   - Current plan: "required (UI level)" but unclear enforcement
3. If POST `/api/kandidaten` fails (e.g., 500 error):
   - Show error toast with "Retry" button?
   - Form data persists for retry?
   - "Continue anyway" option?
4. If email already exists in database:
   - Error? Merge with existing candidate?
   - Unique constraint on email (partial, where email IS NOT NULL)?

**Assumption if unanswered:** Submit-time validation, `rol` UI-only, network errors show toast with retry, form data persists

**Example scenario:**
- User fills: naam="Jan", rol="Backend Developer", email="jan@example.com"
- User clicks "Volgende"
- POST `/api/kandidaten` → server returns 500 (database unavailable)
- Toast shown: "Fout bij opslaan kandidaat. Probeer opnieuw."
- Form still filled, user clicks retry, succeeds
- Transition to Step 2

---

#### C4: CV Upload During Step 1 & Impact on Matching Quality
**Priority:** CRITICAL
**Question:** Does CV uploaded in Step 1 improve matching results shown in Step 2, and what happens if CV parsing fails?

**Why it matters:** Plan states "CV significantly improves match quality" but doesn't clarify if this affects immediate Step 2 results or only future re-matches.

**Current ambiguity:**
- CV uploaded → text extracted → embedding updated
- Does embedding include CV content before Step 2 matching?
- What if CV extraction fails (corrupt PDF, etc.)?
- Fallback to profile data only?

**Specific clarifications needed:**
1. Timeline:
   - POST `/api/kandidaten` with CV file → does server parse immediately or async?
   - If async: does Step 2 use old (profile-only) embedding or wait for CV-enriched embedding?
   - How long does CV parsing add to Step 1 submit latency?
2. CV extraction failure:
   - Option A: Continue with rule-based embedding, show quality warning to user
   - Option B: Block Step 2 transition, show error "CV parsing failed. Try uploading again."
   - Option C: Try alternative parsing method (OCR if PDF fails)
3. Which embedding used in Step 2 matching?
   - Profile data (skills, experience, role) only?
   - Profile + CV text combined?
   - Which model/method?

**Assumption if unanswered:** CV parsed synchronously, Step 2 embedding includes CV content, extraction failure degrades gracefully to profile-only matching

**Example scenario:**
- User uploads CV (5 years experience, Java/Python specialist)
- CV text extracted: "I've worked on backend services using Java and Python..."
- Embedding generated from profile + CV text
- Step 2 shows matching Java/Python jobs at top (improved by CV content)
- Without CV: matching would be rule-based only (worse quality)

---

#### C5: Step 2 Abandonment & Candidate Visibility
**Priority:** CRITICAL
**Question:** If user completes Step 1 but exits Step 2 without confirming links, what's the final state?

**Why it matters:** Defines whether candidate exists in talentpool without applications, or if Step 2 is mandatory to persist candidate.

**Current ambiguity:**
- Plan: "Candidate saved to talentpool only if Step 2 skipped"
- But unclear if "skipped" means explicitly pressing "Skip" or exiting wizard

**Specific clarifications needed:**
1. If user closes dialog during Step 2 loading (before matches shown):
   - Candidate persisted? Yes
   - Can user search for candidate in talentpool? Yes
   - Can recruiter re-open wizard and see Step 2 again? (With cached matches or fresh?)
2. If user closes dialog on Step 2 (after matches shown) without confirming:
   - Candidate persisted? Yes
   - Matches preserved for later re-match? (Or compute fresh next time?)
3. If user clicks "Skip" button on Step 2:
   - Candidate persisted? Yes
   - Show success message? ("Kandidaat opgeslagen in talentpool")
   - Dialog closes? Yes
   - Can user later link manually from candidate detail page? Yes (assumed)

**Assumption if unanswered:** Step 1 persists candidate immediately; Step 2 exit (any method) saves candidate without applications; user can re-open wizard and matches recomputed or cached based on latest candidate data

**Example scenario:**
- User creates candidate in Step 1
- Step 2 loads, matches displayed
- User is called away, closes dialog without confirming
- Candidate now visible in talentpool, but no applications created
- Later: recruiter can manually link candidate from detail page or re-open wizard to see matches again

---

### **IMPORTANT (Significantly Affects UX or Maintainability)**

#### I1: Mobile & Responsive Dialog Height
**Priority:** IMPORTANT
**Question:** How should dialog behave on mobile (viewport < 640px)?

**Why it matters:** Step 1 form with skills, experience, CV, and Step 2 with 3 match cards might overflow small screen. No spec for scrolling, fixed footer, etc.

**Current ambiguity:**
- Plan: "Mobile responsive (dialog scrollable on small screens)"
- But no detail on dialog height, button positioning, content overflow

**Specific clarifications needed:**
1. Dialog max height on mobile (iPhone SE at 667px height)?
   - Option A: 90vh (cover most, leave status bar/keyboard)
   - Option B: Full viewport (100vh)
   - Option C: Constrain to 400px and scroll aggressively
2. Where are Confirm/Skip buttons on mobile Step 2?
   - Option A: Fixed footer outside scroll area (always visible)
   - Option B: Inside scroll area (user must scroll down to confirm)
   - Option C: Sticky (appears when user stops scrolling)
3. Form scrolling on Step 1 (mobile):
   - Scrollable inside dialog?
   - Or full-page scroll with fixed header/footer?

**Assumption if unanswered:** Dialog max-height ~90vh, scrollable content inside, fixed footer with buttons (always visible)

---

#### I2: "Al gekoppeld" Badge & Disabled State UX
**Priority:** IMPORTANT
**Question:** How should already-linked vacancies be visually distinguished and made non-selectable?

**Why it matters:** User needs to know which vacancies are already linked and understand why checkboxes are disabled.

**Current ambiguity:**
- Plan: "Al gekoppeld badge on already-linked vacancies (disabled checkbox)"
- But no visual mockup, placement, color, or tooltip spec

**Specific clarifications needed:**
1. Visual treatment:
   - Badge text & color? ("Al gekoppeld" in gray/red badge?)
   - Card opacity reduced? (Faded 50% opacity)
   - Strikethrough text?
   - Combination: badge + opacity?
2. Checkbox disabled state:
   - Gray checkbox? Or hidden?
   - Tooltip on hover: "Already linked on [date]" or just "Already linked"?
3. Can user click card to expand and see details of existing application?
   - When linked? By whom? Status?

**Assumption if unanswered:** Gray badge "Al gekoppeld", checkbox disabled + grayed, card slightly faded (70% opacity)

---

#### I3: Empty State Messaging & Recovery Path
**Priority:** IMPORTANT
**Question:** When no matches found, what guidance should user receive?

**Why it matters:** User frustrated with no suggestions; plan text is generic. Clear guidance improves candidate quality.

**Current ambiguity:**
- Plan: "Geen passende vacatures gevonden. Sla kandidaat op in talentpool en match later."
- But no guidance on profile improvement, alternative actions, or timeline

**Specific clarifications needed:**
1. Should UI suggest:
   - "Upload CV to improve matching"?
   - "Add skills or experience for better matches"?
   - Link to candidate detail page to edit?
2. Suggested actions:
   - Option A: "Skip" to save and come back later
   - Option B: "Terug" to edit profile and re-match
   - Option C: Both
3. Timing:
   - "Check back when new vacancies posted"? (When? Daily? Weekly?)
   - Or encourage manual matching from detail page?

**Assumption if unanswered:** Show "Skip" and "Terug" buttons; copy includes "Add skills or upload CV for better matches"

---

#### I4: Error Toast vs. Inline Validation
**Priority:** IMPORTANT
**Question:** Should form errors be shown as inline field errors or toast notifications?

**Why it matters:** UX consistency and accessibility. Inline errors are more discoverable; toasts can be missed.

**Current ambiguity:**
- Plan: No error UX specified
- Existing dialog pattern: (would need to check current implementation)

**Specific clarifications needed:**
1. Step 1 validation errors:
   - Required field missing: inline red text under field or toast?
   - Invalid email format: inline or toast?
   - File size exceeded: inline or toast?
2. Server validation errors (duplicate email, etc.):
   - Inline (show beneath email field)?
   - Toast (user-level notification)?
3. Are errors announced to screen readers?
   - aria-invalid="true" + aria-describedby pointing to error?

**Assumption if unanswered:** Required field errors inline (aria-invalid), server errors as toasts (email already exists), with accessibility annotations

---

#### I5: Keyboard Navigation Tab Order (Complete)
**Priority:** IMPORTANT
**Question:** What is the exact tab order through Step 1 and Step 2?

**Why it matters:** Keyboard-only users must be able to navigate form logically.

**Current ambiguity:**
- Plan: "Tab, Enter, Escape" listed as acceptable criteria
- But no actual tab order defined

**Specific clarifications needed:**
1. Step 1 tab order:
   - Linear: naam → email → phone → role → location → rate → availability → LinkedIn → CV → notes → "Volgende"?
   - Or: required fields first, then optional?
   - Or: by visual layout left-to-right, top-to-bottom?
2. Skills & experience inputs:
   - Tab through each skill tag and remove button?
   - Tab to "Add skill" button to add more?
   - Experience: repeating structure—tab through each, then "Add experience" button?
3. CV file input:
   - Separate tab stop for file input?
   - One for "Select file", another for remove button (if file selected)?
4. Step 2 tab order:
   - Tab through each match card's checkbox?
   - Arrow keys to navigate between cards?
   - Tab to "Confirm" and "Skip" buttons after all cards?

**Assumption if unanswered:** Linear reading order (top-to-bottom, left-to-right), required fields first, then optional, skills/experience with inline add/remove buttons, Tab to Confirm/Skip at end

---

#### I6: Concurrent Embedding Requests During Bulk Candidate Creation
**Priority:** IMPORTANT
**Question:** If recruiter creates 5 candidates rapidly, how many embedding requests fire simultaneously?

**Why it matters:** Embedding API has rate limits; unbounded concurrent requests could exhaust quota or slow system.

**Current ambiguity:**
- Plan: No mention of queue or rate limiting
- Auto-matching service: awaits embedding for each candidate (line 186 in auto-matching.ts)

**Specific clarifications needed:**
1. Embedding concurrency:
   - Option A: Fire all 5 simultaneously (no queue)
   - Option B: Queue with max 2-3 concurrent (rate-limited)
   - Option C: Async queue, user sees "Processing in background"
2. User feedback if queued:
   - Show "Queued for embedding" instead of "Loading"?
   - Can user leave wizard and come back later?
3. What if one embedding fails?
   - Retry? Backoff? Fallback to rule-based?
   - Does failure block other embeddings in queue?

**Assumption if unanswered:** Fire embeddings concurrently without queue (let database/API handle limits), show standard "Loading" spinner, fallback to rule-based if API unavailable

---

#### I7: Application Stage Semantics & Pipeline Visibility
**Priority:** IMPORTANT
**Question:** Why do applications created via wizard start in `"screening"` stage instead of `"new"`?

**Why it matters:** Pipeline stage semantics affect workflow. Starting in "screening" implies candidate already pre-screened by AI, which may be misleading.

**Current ambiguity:**
- Plan: "Applications created in screening stage"
- Rationale: "Per spec; configurable later if needed"
- Inconsistency: existing `createApplication()` defaults to `"new"`

**Specific clarifications needed:**
1. Semantic meaning:
   - "new" = just created, not yet reviewed
   - "screening" = pre-screened by AI, moved to screening by system
   - Is starting in "screening" accurate?
2. User expectation:
   - If recruiter sees application in "screening" stage, do they think:
     - Option A: AI already vetted candidate (no further screening needed)?
     - Option B: Application awaiting recruiter's screening review?
   - Plan doesn't clarify distinction
3. Pipeline stage workflow:
   - Can recruiter move "screening" → "interview" directly?
   - Or must interview happen before interview stage?
   - How do "screening" stage and interview stage relate?

**Assumption if unanswered:** "screening" stage is intermediate (AI pre-screened), allows recruiter to move to interview or rejection without further action. Or change to "new" and let recruiters manually screen.

---

#### I8: Match Records Lifecycle vs. Application Lifecycle
**Priority:** IMPORTANT
**Question:** When application deleted, what happens to corresponding `jobMatches` record?

**Why it matters:** Data consistency. If recruiter rejects application, should match record be deleted or marked differently?

**Current ambiguity:**
- Plan: "Applications link to matchId for traceability"
- Schema: `applications.matchId` references `jobMatches.id`, but no ON DELETE clause specified

**Specific clarifications needed:**
1. Foreign key constraint:
   - ON DELETE SET NULL (match survives, application deleted)
   - ON DELETE CASCADE (deleting application deletes match)
   - ON DELETE RESTRICT (can't delete application if match exists)
2. Application deletion semantics:
   - Soft-delete (deletedAt timestamp)? Or hard delete?
   - Current: applications use soft-delete (deletedAt column)
   - Do matches also soft-delete?
3. Match approval/rejection:
   - Can recruiter reject a `jobMatches` record independently?
   - If match is rejected, is application prevented?

**Assumption if unanswered:** Soft-delete on both, ON DELETE SET NULL (match survives application deletion), match records can be reviewed independently

---

### **NICE-TO-HAVE (Improves Clarity But Has Reasonable Defaults)**

#### N1: Estimated Time for Step 2 Matching
**Question:** Should UI show estimated time for matching completion?

**Nice-to-have:** "Dit zal ongeveer 10-20 seconden duren"
**Improves:** User patience and expectation-setting
**Default:** Show generic spinner without time estimate

---

#### N2: Candidate Enrichment Suggestions
**Question:** Should Step 2 show structured suggestions on improving candidate match (e.g., "Add Java skill", "Update location")?

**Nice-to-have:** Personalized guidance based on top matches
**Improves:** Candidate profile quality, recruiter education
**Default:** No suggestions, just show matches

---

#### N3: Match Explanation Detail Level
**Question:** Should reasoning text be truncated or expandable in match card?

**Nice-to-have:** Click "More" to expand full reasoning
**Improves:** UX on dense Step 2 cards
**Default:** Show full reasoning text (may be long)

---

#### N4: Hiring Manager Notifications
**Question:** Should hiring manager be notified when candidate linked to their vacancy via wizard?

**Nice-to-have:** Email or in-app notification
**Improves:** Workflow awareness
**Default:** No notification (hiring manager must check pipeline)

---

#### N5: Candidate Self-Service Linking
**Question:** Should candidates see matching vacancies and self-select (instead of recruiter only)?

**Nice-to-have:** Candidate portal with self-linking
**Improves:** Candidate engagement
**Default:** Recruiter-only linking

---

#### N6: Bulk Import of Candidates
**Question:** Should Step 1 support importing multiple candidates from CSV?

**Nice-to-have:** Batch candidate creation
**Improves:** Bulk workflow
**Default:** Single candidate per dialog

---

#### N7: Match Filtering Options
**Question:** Should Step 2 allow filtering matches (e.g., by location, salary range) before confirming?

**Nice-to-have:** Refine suggestions
**Improves:** User control
**Default:** Show all top-3 as-is

---

#### N8: Undo Application Creation
**Question:** Should user be able to undo linking immediately after confirmation?

**Nice-to-have:** "Undo" button in success toast (10s window)
**Improves:** Mistake recovery
**Default:** Permanent after confirmation

---

#### N9: A/B Test Different Matching Models
**Question:** Should system randomly assign candidates to different matching algorithms for A/B testing?

**Nice-to-have:** Experimentation framework
**Improves:** Continuous improvement
**Default:** Single algorithm only

---

#### N10: Detailed Match Audit Trail
**Question:** Should Step 2 show which criteria passed/failed for each match?

**Nice-to-have:** "Required skills: 3/5 matched ✓", "Location: Remote preferred vs. Hybrid ✗"
**Improves:** Recruiter confidence
**Default:** Only high-level reasoning text

---

---

## Part 5: Recommended Next Steps

### **Phase 1: Clarification & Specification** (1-2 days)

1. **Create Clarification Document** with answers to all CRITICAL questions
   - Timeout behavior for matching >15s
   - Idempotency & race condition handling
   - Step 1 validation timing & recovery
   - CV impact on Step 2 matching
   - Step 2 abandonment final state

2. **Create UI Mockups/Wireframes** showing:
   - Step 1 form layout (required fields, optional sections)
   - Step 2 match cards (badge placement, disabled states)
   - Mobile responsive behavior (dialog height, button positioning)
   - Error states (toast, inline validation)
   - Loading states (spinner progression, messages)

3. **Define Exact Tab Order** in accessibility spec
   - Step 1 tab sequence
   - Step 2 keyboard navigation
   - Required ARIA attributes

4. **Finalize Dutch UI Strings**
   - All labels, error messages, empty states, buttons
   - Create shared i18n file for consistency

5. **Schema Finalization**
   - Skills: free-text or enum?
   - Experience duration: string or number format?
   - CV file storage location (S3, filesystem, database)?
   - Foreign key constraints (applications → matches)

---

### **Phase 2: Test Planning** (1 day)

1. **Happy Path Test Plan**
   - Create candidate → Step 2 matching → confirm links → verify applications created

2. **Error Path Test Plan**
   - Network errors at each step
   - Form validation failures
   - No matches found
   - All matches already linked
   - Timeout during matching (>15s)

3. **Accessibility Test Plan**
   - Keyboard navigation (Tab, Space, Escape, Enter)
   - Screen reader announcements (ARIA live regions)
   - Color contrast (match card badges, disabled states)

4. **Mobile Test Plan**
   - Responsive dialog on 320px, 480px, 640px widths
   - Touch targets (buttons, checkboxes)
   - Keyboard display impact (mobile keyboard height)

5. **Performance Test Plan**
   - Matching latency (target <15s, ideally <5s)
   - Concurrent embedding requests (scale to 10+ simultaneous candidates)
   - Large job pool (10k+ active jobs, matching performance)

---

### **Phase 3: Implementation Checklist** (Before coding)

1. **Verify Endpoints**
   - POST `/api/kandidaten` — create candidate (return candidateId)
   - POST `/api/kandidaten/[id]/match` — get top-3 matches (return matches + alreadyLinked)
   - POST `/api/kandidaten/[id]/koppel` — create applications (return created + alreadyLinked)
   - POST `/api/opdrachten/[id]/match-kandidaten` — get top-3 candidates
   - POST `/api/opdrachten/[id]/koppel` — create applications (or reuse `/api/kandidaten/[id]/koppel`?)

2. **Verify Zod Schemas**
   - Create candidate payload
   - Match response schema
   - Koppel request/response schema
   - Error response schema

3. **Verify Database Indexes**
   - `(deletedAt, applicationDeadline)` on jobs for active job filtering
   - `(jobId, candidateId)` unique constraint on applications (prevent duplicates)
   - `(jobId, candidateId)` unique constraint on jobMatches (prevent duplicate matches)

4. **Verify Embedding/Matching Performance**
   - Auto-matching service timeout
   - Fallback to rule-based scoring if embedding fails
   - Min score threshold (40) applied correctly

5. **Verify Revalidation**
   - Which routes refreshed after application creation?
   - On-demand or ISR?

---

### **Phase 4: Risk Mitigation** (During implementation)

| Risk | Mitigation |
|------|-----------|
| Matching takes >15s | Load quick scores at 3s, show "Loading full results...", allow user skip anytime |
| Duplicate applications created | Catch unique constraint, return graceful error, show "already linked" UI |
| Embedding API failure | Fallback to rule-based, log error, show results (degraded quality) |
| Mobile form overflow | Test on real devices, ensure scrollable, fixed footer buttons |
| Keyboard navigation broken | Automated a11y testing (axe, jest-axe), manual keyboard testing |
| Network errors during linking | Retry button with form data persistence, show specific error message |

---

---

## Appendix: Analysis Methodology

**Approach:** Exhaustive flow enumeration + edge case generation + specification gap analysis

**Data Sources:**
- Plan document: `/docs/plans/2026-03-05-feat-kandidaat-profiel-pipeline-koppeling-plan.md`
- Brainstorm: `/docs/brainstorms/2026-03-05-kandidaat-profiel-pipeline-koppeling-brainstorm.md`
- Codebase: `src/services/auto-matching.ts`, `src/services/applications.ts`, `src/db/schema.ts`, `components/add-candidate-dialog.tsx`

**Dimensions Analyzed:**
- User journeys (10 primary flows)
- Flow permutations (22 rows in matrix)
- Edge cases (42+ identified)
- Error states (7 primary error paths)
- Mobile/responsive behavior (4 flows)
- Accessibility (4 flows)
- Data consistency (4 flows)
- System resilience (6 flows)

**Gaps Identified:** 31 specification gaps across 10 categories

**Critical Issues:** 5 (blocking implementation)
**Important Issues:** 8 (significantly affecting UX)
**Nice-to-Have:** 10 (improves polish)

**Total Questions:** 31 + 10 nice-to-have = 41 discrete clarification points

---

## Summary

This feature is **well-structured and feasible**, but **requires explicit answers to 5 critical questions and 8 important clarifications before implementation starts**. The biggest gaps are:

1. **Timeout behavior** for matching >15s (blocks UX implementation)
2. **Idempotency strategy** for race conditions (blocks API design)
3. **Form validation timing** (blocks error UX)
4. **CV impact on Step 2** (blocks embedding logic)
5. **Step 2 abandonment state** (blocks data persistence)

Once these are clarified, the implementation is straightforward across 4 phases with low complexity and no new infrastructure. Testing should focus on error paths (timeouts, network failures, race conditions) rather than happy path, which is well-defined.

**Estimated Specification + Design Time:** 2-3 days
**Estimated Implementation Time:** 5-7 days (Phases 1-4)
**Risk Level:** Medium (mostly timeout handling and error recovery)

