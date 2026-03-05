---
title: "Data Integrity Review: Kandidaat Profiel + Pipeline Koppeling"
type: review
date: 2026-03-05
severity: CRITICAL
---

# Data Integrity Review: Kandidaat Profiel + Pipeline Koppeling

**Reviewed Plan:** `docs/plans/2026-03-05-feat-kandidaat-profiel-pipeline-koppeling-plan.md`

**Review Date:** 2026-03-05

**Reviewer:** Data Integrity Guardian

## Executive Summary

**OVERALL VERDICT:** CONDITIONALLY APPROVED WITH CRITICAL MODIFICATIONS REQUIRED

The proposed feature has **sound architecture** but contains **multiple critical data integrity gaps** that MUST be addressed before implementation. The idempotency pattern is incomplete, transaction boundaries are missing, and soft-delete handling is inconsistent.

**Risk Level:** HIGH - Potential for duplicate applications, orphaned records, and race conditions in production.

---

## Critical Findings

### 1. IDEMPOTENCY IMPLEMENTATION - INCOMPLETE AND UNSAFE

**Severity:** CRITICAL
**Location:** Phase 1, `createApplicationsFromMatches()` specification

#### Issue: Insufficient Idempotency Guarantees

The plan states:
> "Checks for existing applications per (jobId, candidateId)"

**Problem:** This is vulnerable to a **TOCTOU (Time-of-Check-Time-of-Use) race condition.**

```typescript
// UNSAFE PATTERN (as implied by plan)
async function createApplicationsFromMatches(candidateId, matches[], stage) {
  const results = [];

  for (const match of matches) {
    // CHECK: Query for existing application
    const existing = await db.select()
      .from(applications)
      .where(and(
        eq(applications.jobId, match.jobId),
        eq(applications.candidateId, candidateId),
        isNull(applications.deletedAt)  // ✅ Good - soft-delete check
      ))
      .limit(1);

    if (!existing.length) {
      // USE: Insert new application
      // ❌ RACE CONDITION: Another request could have inserted between CHECK and USE
      const app = await createApplication({
        jobId: match.jobId,
        candidateId,
        matchId: match.id,
        stage,
        source: "match"
      });
      results.push(app);
    }
  }

  return { created: results, alreadyLinked: [] };
}
```

**Scenario: Data Corruption Example**

```
Time | Request A                        | Request B
-----|----------------------------------|----------------------------------
T0   | User clicks "Koppel" for job X   |
T1   | CHECK: No application exists     |
T2   |                                  | User clicks "Koppel" for job X
T3   |                                  | CHECK: No application exists
T4   | INSERT application (jobX, candY) |
T5   |                                  | INSERT application (jobX, candY)
T6   | ❌ UNIQUE CONSTRAINT VIOLATION   | OR ❌ DUPLICATE APPLICATION
```

**Impact:**
- Duplicate applications created if unique constraint is missing
- User-facing errors if constraint exists but not handled
- Database consistency violations

#### Correct Implementation Pattern

**Option A: Database-Level Idempotency (RECOMMENDED)**

```typescript
export async function createApplicationsFromMatches(
  candidateId: string,
  matchIds: string[],
  stage: string = "screening"
): Promise<{ created: Application[], alreadyLinked: string[] }> {
  // Fetch match records with job details in single query
  const matches = await db
    .select()
    .from(jobMatches)
    .where(and(
      eq(jobMatches.candidateId, candidateId),
      inArray(jobMatches.id, matchIds)
    ));

  const created: Application[] = [];
  const alreadyLinked: string[] = [];

  for (const match of matches) {
    try {
      // ATOMIC: Use INSERT ... ON CONFLICT DO NOTHING (PostgreSQL)
      const [app] = await db
        .insert(applications)
        .values({
          jobId: match.jobId,
          candidateId,
          matchId: match.id,
          stage,
          source: "match",
        })
        .onConflictDoNothing({
          target: [applications.jobId, applications.candidateId],
          where: isNull(applications.deletedAt)  // ✅ Partial unique index condition
        })
        .returning();

      if (app) {
        created.push(app);
      } else {
        alreadyLinked.push(match.jobId);
      }
    } catch (err) {
      // Fallback: Handle unique constraint violation (older Drizzle versions)
      const errMsg = String(err);
      if (errMsg.includes("uq_applications_job_candidate") || errMsg.includes("duplicate")) {
        alreadyLinked.push(match.jobId);
      } else {
        throw err; // Re-throw unexpected errors
      }
    }
  }

  return { created, alreadyLinked };
}
```

**Option B: Application-Level Locking (NOT RECOMMENDED)**

```typescript
// ❌ AVOID: Requires distributed lock manager (Redis/Postgres advisory locks)
await lock.acquire(`app:${jobId}:${candidateId}`, async () => {
  // Check + insert inside lock
});
```

**Why Option A is Superior:**
- Database guarantees atomicity (ACID compliance)
- No additional infrastructure dependencies
- Survives horizontal scaling
- Lower latency (single round-trip)

---

### 2. SOFT-DELETE HANDLING - INCOMPLETE SPECIFICATION

**Severity:** CRITICAL
**Location:** All database queries in Phase 1

#### Issue: Inconsistent `deletedAt IS NULL` Checks

