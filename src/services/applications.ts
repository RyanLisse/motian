import { and, desc, eq, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { applications } from "../db/schema";

export type Application = typeof applications.$inferSelect;

type ApplicationInsertExecutor = Pick<typeof db, "insert">;

type CreateApplicationInput = {
  jobId: string;
  candidateId: string;
  matchId?: string;
  source?: string;
  stage?: string;
  notes?: string;
};

const VALID_STAGES = ["new", "screening", "interview", "offer", "hired", "rejected"];

export type ListApplicationsOpts = {
  jobId?: string;
  candidateId?: string;
  stage?: string;
  limit?: number;
  offset?: number;
};

function buildListConditions(opts: ListApplicationsOpts) {
  const conditions = [isNull(applications.deletedAt)];
  if (opts.jobId) conditions.push(eq(applications.jobId, opts.jobId));
  if (opts.candidateId) conditions.push(eq(applications.candidateId, opts.candidateId));
  if (opts.stage) conditions.push(eq(applications.stage, opts.stage));
  return conditions;
}

export async function listApplications(opts: ListApplicationsOpts = {}): Promise<Application[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = Math.max(0, opts.offset ?? 0);
  const conditions = buildListConditions(opts);
  return db
    .select()
    .from(applications)
    .where(and(...conditions))
    .orderBy(desc(applications.createdAt))
    .limit(limit)
    .offset(offset);
}

export async function countApplications(
  opts: Omit<ListApplicationsOpts, "limit" | "offset"> = {},
): Promise<number> {
  const conditions = buildListConditions(opts);
  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(applications)
    .where(and(...conditions));
  return count ?? 0;
}

export async function getApplicationById(id: string): Promise<Application | null> {
  const rows = await db
    .select()
    .from(applications)
    .where(and(eq(applications.id, id), isNull(applications.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

export async function createApplication(data: {
  jobId: string;
  candidateId: string;
  matchId?: string;
  source?: string;
  stage?: string;
  notes?: string;
}): Promise<Application> {
  const stage = data.stage && VALID_STAGES.includes(data.stage) ? data.stage : "new";
  const rows = await db
    .insert(applications)
    .values({
      jobId: data.jobId,
      candidateId: data.candidateId,
      matchId: data.matchId ?? null,
      source: data.source ?? "manual",
      notes: data.notes ?? null,
      stage,
    })
    .returning();
  return rows[0];
}

async function insertApplicationIfMissing(
  executor: ApplicationInsertExecutor,
  data: CreateApplicationInput,
): Promise<Application | null> {
  const stage = data.stage && VALID_STAGES.includes(data.stage) ? data.stage : "new";
  const rows = await executor
    .insert(applications)
    .values({
      jobId: data.jobId,
      candidateId: data.candidateId,
      matchId: data.matchId ?? null,
      source: data.source ?? "manual",
      notes: data.notes ?? null,
      stage,
    })
    .onConflictDoNothing({
      target: [applications.jobId, applications.candidateId],
      where: isNull(applications.deletedAt),
    })
    .returning();

  return rows[0] ?? null;
}

export type CreateApplicationsFromMatchesResult = {
  created: Application[];
  alreadyLinked: string[];
};

/**
 * Create applications from match results (e.g. after recruiter confirms top-N).
 * Idempotent: skips (jobId, candidateId) pairs that already have an application.
 * Sets stage (default "screening"), source "match", and links matchId.
 */
export async function createApplicationsFromMatches(
  candidateId: string,
  matches: Array<{ jobId: string; matchId?: string | null }>,
  stage: string = "screening",
): Promise<CreateApplicationsFromMatchesResult> {
  if (!VALID_STAGES.includes(stage)) stage = "screening";
  return db.transaction(async (tx) => {
    const created: Application[] = [];
    const alreadyLinked: string[] = [];

    for (const { jobId, matchId } of matches) {
      const application = await insertApplicationIfMissing(tx, {
        jobId,
        candidateId,
        matchId: matchId ?? undefined,
        source: "match",
        stage,
      });

      if (application) created.push(application);
      else alreadyLinked.push(jobId);
    }

    return { created, alreadyLinked };
  });
}

export type CreateApplicationsForJobResult = {
  created: Application[];
  alreadyLinked: string[];
};

/**
 * Create applications from job side (vacancy → candidates). Idempotent per (jobId, candidateId).
 */
export async function createApplicationsForJob(
  jobId: string,
  pairs: Array<{ candidateId: string; matchId?: string | null }>,
  stage: string = "screening",
): Promise<CreateApplicationsForJobResult> {
  if (!VALID_STAGES.includes(stage)) stage = "screening";
  return db.transaction(async (tx) => {
    const created: Application[] = [];
    const alreadyLinked: string[] = [];

    for (const { candidateId, matchId } of pairs) {
      const application = await insertApplicationIfMissing(tx, {
        jobId,
        candidateId,
        matchId: matchId ?? undefined,
        source: "match",
        stage,
      });

      if (application) created.push(application);
      else alreadyLinked.push(candidateId);
    }

    return { created, alreadyLinked };
  });
}

export async function updateApplicationStage(
  id: string,
  stage: string,
  notes?: string,
): Promise<Application | null> {
  if (!VALID_STAGES.includes(stage)) return null;
  const updates: Record<string, unknown> = { stage, updatedAt: new Date() };
  if (notes !== undefined) updates.notes = notes;
  const rows = await db
    .update(applications)
    .set(updates)
    .where(and(eq(applications.id, id), isNull(applications.deletedAt)))
    .returning();
  return rows[0] ?? null;
}

export async function deleteApplication(id: string): Promise<boolean> {
  const result = await db
    .update(applications)
    .set({ deletedAt: new Date() })
    .where(and(eq(applications.id, id), isNull(applications.deletedAt)));
  return (result.rowCount ?? 0) > 0;
}

export async function getApplicationStats(): Promise<{
  total: number;
  byStage: Record<string, number>;
}> {
  const rows = await db
    .select({
      stage: applications.stage,
      count: sql<number>`count(*)::int`,
    })
    .from(applications)
    .where(isNull(applications.deletedAt))
    .groupBy(applications.stage);

  const byStage: Record<string, number> = {};
  let total = 0;
  for (const row of rows) {
    byStage[row.stage] = row.count;
    total += row.count;
  }
  return { total, byStage };
}
