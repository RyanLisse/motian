import { and, desc, eq, ilike, isNull, sql } from "drizzle-orm";
import { db } from "../db";
import { applications, candidates, jobMatches } from "../db/schema";
import { escapeLike, toTsQueryInput } from "../lib/helpers";
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

function buildMatchingInboxConditions(opts: MatchingInboxQuery) {
  const conditions = [isNull(candidates.deletedAt)];

  if (opts.status) {
    conditions.push(eq(candidates.matchingStatus, opts.status));
  }

  if (opts.query) {
    const tsInput = toTsQueryInput(opts.query);
    conditions.push(
      tsInput
        ? sql`to_tsvector('dutch', coalesce(${candidates.name}, '') || ' ' || coalesce(${candidates.role}, '') || ' ' || coalesce(${candidates.location}, '')) @@ to_tsquery('dutch', ${tsInput})`
        : ilike(candidates.name, `%${escapeLike(opts.query)}%`),
    );
  }

  if (opts.location) {
    conditions.push(ilike(candidates.location, `%${escapeLike(opts.location)}%`));
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
        SELECT count(*)::int
        FROM ${applications}
        WHERE ${applications.candidateId} = ${candidates.id}
          AND ${applications.deletedAt} IS NULL
      )`,
      matchCount: sql<number>`(
        SELECT count(*)::int
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
    .select({ count: sql<number>`count(*)::int` })
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
      count: sql<number>`count(*)::int`,
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
