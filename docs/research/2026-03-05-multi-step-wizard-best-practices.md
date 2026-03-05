---
title: "Multi-Step Wizard & Matching Systems Research"
date: 2026-03-05
type: research
context: feat-kandidaat-profiel-pipeline-koppeling
---

# Multi-Step Wizard & Matching Systems: Industry Best Practices

Research for the 2-step candidate creation wizard with intelligent vacancy matching for Motian recruitment platform.

## Executive Summary

This research covers industry-standard patterns for:
1. Multi-step form wizards (UX, state management)
2. Candidate matching systems (scoring, ranking)
3. Idempotent API design (duplicate prevention)
4. Progressive disclosure (guided forms)
5. Vacancy matching UI (card layouts)
6. Pipeline stage management (screening → interview)

Key findings: **Progress visualization, cognitive load reduction, save-and-resume functionality, and real-time validation are critical for multi-step forms**. For matching systems, **explainable AI with transparent scoring + relevance reasoning** is the 2026 standard. Idempotency keys (UUID-based) prevent duplicates in recruitment workflows.

---

## 1. Multi-Step Form Wizard Best Practices

### Core UX Principles

#### Progress Visualization
- **Display step indicators** with format "Step 2 of 3" alongside visual progress bar
- Show total steps upfront to set expectations and reduce anxiety
- Use consistent visual hierarchy across all steps
- **Implementation**: Use shadcn `Progress` component + step labels above form

