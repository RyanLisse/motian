import { and, desc, eq, sql } from "drizzle-orm";
import { db } from "../db";
import { jobMatches } from "../db/schema";

// ========== Types ==========

export type Match = typeof jobMatches.$inferSelect;

export type ListMatchesOptions = {
  jobId?: string;
  candidateId?: string;
  status?: string;
  limit?: number;
  offset?: number;
};

export type CreateMatchData = {
  jobId: string;
  candidateId: string;
  matchScore: number;
  confidence?: number;
  reasoning?: string;
  model?: string;
};

// ========== Service Functions ==========

/** Matches ophalen met optionele filters. Geordend op matchScore aflopend. */
export async function listMatches(opts: ListMatchesOptions = {}): Promise<Match[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = Math.max(0, opts.offset ?? 0);

  const conditions: ReturnType<typeof eq>[] = [];

  if (opts.jobId) {
    conditions.push(eq(jobMatches.jobId, opts.jobId));
  }

  if (opts.candidateId) {
    conditions.push(eq(jobMatches.candidateId, opts.candidateId));
  }

  if (opts.status) {
    conditions.push(eq(jobMatches.status, opts.status));
  }

  return db
    .select()
    .from(jobMatches)
    .where(and(...conditions))
    .orderBy(desc(jobMatches.matchScore))
    .limit(limit)
    .offset(offset);
}

export async function countMatches(
  opts: Omit<ListMatchesOptions, "limit" | "offset"> = {},
): Promise<number> {
  const conditions: ReturnType<typeof eq>[] = [];
  if (opts.jobId) conditions.push(eq(jobMatches.jobId, opts.jobId));
  if (opts.candidateId) conditions.push(eq(jobMatches.candidateId, opts.candidateId));
  if (opts.status) conditions.push(eq(jobMatches.status, opts.status));

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobMatches)
    .where(and(...conditions));
  return count ?? 0;
}

/** Enkele match ophalen op ID, of null als niet gevonden. */
export async function getMatchById(id: string): Promise<Match | null> {
  const rows = await db.select().from(jobMatches).where(eq(jobMatches.id, id)).limit(1);

  return rows[0] ?? null;
}

/** Match-status bijwerken met reviewer en tijdstempel. Retourneert bijgewerkte match of null. */
export async function updateMatchStatus(
  id: string,
  status: string,
  reviewedBy?: string,
): Promise<Match | null> {
  const rows = await db
    .update(jobMatches)
    .set({
      status,
      reviewedBy: reviewedBy ?? null,
      reviewedAt: new Date(),
    })
    .where(eq(jobMatches.id, id))
    .returning();

  return rows[0] ?? null;
}

/** Nieuwe match aanmaken en teruggeven. */
export async function createMatch(data: CreateMatchData): Promise<Match> {
  const rows = await db
    .insert(jobMatches)
    .values({
      jobId: data.jobId,
      candidateId: data.candidateId,
      matchScore: data.matchScore,
      confidence: data.confidence,
      reasoning: data.reasoning,
      model: data.model,
    })
    .returning();

  return rows[0];
}

/** Matches voor een specifieke opdracht ophalen. Geordend op matchScore aflopend. */
export async function getMatchesForJob(jobId: string, limit?: number): Promise<Match[]> {
  const safeLimit = Math.min(limit ?? 50, 100);

  return db
    .select()
    .from(jobMatches)
    .where(eq(jobMatches.jobId, jobId))
    .orderBy(desc(jobMatches.matchScore))
    .limit(safeLimit);
}

/** Matches voor een specifieke kandidaat ophalen. Geordend op matchScore aflopend. */
export async function getMatchesForCandidate(
  candidateId: string,
  limit?: number,
): Promise<Match[]> {
  const safeLimit = Math.min(limit ?? 50, 100);

  return db
    .select()
    .from(jobMatches)
    .where(eq(jobMatches.candidateId, candidateId))
    .orderBy(desc(jobMatches.matchScore))
    .limit(safeLimit);
}