**Current Schema (from `src/db/schema.ts`):**

```typescript
// applications table (lines 256-279)
applications {
  id: uuid
  jobId: uuid (FK → jobs.id, onDelete: "set null")
  candidateId: uuid (FK → candidates.id, onDelete: "set null")
  deletedAt: timestamp  // ✅ Soft-delete column exists
}

// Unique constraint (line 274-277)
uniqueIndex("uq_applications_job_candidate").on(
  table.jobId,
  table.candidateId
)
```

**CRITICAL PROBLEM: Unique Constraint Does NOT Honor Soft-Deletes**

This constraint **BLOCKS** re-creation of applications after soft-delete:

```sql
-- Timeline
INSERT INTO applications (job_id, candidate_id) VALUES ('job1', 'cand1');
-- ✅ Success

UPDATE applications SET deleted_at = NOW() WHERE ...;
-- ✅ Soft-deleted

INSERT INTO applications (job_id, candidate_id) VALUES ('job1', 'cand1');
-- ❌ ERROR: duplicate key value violates unique constraint "uq_applications_job_candidate"
```

**User Impact:**
1. Recruiter deletes application (soft-delete)
2. Recruiter tries to re-link same candidate to job via wizard
3. **System rejects with cryptic error** despite no visible application

#### Required Schema Migration

```sql
-- DROP existing constraint
DROP INDEX IF EXISTS uq_applications_job_candidate;

-- CREATE partial unique index (PostgreSQL 9.0+)
CREATE UNIQUE INDEX uq_applications_job_candidate_active
ON applications (job_id, candidate_id)
WHERE deleted_at IS NULL;
```

**Update Schema Definition:**

```typescript
// src/db/schema.ts (line 274-277)
export const applications = pgTable(
  "applications",
  { /* ... existing columns ... */ },
  (table) => ({
    jobIdIdx: index("idx_applications_job_id").on(table.jobId),
    candidateIdIdx: index("idx_applications_candidate_id").on(table.candidateId),
    stageIdx: index("idx_applications_stage").on(table.stage),

    // ✅ FIXED: Partial unique index excludes soft-deleted rows
    jobCandidateUniqueIdx: uniqueIndex("uq_applications_job_candidate_active")
      .on(table.jobId, table.candidateId)
      .where(sql`${table.deletedAt} IS NULL`),
  })
);
```

**Drizzle Migration Command:**

```bash
pnpm db:generate  # Generate migration file
# Edit migration to match above SQL
pnpm db:push      # Apply to Neon database
```

#### Query Pattern Enforcement

**EVERY** query touching `applications` MUST include soft-delete check:

```typescript
// ✅ CORRECT
.where(and(
  eq(applications.jobId, jobId),
  eq(applications.candidateId, candidateId),
  isNull(applications.deletedAt)  // MANDATORY
))

// ❌ WRONG
.where(and(
  eq(applications.jobId, jobId),
  eq(applications.candidateId, candidateId)
  // Missing deletedAt check → includes soft-deleted rows!
))
```

**Audit Locations:**
- `src/services/applications.ts` - Lines 18-22 (buildListConditions)
- `createApplicationsFromMatches()` - New function
- `/api/kandidaten/[id]/match/route.ts` - New endpoint
- `/api/opdrachten/[id]/match-kandidaten/route.ts` - New endpoint

---

### 3. TRANSACTION BOUNDARIES - COMPLETELY MISSING

**Severity:** CRITICAL
**Location:** Phase 1, Phase 4 (event publishing)

#### Issue: No Atomic Operations for Multi-Record Changes