**Source**: [FormAssembly Multi-Step Form Best Practices](https://www.formassembly.com/blog/multi-step-form-best-practices/)

#### Cognitive Load Reduction
- Break process into **3-5 steps maximum** (2 steps optimal for candidate wizard)
- Each step focuses on **single logical grouping** (Profile → Linking)
- Single-column form layout reduces distraction
- Avoid overwhelming users with all fields at once

**Source**: [WeWeb Multi-Step Form Design](https://www.weweb.io/blog/multi-step-form-design)

#### Save and Resume Functionality
- Persist candidate at Step 1 completion (not on dialog close)
- Allow abandonment of Step 2 without losing profile data
- **Design decision**: Candidate exists in talentpool even if linking skipped

**Source**: [Growform UX Best Practices](https://www.growform.co/must-follow-ux-best-practices-when-designing-a-multi-step-form/)

### State Management Patterns

#### React State Architecture
- Use React Context for wizard state (step tracking, form values)
- Reducers for complex state transitions
- Custom hooks for step navigation logic (`useWizardStep`)

**Pattern from**: [Medium - React Building Multi-Step Form with Wizard Pattern](https://medium.com/@vandanpatel29122001/react-building-a-multi-step-form-with-wizard-pattern-85edec21f793)

#### Form Validation Strategy
- **Inline validation** after field blur (real-time feedback)
- Step-level validation before transition
- Zod schema validation per step (not entire form)
- Error messages appear below fields immediately

**Source**: [Smashing Magazine - Creating Effective Multistep Form](https://www.smashingmagazine.com/2024/12/creating-effective-multistep-form-better-user-experience/)

### Real-World Implementation Examples

#### shadcn/ui Multi-Step Form Patterns

**Official Pattern**: [Wizard Steps](https://www.shadcn.io/patterns/button-group-navigation-3)
- Button group navigation with Previous/Next controls
- Labeled step buttons showing progression (Account → Profile → Preferences → Review)
- Disabled boundary states (no Previous on Step 1, no Next on final step)

**Open Source Tool**: [Shadcn UI Multi Form](https://github.com/Remy349/shadcn-ui-multi-form)
- Builds multi-step forms with automatic detection
- Dynamic code generation (React + TypeScript)
- Built-in Zod validation generator
- **Key takeaway**: Use React Hook Form + Zod per step, not global form

**Template Example**: [Multi Step Form Template](https://www.shadcn.io/template/marcosfitzsimons-multi-step-form)
- Next.js 13 + TypeScript + shadcn/ui + Framer Motion
- Smooth step transitions with animations
- Mobile-responsive design

**GitHub Discussion**: [How to build multistep form?](https://github.com/shadcn-ui/ui/discussions/1869)
- Community consensus: use `useState` for step tracking
- Separate components per step
- Pass step navigation handlers as props

### Recommended Component Structure for Motian

```tsx
// components/add-candidate-wizard.tsx
<Dialog>
  <DialogContent>
    <WizardProgress currentStep={step} totalSteps={2} />
    {step === "profile" && (
      <WizardStepProfile onComplete={(candidateId) => setStep("linking")} />
    )}
    {step === "linking" && (
      <WizardStepLinking
        candidateId={candidateId}
        onComplete={handleClose}
        onSkip={handleClose}
      />
    )}
  </DialogContent>
</Dialog>
```

**Key decisions**:
- No back navigation from Step 2 → 1 (candidate persisted)
- Step 1 creates candidate before transition
- Step 2 is optional (skip saves to talentpool only)

---

## 2. Candidate Matching Systems

### Scoring Algorithms & Relevance Ranking

#### Industry Standard: Weighted Multi-Factor Scoring

**Top platforms (2026)**: MokaHR, Eightfold.ai, hireEZ, SeekOut, HiredScore

**Core Algorithm Components**:

1. **Skills Alignment** (40% weight) — NLP-based skill extraction + semantic matching
2. **Experience Relevance** (25% weight) — Years in role + industry context
3. **Location Match** (20% weight) — Distance calculation + remote preference
4. **Rate Compatibility** (15% weight) — Candidate rate vs. job budget

**Source**: [MokaHR - Best AI Candidate Matching Software](https://www.mokahr.io/articles/en/the-best-ai-candidate-matching-software)

#### AI-Powered Matching in 2026

**Key Technologies**:
- **NLP + Machine Learning**: Analyze resumes, extract skills, match to job requirements
- **Vector Databases**: Embeddings for semantic similarity (already implemented in Motian)
- **Explainable AI**: Reasoning text explaining why candidate matches job

**Performance Metrics**:
- **40% reduction in time-to-hire** (LinkedIn Talent Insights)
- **90%+ accuracy** in skills extraction (top systems)
- **Explainability standard**: Show reasoning for every match score

**Sources**:
- [Qandle - Candidate Matching Explained](https://www.qandle.com/blog/candidate-matching-explained-ai-in-recruitment/)
- [x0pa - Automated Candidate Matching & Scoring](https://x0pa.com/glossary/automated-candidate-matching-scoring/)

#### Match Score Visualization

**Best practices**:
- **0-100 numerical score** with color coding (green 80+, yellow 60-79, gray <60)
- **Ring/circular progress** indicator for scores (reuse from Motian's matching page)
- **Reasoning summary** (2-3 sentences) below score
- **Match provenance**: Link to `jobMatches` table for audit trail

**Source**: [Recruiterflow - AI Candidate Matching Guide](https://recruiterflow.com/blog/candidate-matching/)

### Matching UI Patterns

#### Card-Based Selection Pattern

**Layout**:
- 3 cards per row (desktop), 1 card per row (mobile)
- Each card: job title, company, score ring, reasoning, checkbox
- Top-1 pre-selected by default
- "Al gekoppeld" badge for existing applications (disabled checkbox)

**Interaction**:
- Click card to expand details (job description, requirements)
- Checkbox for selection (can select multiple)
- Confirm button enabled when 1+ selected
- Skip button always enabled

**Empty state**: "Geen passende vacatures gevonden. Probeer het profiel aan te vullen met meer vaardigheden of ervaring."

**Sources**:
- [SmartRecruiters - Talent Matching](https://www.smartrecruiters.com/recruiting-software/talent-matching/)
- [Oleeo - Candidate Matching Guide](https://www.oleeo.com/blog/candidate-matching/)

---

## 3. Idempotent API Design

### Stripe-Proven Idempotency Key Pattern

#### How It Works

1. **Client generates UUID** per operation intent (one user action = one key)
2. **Server checks storage** for existing key
3. **If new**: process request, store key + result
4. **If duplicate**: skip processing, return stored result

**Key insight**: "Subsequent requests with the same key return the same result, **including 500 errors**" — guarantees consistency.

**Source**: [Stripe - Designing Robust and Predictable APIs](https://stripe.com/blog/idempotency)

#### Implementation for Motian

**API Endpoints**:
- `POST /api/kandidaten/[id]/koppel` — Create applications from matches
- `POST /api/kandidaten` — Create candidate

**Header format**:
```http
POST /api/kandidaten/123/koppel
Idempotency-Key: 550e8400-e29b-41d4-a716-446655440000
Content-Type: application/json

{
  "matchIds": ["match-1", "match-2"]
}
```

**Storage strategy**:
- Store key + response in Redis (24h TTL)
- PostgreSQL fallback for critical operations (payments → applications)
- Return cached response for duplicate requests (same status code + body)

**Parameter validation**:
- Compare incoming parameters to original request
- Error if parameters differ for same key
- Prevents accidental misuse (different payload with same key)

**Sources**:
- [Stripe API - Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [System Design Newsletter - How Stripe Prevents Double Payment](https://newsletter.systemdesign.one/p/idempotent-api)

#### Database-Level Idempotency

**Unique constraints** as safety net:
```sql
-- Already exists in Motian schema
UNIQUE (jobId, candidateId) ON applications
```

**Service layer**:
```typescript
// src/services/applications.ts
export async function createApplicationsFromMatches(
  candidateId: string,
  matchIds: string[],
  stage: ApplicationStage = "screening"
) {
  const matches = await getMatchesByIds(matchIds);
  const created: Application[] = [];
  const alreadyLinked: string[] = [];

  for (const match of matches) {
    try {
      const app = await createApplication({
        jobId: match.jobId,
        candidateId,
        matchId: match.id,
        stage,
        source: "match",
      });
      created.push(app);
    } catch (error) {
      if (error.code === "23505") {
        // Unique constraint violation
        alreadyLinked.push(match.jobId);
      } else {
        throw error;
      }
    }
  }

  return { created, alreadyLinked };
}
```

**Design decision**: Catch unique constraint violations gracefully (not errors), return `alreadyLinked` array.

**Source**: [Brandur.org - Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys)

---

## 4. Progressive Disclosure

### Definition & Purpose

**Progressive disclosure** = gradually revealing complex information as user progresses, reducing cognitive load by showing only relevant content at each stage.

**Source**: [IxDF - Progressive Disclosure (updated 2026)](https://ixdf.org/literature/topics/progressive-disclosure)

### Application to Candidate Wizard

#### Step 1 (Profile): Guided Input Pattern

**Required fields** (always visible):
- Naam (text input)
- Rol (text input, enforced at UI)

**Recommended fields** (expanded accordion or visible by default):
- Skills (tag input with autocomplete)
- Experience (structured repeatable fields)

**Optional fields** (collapsed accordion "Meer informatie"):
- Email, phone, location
- Rate, availability
- LinkedIn URL
- CV upload (recommended to expand for better matches)
- Notes

**Progressive enabling**: Confirm button disabled until naam + rol filled.

**Source**: [NN/g - Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)

#### Step 2 (Linking): Staged Disclosure

**Loading state** (0-15 seconds):
- Skeleton cards with "Bezig met matchen..." text
- Progress animation (shimmer effect)

**Results state**:
- Top-3 matches displayed immediately
- Expand card for full job description (click to toggle)
- "Zie alle vacatures" link to full matching page (out of scope)

**Empty state**:
- Clear message: "Geen passende vacatures gevonden"
- Explanation: "Het profiel heeft nog weinig informatie. Voeg vaardigheden en ervaring toe voor betere matches."
- Action: "Profiel aanvullen" button (closes wizard, opens candidate detail)

**Source**: [LogRocket - Progressive Disclosure in UX Design](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/)

### Design System Consistency

**Use uniform patterns** for progressive disclosure:
- Accordions for optional field groups (shadcn `Accordion`)
- Skeletons for loading states (shadcn `Skeleton`)
- Badges for metadata ("Al gekoppeld", match scores)

**Source**: [UXPin - Progressive Disclosure Guide](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)

---

## 5. Vacancy Matching UI

### Card Layout Best Practices

#### Match Suggestion Card Structure

```tsx
<Card className="hover:border-primary transition-colors">
  <CardHeader>
    <div className="flex justify-between items-start">
      <div>
        <CardTitle>{job.title}</CardTitle>
        <CardDescription>{job.company}</CardDescription>
      </div>
      <ScoreRing score={match.score} size="sm" />
    </div>
  </CardHeader>
  <CardContent>
    <p className="text-sm text-muted-foreground line-clamp-2">
      {match.reasoning}
    </p>
    {isAlreadyLinked && (
      <Badge variant="secondary" className="mt-2">
        Al gekoppeld
      </Badge>
    )}
  </CardContent>
  <CardFooter>
    <Checkbox
      checked={isSelected}
      disabled={isAlreadyLinked}
      onCheckedChange={handleSelect}
    />
    <Label>Koppel aan {job.title}</Label>
  </CardFooter>
</Card>
```

#### Selection Patterns

**Top-1 pre-selection**: Highest score auto-checked (unless already linked)
**Multi-select**: Allow recruiters to select 1-3 matches
**Disabled state**: Gray out already-linked cards, show badge
**Keyboard navigation**: Tab through cards, Space to toggle checkbox, Enter to confirm

**Source**: [theMatchBox - AI-matching software](https://www.thematchbox.ai/)

### Accessibility & Responsiveness

**Mobile considerations**:
- Stack cards vertically (1 per row)
- Score ring smaller on mobile (size="xs")
- Expand details in dialog (not inline)
- Touch targets 44x44px minimum

**Keyboard shortcuts**:
- Tab: Navigate cards
- Space: Toggle checkbox
- Enter: Confirm selection
- Escape: Close wizard

**Source**: [Workable - All-in-one HR software](https://www.workable.com/)

---

## 6. Pipeline Stage Management

### Standard ATS Pipeline Stages

#### Industry-Standard Flow

**Typical pipeline** (from research):

1. **Application Received** — Candidate submitted or auto-matched
2. **Screening** — Initial review (where wizard creates applications)
3. **Phone Screen** — First contact call
4. **Assessment** — Skills tests, assignments
5. **Hiring Manager Interview** — First formal interview
6. **Exec Interview** — Final round (if needed)
7. **Offer** — Offer extended
8. **Hired** — Offer accepted, onboarding started

**Rejected** — Can happen at any stage (soft delete with `deletedAt`)

**Source**: [Workable - Recruiting Pipeline Best Practices](https://help.workable.com/hc/en-us/articles/4413312707991-Recruiting-pipeline-best-practices)

#### Motian Current Schema

```typescript
// src/db/schema.ts
stage: text("stage")
  .notNull()
  .default("new")
  .$type<"new" | "screening" | "interview" | "offer" | "hired" | "rejected">()
```

**Design decision for wizard**: Always create in `"screening"` stage (not `"new"`) because:
- Candidate is pre-vetted by AI matching
- Recruiter confirmed the link (explicit approval)
- Skip `"new"` queue (applications from wizard are ready for screening)

**Alternative stages**:
- `"new"` — Used for direct applications (not wizard)
- `"screening"` — Used for wizard + manual linking
- `"interview"` — Post-screening, scheduled interview
- `"hired"` — Successful placement (end state)
- `"rejected"` — Not a fit (soft delete)

**Source**: [Qureos - Job Stages to Simplify Candidate Pipeline Management](https://www.qureos.com/updates/job-stages-to-simplify-candidate-pipeline-management)

### Visual Pipeline Representation

**Kanban board pattern**:
- Columns per stage (Screening, Interview, Offer, Hired)
- Drag-drop cards between stages
- Card shows candidate name, job title, match score

**Already implemented in Motian** at `/pipeline` route.

**Source**: [MokaHR - Managing Candidate Pipelines with ATS](https://www.mokahr.io/myblog/managing-candidate-pipelines-with-ats/)

### ATS Integration Best Practices

#### Automated Screening

**AI-powered screening** (already implemented in Motian):
- Auto-match on CV upload (embeddings + vector search)
- Top-3 suggestions presented to recruiter
- Recruiter confirms → applications created in `"screening"`

**Source**: [Clevry - Optimising Recruitment Pipeline Management](https://www.clevry.com/en/blog/optimising-recruitment-pipeline-management-with-an-ats/)

#### Tracking & Metrics

**Key metrics to track**:
- Time-to-hire per stage
- Conversion rate (screening → interview → offer → hired)
- Match score correlation with success (hired candidates)
- Pipeline bottlenecks (stages with long durations)

**Implementation**: Publish `"application:created"` events with stage + timestamp for analytics.

**Source**: [SAP - What is an Applicant Tracking System?](https://www.sap.com/products/hcm/recruiting-software/what-is-an-applicant-tracking-system.html)

---

## 7. Implementation Recommendations for Motian

### Phase 1: Service Layer (Low Risk)

**Priority changes**:

1. **`src/services/applications.ts`** — Add `stage` parameter
   ```typescript
   export async function createApplication(input: {
     jobId: string;
     candidateId: string;
     stage?: ApplicationStage; // NEW: default "new"
     source?: ApplicationSource;
     matchId?: string;
   }) {
     // Use provided stage or default to "new"
     const stage = input.stage ?? "new";
     // Rest of logic unchanged
   }
   ```

2. **New function**: `createApplicationsFromMatches()`
   - Idempotent (catch unique constraint violations)
   - Returns `{ created, alreadyLinked }`
   - Sets `source: "match"` and links `matchId`

3. **`src/services/jobs.ts`** — Filter expired deadlines
   ```typescript
   export async function listActiveJobs() {
     return db.query.jobs.findMany({
       where: and(
         isNull(jobs.deletedAt),
         or(
           isNull(jobs.applicationDeadline),
           gt(jobs.applicationDeadline, new Date())
         )
       ),
     });
   }
   ```

**Acceptance criteria**:
- [ ] All existing tests pass
- [ ] New endpoint has Zod validation
- [ ] Idempotency tested (duplicate requests return same result)

### Phase 2: Candidate Wizard UI (Medium Risk)

**Component architecture**:

```
components/
├── add-candidate-wizard.tsx         # Main dialog wrapper
├── candidate-wizard/
│   ├── wizard-progress.tsx          # Step indicator (1 of 2)
│   ├── wizard-step-profile.tsx      # Step 1: Profile form
│   ├── wizard-step-linking.tsx      # Step 2: Matching results
│   ├── skills-input.tsx             # Tag input for skills
│   ├── experience-input.tsx         # Repeatable experience fields
│   └── match-suggestion-card.tsx    # Individual match card
```

**Key decisions**:
- Use React Hook Form per step (not global form)
- Zod validation per step
- No back navigation (candidate persisted after Step 1)
- Step 2 optional (skip = talentpool only)

**UI patterns**:
- shadcn Dialog, Tabs, Progress, Badge, Checkbox, Skeleton
- Framer Motion for step transitions (optional polish)
- Mobile-first responsive design

### Phase 3: Vacancy-Side Linking (Low Risk)

**New component**: `components/link-candidates-dialog.tsx`
- Same UI as Step 2 of candidate wizard
- Triggered from vacancy detail page
- POST `/api/opdrachten/[id]/match-kandidaten` to get suggestions

**Integration point**: `app/opdrachten/[id]/page.tsx`
- Replace "Koppel aan kandidaat" navigation
- Open dialog instead

### Phase 4: Polish & Integration (Low Risk)

**Revalidation paths** after application creation:
```typescript
revalidatePath("/professionals");
revalidatePath("/pipeline");
revalidatePath("/overzicht");
revalidatePath("/opdrachten");
revalidatePath(`/professionals/${candidateId}`);
```

**Event publishing**:
```typescript
await publishEvent({
  type: "application:created",
  payload: { applicationId, candidateId, jobId, stage: "screening" },
});
```

**Error handling**:
- Unique constraint violations → show "Al gekoppeld" gracefully
- Matching timeout (>15s) → show rule-based scores as fallback
- Network errors → toast with retry option

---

## 8. Open Source Examples for Reference

### shadcn/ui Multi-Step Forms

- [Official Wizard Steps Pattern](https://www.shadcn.io/patterns/button-group-navigation-3)
- [Shadcn UI Multi Form Tool](https://github.com/Remy349/shadcn-ui-multi-form)
- [Multi Step Form Template](https://www.shadcn.io/template/marcosfitzsimons-multi-step-form)
- [GitHub Discussion - How to Build Multistep Form](https://github.com/shadcn-ui/ui/discussions/1869)

### Next.js ATS Projects

- [Seguidor-ATS](https://github.com/Andy-Intelligence/Seguidor-ATS) — Full Next.js ATS
- [ResumeLM](https://github.com/olyaiy/resume-lm) — AI resume builder (Next.js 15 + Supabase)

### Idempotency Key Implementations

- [Stripe Blog - Designing Robust APIs](https://stripe.com/blog/idempotency)
- [Brandur.org - Postgres Idempotency Keys](https://brandur.org/idempotency-keys)

---

## 9. Key Performance Indicators (KPIs)

### Success Metrics for Wizard

1. **Completion rate**: % of Step 1 completions that reach Step 2 confirm
   - **Target**: 70%+ (30% skip is acceptable)

2. **Match acceptance rate**: % of suggested matches that get confirmed
   - **Target**: 50%+ for top-1, 30%+ for top-2, 20%+ for top-3

3. **Time to complete**: Median time from dialog open to confirm
   - **Target**: <3 minutes (including matching wait time)

4. **Pipeline placement rate**: % of new candidates that enter pipeline
   - **Current (before)**: ~20% (manual linking friction)
   - **Target (after)**: 60%+ (wizard reduces steps)

5. **Match quality**: % of wizard-created applications that reach "interview" stage
   - **Target**: 40%+ (validates AI matching accuracy)

### Monitoring Implementation

```typescript
// Track wizard events
trackEvent("wizard:step_completed", { step: "profile", duration: 45 });
trackEvent("wizard:match_accepted", { matchId, score: 87, rank: 1 });
trackEvent("wizard:skipped", { step: "linking", reason: "no_matches" });
```

---

## 10. Risk Mitigation

| Risk | Likelihood | Impact | Mitigation |
|------|-----------|--------|------------|
| Matching takes >15s | Medium | Poor UX | Show rule-based scores immediately, deep scores stream in |
| No matches for sparse profile | High | Confused recruiter | Clear empty state with explanation + "Profiel aanvullen" action |
| Embedding API failure | Low | Degraded matches | Fallback to rule-based scoring (already implemented) |
| Unique constraint race condition | Low | Error toast | Catch 23505 error, return `alreadyLinked` gracefully |
| Users abandon Step 2 | Medium | Low adoption | Make skip option prominent, emphasize "saved to talentpool" |

---

## Summary of Sources

### Multi-Step Forms
- [FormAssembly Multi-Step Form Best Practices](https://www.formassembly.com/blog/multi-step-form-best-practices/)
- [WeWeb Multi-Step Form Design](https://www.weweb.io/blog/multi-step-form-design)
- [Growform UX Best Practices](https://www.growform.co/must-follow-ux-best-practices-when-designing-a-multi-step-form/)
- [Smashing Magazine - Creating Effective Multistep Form](https://www.smashingmagazine.com/2024/12/creating-effective-multistep-form-better-user-experience/)
- [Medium - React Building Multi-Step Form with Wizard Pattern](https://medium.com/@vandanpatel29122001/react-building-a-multi-step-form-with-wizard-pattern-85edec21f793)

### shadcn/ui Examples
- [Wizard Steps Pattern](https://www.shadcn.io/patterns/button-group-navigation-3)
- [Shadcn UI Multi Form](https://github.com/Remy349/shadcn-ui-multi-form)
- [Multi Step Form Template](https://www.shadcn.io/template/marcosfitzsimons-multi-step-form)
- [GitHub Discussion - How to Build Multistep Form](https://github.com/shadcn-ui/ui/discussions/1869)

### Candidate Matching
- [MokaHR - Best AI Candidate Matching Software](https://www.mokahr.io/articles/en/the-best-ai-candidate-matching-software)
- [Qandle - Candidate Matching Explained](https://www.qandle.com/blog/candidate-matching-explained-ai-in-recruitment/)
- [Recruiterflow - AI Candidate Matching Guide](https://recruiterflow.com/blog/candidate-matching/)
- [x0pa - Automated Candidate Matching & Scoring](https://x0pa.com/glossary/automated-candidate-matching-scoring/)
- [SmartRecruiters - Talent Matching](https://www.smartrecruiters.com/recruiting-software/talent-matching/)

### Idempotency
- [Stripe - Designing Robust and Predictable APIs](https://stripe.com/blog/idempotency)
- [Stripe API - Idempotent Requests](https://docs.stripe.com/api/idempotent_requests)
- [System Design Newsletter - How Stripe Prevents Double Payment](https://newsletter.systemdesign.one/p/idempotent-api)
- [Brandur.org - Implementing Stripe-like Idempotency Keys in Postgres](https://brandur.org/idempotency-keys)

### Progressive Disclosure
- [IxDF - Progressive Disclosure (updated 2026)](https://ixdf.org/literature/topics/progressive-disclosure)
- [NN/g - Progressive Disclosure](https://www.nngroup.com/articles/progressive-disclosure/)
- [LogRocket - Progressive Disclosure in UX Design](https://blog.logrocket.com/ux-design/progressive-disclosure-ux-types-use-cases/)
- [UXPin - Progressive Disclosure Guide](https://www.uxpin.com/studio/blog/what-is-progressive-disclosure/)

### Pipeline Management
- [Workable - Recruiting Pipeline Best Practices](https://help.workable.com/hc/en-us/articles/4413312707991-Recruiting-pipeline-best-practices)
- [Qureos - Job Stages to Simplify Candidate Pipeline Management](https://www.qureos.com/updates/job-stages-to-simplify-candidate-pipeline-management)
- [MokaHR - Managing Candidate Pipelines with ATS](https://www.mokahr.io/myblog/managing-candidate-pipelines-with-ats/)
- [Clevry - Optimising Recruitment Pipeline Management](https://www.clevry.com/en/blog/optimising-recruitment-pipeline-management-with-an-ats/)
- [SAP - What is an Applicant Tracking System?](https://www.sap.com/products/hcm/recruiting-software/what-is-an-applicant-tracking-system.html)

### Open Source Projects
- [Seguidor-ATS GitHub](https://github.com/Andy-Intelligence/Seguidor-ATS)
- [ResumeLM GitHub](https://github.com/olyaiy/resume-lm)

---

## Next Steps

1. **Review research findings** with team
2. **Validate design decisions** against Motian's existing patterns
3. **Prioritize implementation phases** (Service → UI → Integration)
4. **Set up metrics tracking** for KPIs
5. **Begin Phase 1 implementation** (Service layer changes)

**Estimated effort**:
- Phase 1 (Service): 3-5 days
- Phase 2 (Candidate Wizard UI): 5-8 days
- Phase 3 (Vacancy-Side Linking): 2-3 days
- Phase 4 (Polish): 2-3 days
- **Total**: 12-19 days (2.5-4 weeks)

**High confidence** in implementation due to:
- Clear industry patterns (battle-tested)
- Existing Motian infrastructure (auto-matching, embeddings, applications)
- shadcn/ui component library (rapid prototyping)
- Comprehensive plan with acceptance criteria
