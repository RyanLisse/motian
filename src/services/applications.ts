import { db } from "../db";
import { applications, jobs, candidates } from "../db/schema";
import { and, desc, eq, isNull, sql } from "drizzle-orm";

// ========== Constants ==========

export const VALID_STAGES = [
  "new",
  "screening",
  "interview",
  "offer",
  "hired",
  "rejected",
] as const;

export type ApplicationStage = (typeof VALID_STAGES)[number];

// ========== Types ==========

export type Application = typeof applications.$inferSelect;

export type CreateApplicationData = {
  jobId: string;
  candidateId: string;
  matchId?: string;
  source?: string;
  notes?: string;
};

export type ApplicationWithDetails = Application & {
  jobTitle: string | null;
  candidateName: string | null;
};

// ========== Shared Select Shape ==========

const applicationWithDetailsSelect = {
  id: applications.id,
  jobId: applications.jobId,
  candidateId: applications.candidateId,
  matchId: applications.matchId,
  stage: applications.stage,
  previousStage: applications.previousStage,
  stageChangedAt: applications.stageChangedAt,
  notes: applications.notes,
  source: applications.source,
  createdAt: applications.createdAt,
  updatedAt: applications.updatedAt,
  deletedAt: applications.deletedAt,
  jobTitle: jobs.title,
  candidateName: candidates.name,
};

// ========== Service Functions ==========

export async function listApplications(
  opts: {
    jobId?: string;
    candidateId?: string;
    stage?: string;
    limit?: number;
  } = {},
): Promise<ApplicationWithDetails[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const conditions = [isNull(applications.deletedAt)];

  if (opts.jobId) conditions.push(eq(applications.jobId, opts.jobId));
  if (opts.candidateId)
    conditions.push(eq(applications.candidateId, opts.candidateId));
  if (opts.stage) conditions.push(eq(applications.stage, opts.stage));

  return db
    .select(applicationWithDetailsSelect)
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(and(...conditions))
    .orderBy(desc(applications.createdAt))
    .limit(limit);
}

export async function getApplicationById(
  id: string,
): Promise<ApplicationWithDetails | null> {
  const [result] = await db
    .select(applicationWithDetailsSelect)
    .from(applications)
    .leftJoin(jobs, eq(applications.jobId, jobs.id))
    .leftJoin(candidates, eq(applications.candidateId, candidates.id))
    .where(and(eq(applications.id, id), isNull(applications.deletedAt)))
    .limit(1);
  return result ?? null;
}

export async function createApplication(
  data: CreateApplicationData,
): Promise<Application> {
  const [result] = await db
    .insert(applications)
    .values({
      jobId: data.jobId,
      candidateId: data.candidateId,
      matchId: data.matchId,
      source: data.source ?? "manual",
      notes: data.notes,
    })
    .returning();
  return result;
}

export async function updateApplicationStage(
  id: string,
  newStage: string,
  notes?: string,
): Promise<Application | null> {
  if (!VALID_STAGES.includes(newStage as ApplicationStage)) return null;

  return db.transaction(async (tx) => {
    const [current] = await tx
      .select({ stage: applications.stage })
      .from(applications)
      .where(and(eq(applications.id, id), isNull(applications.deletedAt)))
      .limit(1);

    if (!current) return null;

    const [result] = await tx
      .update(applications)
      .set({
        previousStage: current.stage,
        stage: newStage,
        stageChangedAt: new Date(),
        notes: notes ?? undefined,
        updatedAt: new Date(),
      })
      .where(
        and(
          eq(applications.id, id),
          eq(applications.stage, current.stage),
          isNull(applications.deletedAt),
        ),
      )
      .returning();
    return result ?? null;
  });
}

export async function deleteApplication(id: string): Promise<boolean> {
  const [result] = await db
    .update(applications)
    .set({ deletedAt: new Date(), updatedAt: new Date() })
    .where(and(eq(applications.id, id), isNull(applications.deletedAt)))
    .returning();
  return !!result;
}

export async function getApplicationStats() {
  const rows = await db
    .select({
      stage: applications.stage,
      count: sql<number>`count(*)::int`,
    })
    .from(applications)
    .where(isNull(applications.deletedAt))
    .groupBy(applications.stage)
    .orderBy(applications.stage);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return { total, byStage: rows };
}