**Current Plan (Phase 1 - File #6: `/api/kandidaten/[id]/koppel/route.ts`):**

```typescript
// ❌ UNSAFE: No transaction wrapper
export const POST = async (request: Request) => {
  const { matchIds } = await request.json();

  // Step 1: Create applications
  const { created, alreadyLinked } = await createApplicationsFromMatches(
    candidateId,
    matchIds,
    "screening"
  );

  // Step 2: Publish events (Phase 4)
  for (const app of created) {
    publish("application:created", { applicationId: app.id });
  }

  // Step 3: Revalidate paths
  revalidatePath("/professionals");
  revalidatePath("/pipeline");

  return Response.json({ created, alreadyLinked });
};
```

**Problem: Partial Failure Scenarios**

| Failure Point | Result | User Sees |
|---------------|--------|-----------|
| After 2 of 3 applications created | Partial data in DB, no events for 3rd app | Inconsistent UI, missing pipeline entries |
| Event publishing fails | Applications created but no notifications | Silent data inconsistency |
| Revalidation fails | Stale Next.js cache | User sees old data after refresh |

**Data Corruption Example:**

```
Recruiter selects 3 vacancies to link → [A, B, C]
  → Application A created ✅
  → Application B created ✅
  → Application C fails (network timeout) ❌
  → Events published for A, B only
  → UI shows "Successfully linked to 3 vacancies"
  → Reality: Only 2 applications exist
  → Candidate missing from vacancy C pipeline
```

#### Required Implementation: Database Transactions

```typescript
import { db } from "@/src/db";

export async function createApplicationsFromMatches(
  candidateId: string,
  matchIds: string[],
  stage: string = "screening"
): Promise<{ created: Application[], alreadyLinked: string[] }> {
  // ✅ Wrap in transaction for atomicity
  return db.transaction(async (tx) => {
    const matches = await tx
      .select()
      .from(jobMatches)
      .where(and(
        eq(jobMatches.candidateId, candidateId),
        inArray(jobMatches.id, matchIds)
      ));

    const created: Application[] = [];
    const alreadyLinked: string[] = [];

    for (const match of matches) {
      try {
        const [app] = await tx
          .insert(applications)
          .values({
            jobId: match.jobId,
            candidateId,
            matchId: match.id,
            stage,
            source: "match",
          })
          .onConflictDoNothing({
            target: [applications.jobId, applications.candidateId],
            where: isNull(applications.deletedAt)
          })
          .returning();

        if (app) created.push(app);
        else alreadyLinked.push(match.jobId);
      } catch (err) {
        // Error inside transaction → automatic rollback
        throw err;
      }
    }

    return { created, alreadyLinked };
  }); // ✅ Transaction commits here if all operations succeed
}
```

**Transaction Guarantees:**
- **Atomicity:** All applications created or none
- **Consistency:** Database constraints enforced
- **Isolation:** No partial reads by concurrent requests
- **Durability:** Committed data survives crashes

**Event Publishing Strategy:**

```typescript
// ✅ Publish events AFTER transaction commits
export const POST = async (request: Request) => {
  const { matchIds } = await request.json();

  // Step 1: Atomic database operation
  const { created, alreadyLinked } = await createApplicationsFromMatches(
    candidateId,
    matchIds,
    "screening"
  );

  // Step 2: Publish events (outside transaction)
  // If this fails, applications exist but events missing → acceptable trade-off
  // Consider using message queue for reliability
  try {
    for (const app of created) {
      publish("application:created", { applicationId: app.id });
    }
  } catch (err) {
    console.error("Event publishing failed:", err);
    // ✅ Applications still created successfully
  }

  // Step 3: Revalidate paths
  revalidatePath("/professionals");
  revalidatePath("/pipeline");

  return Response.json({ created, alreadyLinked });
};
```

**Why Events Outside Transaction:**
- Event bus failures shouldn't rollback database changes
- Asynchronous processing (Slack notifications, etc.) shouldn't block user
- Idempotent event handlers can retry safely

---

### 4. FOREIGN KEY RELATIONSHIPS - CASCADE BEHAVIOR RISKS

**Severity:** HIGH
**Location:** Schema definition, Phase 1

#### Issue: `onDelete: "set null"` Can Create Orphaned Applications

**Current Schema:**

```typescript
// applications table (lines 260-261)
jobId: uuid("job_id").references(() => jobs.id, { onDelete: "set null" }),
candidateId: uuid("candidate_id").references(() => candidates.id, { onDelete: "set null" }),
```

**Problem Scenarios:**

**Scenario 1: Job Deleted**
```sql
DELETE FROM jobs WHERE id = 'job123';
-- Result: applications.job_id becomes NULL
-- Impact: Application exists but points to no job
-- UI: "Application for (unknown vacancy)" ← confusing
```

**Scenario 2: Candidate Deleted (GDPR Right-to-Erasure)**
```sql
UPDATE candidates SET deleted_at = NOW() WHERE id = 'cand456';
-- Result: Application still references candidate
-- Impact: GDPR violation - application data retained
```

#### Recommended Cascade Behaviors

**Option A: Cascade Soft-Deletes (RECOMMENDED)**

```typescript
// applications table
export const applications = pgTable(
  "applications",
  {
    id: uuid("id").primaryKey().defaultRandom(),

    // ✅ Keep foreign keys as NOT NULL (applications MUST have both)
    jobId: uuid("job_id")
      .references(() => jobs.id, { onDelete: "cascade" })
      .notNull(),

    candidateId: uuid("candidate_id")
      .references(() => candidates.id, { onDelete: "cascade" })
      .notNull(),

    matchId: uuid("match_id")
      .references(() => jobMatches.id, { onDelete: "set null" }),

    stage: text("stage").notNull().default("new"),
    source: text("source").default("manual"),
    notes: text("notes"),

    createdAt: timestamp("created_at").defaultNow(),
    updatedAt: timestamp("updated_at").defaultNow(),
    deletedAt: timestamp("deleted_at"),
  },
  // ... indexes
);
```

**Implement Trigger for Soft-Delete Cascades:**

```sql
-- Database migration: Soft-delete cascade trigger
CREATE OR REPLACE FUNCTION cascade_soft_delete_to_applications()
RETURNS TRIGGER AS $$
BEGIN
  -- When a job is soft-deleted, soft-delete its applications
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE applications
    SET deleted_at = NEW.deleted_at
    WHERE job_id = NEW.id AND deleted_at IS NULL;
  END IF;

  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_soft_delete_cascade
AFTER UPDATE ON jobs
FOR EACH ROW
WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
EXECUTE FUNCTION cascade_soft_delete_to_applications();

-- Repeat for candidates table
CREATE TRIGGER candidate_soft_delete_cascade
AFTER UPDATE ON candidates
FOR EACH ROW
WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
EXECUTE FUNCTION cascade_soft_delete_to_applications();
```

**Option B: Application-Level Cascade (NOT RECOMMENDED)**

```typescript
// ❌ Slower, not atomic, race condition prone
export async function deleteJob(id: string): Promise<boolean> {
  // Soft-delete all applications first
  await db
    .update(applications)
    .set({ deletedAt: new Date() })
    .where(and(eq(applications.jobId, id), isNull(applications.deletedAt)));

  // Then soft-delete job
  await db
    .update(jobs)
    .set({ deletedAt: new Date() })
    .where(eq(jobs.id, id));

  return true;
}
```

**Why Database Triggers Win:**
- Guaranteed consistency (runs in same transaction)
- Works for MCP, CLI, AI tools, API - all surfaces
- Cannot be bypassed by direct SQL
- Survives developer errors

---

### 5. RACE CONDITIONS - ADDITIONAL VECTORS

**Severity:** HIGH
**Location:** Phase 2, Step 2 (Wizard Linking)

#### Issue: Concurrent Match Creation vs. Application Creation

**Scenario:**

```
User Flow: Candidate Wizard Step 2

T0: Wizard displays top-3 matches [A, B, C]
T1: User selects vacancies B and C
T2: Admin deletes vacancy B (soft-delete)
T3: User clicks "Koppel" button
T4: API tries to create applications for [B, C]
T5: Application B creation fails (job deleted)
T6: ❌ User sees error, unsure if C was linked
```

**Plan States (Phase 2, File #9 acceptance criteria):**
> "Confirm creates applications in `screening` stage"

**Missing:** Error handling for deleted/inactive jobs during linking.

#### Safe Implementation

```typescript
// app/api/kandidaten/[id]/koppel/route.ts
export const POST = withApiHandler(async (request: Request) => {
  const { params } = request;
  const candidateId = params.id;
  const body = await request.json();
  const parsed = koppelSchema.safeParse(body);

  if (!parsed.success) {
    return Response.json(
      { error: "Ongeldige invoer", details: parsed.error.flatten() },
      { status: 400 }
    );
  }

  const { matchIds } = parsed.data;

  // ✅ Validate jobs are still active BEFORE attempting creation
  const matches = await db
    .select({
      matchId: jobMatches.id,
      jobId: jobMatches.jobId,
      candidateId: jobMatches.candidateId,
      jobDeleted: jobs.deletedAt,
      candidateDeleted: candidates.deletedAt,
    })
    .from(jobMatches)
    .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .leftJoin(candidates, eq(jobMatches.candidateId, candidates.id))
    .where(and(
      eq(jobMatches.candidateId, candidateId),
      inArray(jobMatches.id, matchIds)
    ));

  const validMatches = matches.filter(
    (m) => m.jobDeleted === null && m.candidateDeleted === null
  );

  const invalidMatches = matches.filter(
    (m) => m.jobDeleted !== null || m.candidateDeleted !== null
  );

  if (validMatches.length === 0) {
    return Response.json(
      { error: "Alle geselecteerde vacatures zijn niet meer beschikbaar" },
      { status: 400 }
    );
  }

  // Create applications only for valid matches
  const { created, alreadyLinked } = await createApplicationsFromMatches(
    candidateId,
    validMatches.map(m => m.matchId),
    "screening"
  );

  // Publish events
  for (const app of created) {
    publish("application:created", { applicationId: app.id });
  }

  revalidatePath("/professionals");
  revalidatePath("/pipeline");
  revalidatePath("/overzicht");
  revalidatePath(`/professionals/${candidateId}`);

  return Response.json({
    data: { created, alreadyLinked },
    warnings: invalidMatches.length > 0
      ? [`${invalidMatches.length} vacature(s) niet meer beschikbaar`]
      : undefined
  }, { status: 201 });
});
```

**User Experience:**
- Partial success handled gracefully
- Clear feedback about skipped vacancies
- Applications created for valid selections
- No cryptic errors

---

### 6. UNIQUE CONSTRAINTS ENFORCEMENT - VERIFICATION REQUIRED

**Severity:** MEDIUM
**Location:** All tables with unique constraints

#### Issue: Verify Unique Constraints Exist in Production

**Plan Assumes (Phase 1, File #1):**
> "Idempotent: no duplicate applications created"

**Must Verify:**

```sql
-- Check existing constraints on production database
SELECT
  conname AS constraint_name,
  contype AS constraint_type,
  pg_get_constraintdef(oid) AS definition
FROM pg_constraint
WHERE conrelid = 'applications'::regclass;

-- Expected output:
-- uq_applications_job_candidate_active | UNIQUE | (job_id, candidate_id) WHERE deleted_at IS NULL
```

**If Missing:**

```sql
-- Create constraint (migration required)
CREATE UNIQUE INDEX uq_applications_job_candidate_active
ON applications (job_id, candidate_id)
WHERE deleted_at IS NULL;
```

**Verify Related Constraints:**

```typescript
// jobMatches table (line 248-251)
uniqueIndex("uq_job_matches_job_candidate").on(
  table.jobId,
  table.candidateId
)
// ✅ NO deletedAt column in jobMatches → standard unique constraint OK

// candidates table (line 210-212)
emailUniqueIdx: uniqueIndex("uq_candidates_email")
  .on(table.email)
  .where(sql`email IS NOT NULL`)
// ✅ Partial unique index already correct
```

---

### 7. DATA CONSISTENCY BETWEEN ENTITIES

**Severity:** MEDIUM
**Location:** Phase 1, `createApplicationsFromMatches()`

#### Issue: Application Source and MatchId Linkage

**Plan States (Phase 1, File #1):**
> "Sets `source: "match"` and links `matchId`"

**Validation Rules Required:**

```typescript
export async function createApplicationsFromMatches(
  candidateId: string,
  matchIds: string[],
  stage: string = "screening"
): Promise<{ created: Application[], alreadyLinked: string[] }> {
  return db.transaction(async (tx) => {
    // ✅ Fetch matches with validation
    const matches = await tx
      .select()
      .from(jobMatches)
      .where(and(
        eq(jobMatches.candidateId, candidateId),
        inArray(jobMatches.id, matchIds)
      ));

    // ✅ CRITICAL: Validate all matchIds belong to this candidate
    if (matches.length !== matchIds.length) {
      throw new Error(
        `Invalid matchIds: expected ${matchIds.length}, found ${matches.length}`
      );
    }

    const created: Application[] = [];
    const alreadyLinked: string[] = [];

    for (const match of matches) {
      // ✅ Additional validation: Ensure match.candidateId === candidateId
      if (match.candidateId !== candidateId) {
        throw new Error(
          `Match ${match.id} belongs to different candidate ${match.candidateId}`
        );
      }

      try {
        const [app] = await tx
          .insert(applications)
          .values({
            jobId: match.jobId,
            candidateId,
            matchId: match.id,  // ✅ Provenance tracking
            stage,
            source: "match",    // ✅ Source attribution
          })
          .onConflictDoNothing({
            target: [applications.jobId, applications.candidateId],
            where: isNull(applications.deletedAt)
          })
          .returning();

        if (app) created.push(app);
        else alreadyLinked.push(match.jobId);
      } catch (err) {
        throw err;
      }
    }

    return { created, alreadyLinked };
  });
}
```

**Invariants Enforced:**
1. All `matchId` references exist in `jobMatches` table
2. `matchId` points to match with same `candidateId`
3. `source = "match"` implies `matchId IS NOT NULL`
4. `jobId` in application matches `jobId` in linked match

---

## Additional Findings

### 8. PRIVACY COMPLIANCE - GDPR RIGHT-TO-ERASURE

**Severity:** HIGH (Regulatory)
**Location:** Candidate deletion flow

**Issue:** Applications with `matchId` links retain candidate data after GDPR erasure.

**Current Schema:**
```typescript
matchId: uuid("match_id").references(() => jobMatches.id, { onDelete: "set null" }),
```

**Problem:**
- Candidate exercises right-to-erasure
- `candidates` record soft-deleted
- `jobMatches` records remain (contain candidate name, skills in reasoning field)
- `applications` remain with `matchId` link → transitive data retention

**Required Implementation:**

```typescript
// src/services/gdpr.ts (new file)
export async function eraseCandidate(candidateId: string, requestedBy: string) {
  return db.transaction(async (tx) => {
    // 1. Soft-delete candidate
    await tx
      .update(candidates)
      .set({
        deletedAt: new Date(),
        // Scrub PII fields
        email: null,
        phone: null,
        resumeUrl: null,
        linkedinUrl: null,
        resumeRaw: null,
        notes: null,
      })
      .where(eq(candidates.id, candidateId));

    // 2. Delete matches (hard delete - contains candidate data)
    await tx
      .delete(jobMatches)
      .where(eq(jobMatches.candidateId, candidateId));

    // 3. Soft-delete applications (preserve pipeline history structure)
    await tx
      .update(applications)
      .set({
        deletedAt: new Date(),
        matchId: null,  // Unlink from deleted matches
        notes: null,    // Scrub notes
      })
      .where(eq(applications.candidateId, candidateId));

    // 4. Audit log
    await tx.insert(gdprAuditLog).values({
      action: "erase_candidate",
      subjectType: "candidate",
      subjectId: candidateId,
      requestedBy,
      reason: "GDPR Right to Erasure",
      details: { timestamp: new Date().toISOString() }
    });
  });
}
```

**Update Plan (Phase 4):**
- Add GDPR erasure button to candidate detail page
- Implement cascade logic above
- Test thoroughly with production-like data

---

### 9. listActiveJobs() FILTER - INCOMPLETE

**Severity:** MEDIUM
**Location:** Phase 1, File #2 (`src/services/jobs.ts`)

**Plan States:**
> "Add: exclude jobs where `applicationDeadline < now()`"

**Current Implementation (lines 414-424):**
```typescript
export async function listActiveJobs(limit?: number): Promise<Job[]> {
  const safeLimit = Math.min(limit ?? 200, 500);

  return db
    .select()
    .from(jobs)
    .where(isNull(jobs.deletedAt))  // Only soft-delete check
    .orderBy(desc(jobs.scrapedAt))
    .limit(safeLimit);
}
```

**Required Fix:**

```typescript
export async function listActiveJobs(limit?: number): Promise<Job[]> {
  const safeLimit = Math.min(limit ?? 200, 500);

  return db
    .select()
    .from(jobs)
    .where(and(
      isNull(jobs.deletedAt),
      // ✅ Exclude expired jobs
      or(
        isNull(jobs.applicationDeadline),  // No deadline = always active
        gte(jobs.applicationDeadline, new Date())  // Deadline in future
      )
    ))
    .orderBy(desc(jobs.scrapedAt))
    .limit(safeLimit);
}
```

**Impact:**
- Prevents matching candidates to expired jobs
- Wizard Step 2 shows only truly active vacancies
- Reduces user confusion

---

### 10. STAGE PARAMETER VALIDATION - MISSING

**Severity:** LOW
**Location:** Phase 1, File #1 (`createApplication()` modification)

**Plan States:**
> "Accept `stage` in input, default to `"new"`"

**Issue:** No validation of `stage` parameter.

**Current Validation (line 7):**
```typescript
const VALID_STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"];
```

**Required Implementation:**

```typescript
export async function createApplication(data: {
  jobId: string;
  candidateId: string;
  matchId?: string;
  source?: string;
  notes?: string;
  stage?: string;  // ✅ New optional parameter
}): Promise<Application> {
  // ✅ Validate stage parameter
  const stage = data.stage ?? "new";
  if (!VALID_STAGES.includes(stage)) {
    throw new Error(
      `Invalid stage "${stage}". Must be one of: ${VALID_STAGES.join(", ")}`
    );
  }

  const rows = await db
    .insert(applications)
    .values({
      jobId: data.jobId,
      candidateId: data.candidateId,
      matchId: data.matchId ?? null,
      source: data.source ?? "manual",
      notes: data.notes ?? null,
      stage,  // ✅ Use validated stage
    })
    .returning();

  return rows[0];
}
```

---

## Required Migrations

### Migration 1: Partial Unique Index for Applications

```sql
-- File: migrations/0001_fix_applications_unique_constraint.sql
-- Allows re-creation of applications after soft-delete

-- Drop existing constraint
DROP INDEX IF EXISTS uq_applications_job_candidate;

-- Create partial unique index
CREATE UNIQUE INDEX uq_applications_job_candidate_active
ON applications (job_id, candidate_id)
WHERE deleted_at IS NULL;

-- Add comment for documentation
COMMENT ON INDEX uq_applications_job_candidate_active IS
'Ensures unique (job_id, candidate_id) pairs for active (non-deleted) applications. Allows re-creation after soft-delete.';
```

### Migration 2: Soft-Delete Cascade Triggers

```sql
-- File: migrations/0002_soft_delete_cascade_triggers.sql
-- Automatically cascade soft-deletes from jobs/candidates to applications

-- Function: Cascade soft-delete to applications when job is soft-deleted
CREATE OR REPLACE FUNCTION cascade_job_soft_delete_to_applications()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE applications
    SET deleted_at = NEW.deleted_at
    WHERE job_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER job_soft_delete_cascade
AFTER UPDATE ON jobs
FOR EACH ROW
WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
EXECUTE FUNCTION cascade_job_soft_delete_to_applications();

-- Function: Cascade soft-delete to applications when candidate is soft-deleted
CREATE OR REPLACE FUNCTION cascade_candidate_soft_delete_to_applications()
RETURNS TRIGGER AS $$
BEGIN
  IF NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL THEN
    UPDATE applications
    SET deleted_at = NEW.deleted_at
    WHERE candidate_id = NEW.id AND deleted_at IS NULL;
  END IF;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER candidate_soft_delete_cascade
AFTER UPDATE ON candidates
FOR EACH ROW
WHEN (NEW.deleted_at IS NOT NULL AND OLD.deleted_at IS NULL)
EXECUTE FUNCTION cascade_candidate_soft_delete_to_applications();

-- Add comments
COMMENT ON TRIGGER job_soft_delete_cascade ON jobs IS
'Cascades soft-deletes from jobs to applications for referential integrity.';

COMMENT ON TRIGGER candidate_soft_delete_cascade ON candidates IS
'Cascades soft-deletes from candidates to applications for referential integrity.';
```

### Migration 3: Foreign Key Constraints Update

```sql
-- File: migrations/0003_applications_fk_not_null.sql
-- Enforce NOT NULL on jobId and candidateId (applications must have both)

-- Check for existing NULL values
DO $$
BEGIN
  IF EXISTS (SELECT 1 FROM applications WHERE job_id IS NULL OR candidate_id IS NULL) THEN
    RAISE EXCEPTION 'Cannot add NOT NULL constraint: existing rows have NULL job_id or candidate_id';
  END IF;
END $$;

-- Add NOT NULL constraints
ALTER TABLE applications
  ALTER COLUMN job_id SET NOT NULL,
  ALTER COLUMN candidate_id SET NOT NULL;

-- Update foreign key constraints to cascade deletes
ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_job_id_jobs_id_fk;

ALTER TABLE applications
  ADD CONSTRAINT applications_job_id_jobs_id_fk
  FOREIGN KEY (job_id)
  REFERENCES jobs(id)
  ON DELETE CASCADE;

ALTER TABLE applications
  DROP CONSTRAINT IF EXISTS applications_candidate_id_candidates_id_fk;

ALTER TABLE applications
  ADD CONSTRAINT applications_candidate_id_candidates_id_fk
  FOREIGN KEY (candidate_id)
  REFERENCES candidates(id)
  ON DELETE CASCADE;

-- Add comment
COMMENT ON TABLE applications IS
'Applications link candidates to jobs. Hard deletes cascade from parent tables. Soft deletes handled via triggers.';
```

**Apply Migrations:**

```bash
# Generate migration files
pnpm db:generate

# Review generated SQL in drizzle/ directory
# Edit to match above patterns if needed

# Apply to Neon database
pnpm db:push

# Verify in Neon console
psql $DATABASE_URL -c "\d applications"
```

---

## Acceptance Criteria (Data Integrity)

**MUST PASS BEFORE PRODUCTION DEPLOYMENT:**

### Idempotency Tests

- [ ] Create application for (jobX, candidateY) → Success
- [ ] Repeat same request → No duplicate, returns existing
- [ ] Concurrent requests for same pair → Only one application created
- [ ] Create, soft-delete, recreate → Success (partial unique index)

### Soft-Delete Tests

- [ ] Soft-delete job → Applications soft-deleted automatically
- [ ] Soft-delete candidate → Applications soft-deleted automatically
- [ ] Query applications → Excludes soft-deleted rows
- [ ] Query applications for soft-deleted job → Returns empty array

### Transaction Tests

- [ ] Create 3 applications → All succeed or none (atomic)
- [ ] Create 3 applications, 2nd fails → Transaction rollback, zero created
- [ ] Event publishing fails → Applications still created

### Race Condition Tests

- [ ] Concurrent "Koppel" clicks → No duplicate applications
- [ ] Match vacancy B, admin deletes B mid-flight → Graceful error
- [ ] Wizard Step 2 displays job, job deleted before confirm → Clear error message

### Constraint Tests

- [ ] Verify `uq_applications_job_candidate_active` exists in production
- [ ] Verify `jobId` and `candidateId` are NOT NULL
- [ ] Verify foreign key cascades configured correctly

### GDPR Tests

- [ ] Erase candidate → Matches deleted, applications soft-deleted
- [ ] Erase candidate → Audit log entry created
- [ ] Erase candidate → PII fields scrubbed (email, phone, resume)

### Data Consistency Tests

- [ ] Application with `source: "match"` has valid `matchId`
- [ ] `matchId` points to match with same `candidateId`
- [ ] Application `jobId` matches linked match `jobId`

---

## Recommendations

### CRITICAL PRIORITY (Block Production Deploy)

1. **Implement Partial Unique Index** (Migration 1)
2. **Add Transaction Wrapper** to `createApplicationsFromMatches()`
3. **Add `deletedAt IS NULL` Checks** to all application queries
4. **Implement Database Triggers** (Migration 2)
5. **Validate Active Jobs** in linking endpoints

### HIGH PRIORITY (Must Complete in Phase 1)

6. **Update Foreign Key Constraints** (Migration 3)
7. **Add Stage Parameter Validation**
8. **Implement GDPR Erasure Flow**
9. **Add Error Handling** for partial failures
10. **Fix `listActiveJobs()` deadline filter**

### MEDIUM PRIORITY (Before Phase 2)

11. **Write Integration Tests** for idempotency
12. **Add Race Condition Tests**
13. **Document Cascade Behaviors** in schema comments
14. **Create Runbook** for data recovery scenarios

### LOW PRIORITY (Phase 3+)

15. **Add Database Connection Pooling** for concurrent writes
16. **Implement Distributed Locking** (if scaling beyond single instance)
17. **Add Metrics** for duplicate prevention success rate
18. **Performance Testing** with 1000+ concurrent requests

---

## Revised Implementation Plan

### Phase 1: Foundation (CRITICAL - 2 days)

**Day 1: Database Integrity**
1. Run Migration 1 (partial unique index) on staging
2. Run Migration 2 (soft-delete triggers) on staging
3. Verify constraints in Neon console
4. Test soft-delete cascades manually

**Day 2: Service Layer**
5. Update `createApplication()` with stage parameter validation
6. Implement `createApplicationsFromMatches()` with:
   - Transaction wrapper
   - `onConflictDoNothing` pattern
   - Active job validation
   - Match ownership validation
7. Fix `listActiveJobs()` deadline filter
8. Write unit tests for service functions

**Acceptance Gate:** All unit tests pass + manual staging tests

### Phase 2: API Layer (HIGH - 1 day)

9. Create `/api/kandidaten/[id]/match/route.ts` with soft-delete checks
10. Create `/api/opdrachten/[id]/match-kandidaten/route.ts`
11. Create `/api/kandidaten/[id]/koppel/route.ts` with:
    - Job validation before creation
    - Transaction handling
    - Event publishing (try-catch wrapped)
    - Proper error responses
12. Add Zod schemas in `src/schemas/koppeling.ts`

**Acceptance Gate:** API integration tests pass + Postman tests

### Phase 3: UI Layer (MEDIUM - 2 days)

13. Implement candidate wizard Step 1 (profile form)
14. Implement candidate wizard Step 2 (linking) with:
    - Loading states
    - Error handling for deleted jobs
    - "Al gekoppeld" badge logic
    - Skip option
15. Implement vacancy-side linking dialog

**Acceptance Gate:** E2E tests pass + QA review

### Phase 4: Production Hardening (HIGH - 1 day)

16. Run migrations on production (with rollback plan)
17. Enable monitoring for constraint violations
18. Add alerting for transaction failures
19. Document data recovery procedures
20. Smoke test in production

---

## Risk Assessment (Updated)

| Risk | Likelihood | Impact | Severity | Mitigation Status |
|------|-----------|--------|----------|-------------------|
| Duplicate applications | HIGH | HIGH | CRITICAL | ✅ Mitigated (partial unique index + onConflict) |
| Race conditions | MEDIUM | HIGH | HIGH | ✅ Mitigated (database-level atomicity) |
| Orphaned applications | MEDIUM | HIGH | HIGH | ✅ Mitigated (cascade triggers) |
| Soft-delete bypass | HIGH | MEDIUM | HIGH | ✅ Mitigated (partial unique index) |
| Transaction failures | LOW | HIGH | HIGH | ✅ Mitigated (proper error handling) |
| GDPR violations | LOW | CRITICAL | HIGH | ⚠️ Requires implementation (Phase 4) |
| Foreign key violations | LOW | MEDIUM | MEDIUM | ✅ Mitigated (NOT NULL + cascade) |
| Partial failures | MEDIUM | MEDIUM | MEDIUM | ✅ Mitigated (transactions + validation) |

**Overall Risk Posture:**
- **Before Fixes:** CRITICAL - Multiple data corruption vectors
- **After Fixes:** MEDIUM - Acceptable for production with monitoring

---

## Testing Strategy

### Unit Tests (TDD - Write First)

```typescript
// tests/services/applications.test.ts
describe("createApplicationsFromMatches", () => {
  it("creates applications for all valid matches", async () => {
    // Setup: Create candidate and 3 jobs with matches
    // Execute: Call createApplicationsFromMatches()
    // Assert: 3 applications created with correct stage
  });

  it("returns alreadyLinked for existing applications", async () => {
    // Setup: Create application for (job1, candidate1)
    // Execute: Try to create again
    // Assert: No duplicate, job1 in alreadyLinked array
  });

  it("handles soft-deleted jobs gracefully", async () => {
    // Setup: Create match, soft-delete job
    // Execute: Try to create application
    // Assert: Error or skip, no application created
  });

  it("is atomic - all or nothing", async () => {
    // Setup: 3 matches, mock error on 2nd insert
    // Execute: Call createApplicationsFromMatches()
    // Assert: Zero applications created (rollback)
  });

  it("validates match ownership", async () => {
    // Setup: Match for candidateA, try to create for candidateB
    // Execute: Call with wrong candidateId
    // Assert: Error thrown, no application created
  });
});
```

### Integration Tests

```typescript
// tests/integration/linking-flow.test.ts
describe("Candidate-Vacancy Linking Flow", () => {
  it("prevents duplicate applications via concurrent requests", async () => {
    // Setup: Candidate and job
    // Execute: 10 parallel POST /api/kandidaten/{id}/koppel requests
    // Assert: Only 1 application created
  });

  it("handles job deletion during linking", async () => {
    // Setup: Display wizard Step 2 with job X
    // Execute: Delete job X, then confirm linking
    // Assert: Clear error message, other selections succeed
  });

  it("cascades soft-deletes from job to applications", async () => {
    // Setup: Create application
    // Execute: Soft-delete job
    // Assert: Application also soft-deleted
  });
});
```

### Load Tests (Locust/k6)

```python
# tests/load/concurrent_linking.py
from locust import HttpUser, task, between

class RecruiterUser(HttpUser):
    wait_time = between(1, 3)

    @task
    def link_candidate_to_jobs(self):
        # Simulate wizard Step 2 confirmation
        self.client.post(
            f"/api/kandidaten/{CANDIDATE_ID}/koppel",
            json={"matchIds": [MATCH1, MATCH2, MATCH3]},
        )

# Run: locust -f tests/load/concurrent_linking.py --users 100 --spawn-rate 10
# Verify: Zero duplicate applications in database after test
```

---

## Conclusion

The proposed candidate-vacancy linking feature has **strong architectural design** but requires **critical data integrity fixes** before implementation. The idempotency pattern is incomplete, transaction boundaries are missing, and soft-delete handling needs tightening.

**VERDICT: CONDITIONALLY APPROVED**

Proceed with implementation **ONLY AFTER:**
1. Applying all 3 database migrations
2. Implementing transaction-wrapped service functions
3. Adding comprehensive test coverage
4. QA sign-off on staging environment

**Estimated Additional Effort:** 2 days (database hardening) + 1 day (testing) = **3 days added to Phase 1**

**Benefits of Fixes:**
- Zero risk of duplicate applications
- ACID-compliant data operations
- Production-ready error handling
- GDPR compliance foundation
- Maintainable codebase

**Questions for Product Team:**
1. Should we hard-delete or soft-delete jobMatches on candidate erasure? (GDPR)
2. What's the UX for linking to a vacancy that gets deleted mid-flight?
3. Should we support "undo" for application creation? (within X minutes)

---

**Reviewed By:** Data Integrity Guardian
**Next Review:** After Phase 1 implementation (staging environment)
**Escalation Contact:** Database team for migration approval
