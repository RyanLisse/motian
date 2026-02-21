import { db } from "../db";
import { jobMatches, jobs, candidates } from "../db/schema";
import { and, desc, eq, sql } from "drizzle-orm";

// ========== Types ==========

export type JobMatch = typeof jobMatches.$inferSelect;

export type CreateMatchData = {
  jobId: string;
  candidateId: string;
  vectorScore?: number;
  llmScore?: number;
  overallScore?: number;
  knockOutPassed?: boolean;
  matchData?: Record<string, unknown>;
};

export type MatchWithDetails = JobMatch & {
  jobTitle: string | null;
  candidateName: string | null;
};

// ========== Service Functions ==========

export async function listMatches(opts: {
  jobId?: string;
  candidateId?: string;
  status?: string;
  limit?: number;
} = {}): Promise<MatchWithDetails[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const conditions = [];

  if (opts.jobId) conditions.push(eq(jobMatches.jobId, opts.jobId));
  if (opts.candidateId) conditions.push(eq(jobMatches.candidateId, opts.candidateId));
  if (opts.status) conditions.push(eq(jobMatches.status, opts.status));

  const where = conditions.length > 0 ? and(...conditions) : undefined;

  return db
    .select({
      id: jobMatches.id,
      jobId: jobMatches.jobId,
      candidateId: jobMatches.candidateId,
      vectorScore: jobMatches.vectorScore,
      llmScore: jobMatches.llmScore,
      overallScore: jobMatches.overallScore,
      status: jobMatches.status,
      knockOutPassed: jobMatches.knockOutPassed,
      matchData: jobMatches.matchData,
      reviewedBy: jobMatches.reviewedBy,
      reviewedAt: jobMatches.reviewedAt,
      createdAt: jobMatches.createdAt,
      jobTitle: jobs.title,
      candidateName: candidates.name,
    })
    .from(jobMatches)
    .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .leftJoin(candidates, eq(jobMatches.candidateId, candidates.id))
    .where(where)
    .orderBy(desc(jobMatches.overallScore))
    .limit(limit);
}

export async function getMatchById(id: string): Promise<MatchWithDetails | null> {
  const [result] = await db
    .select({
      id: jobMatches.id,
      jobId: jobMatches.jobId,
      candidateId: jobMatches.candidateId,
      vectorScore: jobMatches.vectorScore,
      llmScore: jobMatches.llmScore,
      overallScore: jobMatches.overallScore,
      status: jobMatches.status,
      knockOutPassed: jobMatches.knockOutPassed,
      matchData: jobMatches.matchData,
      reviewedBy: jobMatches.reviewedBy,
      reviewedAt: jobMatches.reviewedAt,
      createdAt: jobMatches.createdAt,
      jobTitle: jobs.title,
      candidateName: candidates.name,
    })
    .from(jobMatches)
    .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .leftJoin(candidates, eq(jobMatches.candidateId, candidates.id))
    .where(eq(jobMatches.id, id))
    .limit(1);
  return result ?? null;
}

export async function createMatch(data: CreateMatchData): Promise<JobMatch> {
  const [result] = await db
    .insert(jobMatches)
    .values(data)
    .onConflictDoUpdate({
      target: [jobMatches.jobId, jobMatches.candidateId],
      set: {
        vectorScore: data.vectorScore,
        llmScore: data.llmScore,
        overallScore: data.overallScore,
        knockOutPassed: data.knockOutPassed,
        matchData: data.matchData,
      },
    })
    .returning();
  return result;
}

export async function updateMatchStatus(
  id: string,
  status: "approved" | "rejected",
  reviewedBy?: string,
): Promise<JobMatch | null> {
  const [result] = await db
    .update(jobMatches)
    .set({
      status,
      reviewedBy: reviewedBy ?? "recruiter",
      reviewedAt: new Date(),
    })
    .where(eq(jobMatches.id, id))
    .returning();
  return result ?? null;
}

export async function getMatchStats() {
  const rows = await db
    .select({
      status: jobMatches.status,
      count: sql<number>`count(*)::int`,
      avgScore: sql<number>`round(avg(${jobMatches.overallScore})::numeric, 1)`,
    })
    .from(jobMatches)
    .groupBy(jobMatches.status);

  const total = rows.reduce((sum, r) => sum + r.count, 0);
  return { total, byStatus: rows };
}
