import { and, db, desc, eq, gte, inArray, isNull, isPostgresDatabase, sql } from "../db";
import { applications, candidates, jobMatches, jobs } from "../db/schema";
import { caseInsensitiveContains, toTsQueryInput } from "../lib/helpers";
import type { Candidate, CandidateMatchingStatus } from "./candidates";

export type MatchingInboxItem = Candidate & {
  activeApplicationCount: number;
  matchCount: number;
  bestMatchScore: number | null;
};

export type MatchingInboxQuery = {
  status?: CandidateMatchingStatus;
  query?: string;
  location?: string;
  limit?: number;
  offset?: number;
};

export type CanvasMatchQuery = {
  vacatureIds?: string[];
  kandidaatIds?: string[];
  minScore: number;
  limit: number;
};

export async function getCanvasMatches(params: CanvasMatchQuery) {
  const conditions = [gte(jobMatches.matchScore, params.minScore)];
  if (params.vacatureIds?.length) {
    conditions.push(inArray(jobMatches.jobId, params.vacatureIds));
  }
  if (params.kandidaatIds?.length) {
    conditions.push(inArray(jobMatches.candidateId, params.kandidaatIds));
  }

  return db
    .select({
      matchScore: jobMatches.matchScore,
      status: jobMatches.status,
      jobId: jobMatches.jobId,
      candidateId: jobMatches.candidateId,
      jobTitle: jobs.title,
      jobCompany: jobs.company,
      jobPlatform: jobs.platform,
      candidateName: candidates.name,
      candidateRole: candidates.role,
    })
    .from(jobMatches)
    .innerJoin(jobs, eq(jobMatches.jobId, jobs.id))
    .innerJoin(candidates, eq(jobMatches.candidateId, candidates.id))
    .where(and(...conditions))
    .orderBy(desc(jobMatches.matchScore))
    .limit(params.limit);
}

function buildMatchingInboxConditions(opts: MatchingInboxQuery) {
  const conditions = [isNull(candidates.deletedAt)];

  if (opts.status) {
    conditions.push(eq(candidates.matchingStatus, opts.status));
  }

  if (opts.query) {
    const tsInput = toTsQueryInput(opts.query);
    conditions.push(
      tsInput && isPostgresDatabase()
        ? sql`to_tsvector('dutch', coalesce(${candidates.name}, '') || ' ' || coalesce(${candidates.role}, '') || ' ' || coalesce(${candidates.location}, '')) @@ to_tsquery('dutch', ${tsInput})`
        : caseInsensitiveContains(candidates.name, opts.query),
    );
  }

  if (opts.location) {
    conditions.push(caseInsensitiveContains(candidates.location, opts.location));
  }

  return conditions;
}

export async function listMatchingInboxCandidates(
  opts: MatchingInboxQuery = {},
): Promise<MatchingInboxItem[]> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = Math.max(0, opts.offset ?? 0);
  const conditions = buildMatchingInboxConditions(opts);

  const rows = await db
    .select({
      candidate: candidates,
      activeApplicationCount: sql<number>`(
        SELECT CAST(count(*) AS INTEGER)
        FROM ${applications}
        WHERE ${applications.candidateId} = ${candidates.id}
          AND ${applications.deletedAt} IS NULL
      )`,
      matchCount: sql<number>`(
        SELECT CAST(count(*) AS INTEGER)
        FROM ${jobMatches}
        WHERE ${jobMatches.candidateId} = ${candidates.id}
      )`,
      bestMatchScore: sql<number | null>`(
        SELECT max(${jobMatches.matchScore})
        FROM ${jobMatches}
        WHERE ${jobMatches.candidateId} = ${candidates.id}
      )`,
    })
    .from(candidates)
    .where(and(...conditions))
    .orderBy(desc(candidates.lastMatchedAt), desc(candidates.updatedAt), desc(candidates.createdAt))
    .limit(limit)
    .offset(offset);

  return rows.map((row) => ({
    ...row.candidate,
    activeApplicationCount: row.activeApplicationCount,
    matchCount: row.matchCount,
    bestMatchScore: row.bestMatchScore,
  }));
}

export async function countMatchingInboxCandidates(
  opts: Omit<MatchingInboxQuery, "limit" | "offset"> = {},
): Promise<number> {
  const conditions = buildMatchingInboxConditions(opts);
  const [{ count }] = await db
    .select({ count: sql<number>`CAST(count(*) AS INTEGER)` })
    .from(candidates)
    .where(and(...conditions));

  return count ?? 0;
}

export async function getMatchingInboxStatusCounts(
  opts: Omit<MatchingInboxQuery, "status" | "limit" | "offset"> = {},
): Promise<Record<CandidateMatchingStatus, number>> {
  const rows = await db
    .select({
      status: candidates.matchingStatus,
      count: sql<number>`CAST(count(*) AS INTEGER)`,
    })
    .from(candidates)
    .where(and(...buildMatchingInboxConditions(opts)))
    .groupBy(candidates.matchingStatus);

  const counts: Record<CandidateMatchingStatus, number> = {
    open: 0,
    in_review: 0,
    linked: 0,
    no_match: 0,
  };

  for (const row of rows) {
    if (row.status in counts) {
      counts[row.status as CandidateMatchingStatus] = row.count;
    }
  }

  return counts;
}
