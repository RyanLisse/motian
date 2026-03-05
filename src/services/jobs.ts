import { and, asc, desc, eq, gte, ilike, isNotNull, isNull, lte, or, sql } from "drizzle-orm";
import { db } from "../db";
import { jobs } from "../db/schema";
import { escapeLike, toTsQueryInput } from "../lib/helpers";

// ========== Types ==========

export type Job = typeof jobs.$inferSelect;

export type SearchJobsOptions = {
  platform?: string;
  limit?: number;
};

// ========== Service Functions ==========

/** Enkele opdracht ophalen op ID, of null als niet gevonden. */
export async function getJobById(id: string): Promise<Job | null> {
  const rows = await db
    .select()
    .from(jobs)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .limit(1);
  return rows[0] ?? null;
}

/** Opdrachten zoeken op titel/omschrijving met full-text search (tsvector/GIN).
 *  Falls back to ILIKE if the FTS query produces no results. */
export async function searchJobsByTitle(query: string, limit?: number): Promise<Job[]> {
  const safeLimit = Math.min(limit ?? 50, 100);
  const tsInput = toTsQueryInput(query);

  // Try full-text search first (uses GIN index)
  if (tsInput) {
    const ftsResults = await db
      .select()
      .from(jobs)
      .where(
        and(
          isNull(jobs.deletedAt),
          sql`to_tsvector('dutch', coalesce(${jobs.title}, '') || ' ' || coalesce(${jobs.company}, '') || ' ' || coalesce(${jobs.description}, '') || ' ' || coalesce(${jobs.location}, '') || ' ' || coalesce(${jobs.province}, '')) @@ to_tsquery('dutch', ${tsInput})`,
        ),
      )
      .orderBy(
        sql`ts_rank(to_tsvector('dutch', coalesce(${jobs.title}, '') || ' ' || coalesce(${jobs.company}, '') || ' ' || coalesce(${jobs.description}, '') || ' ' || coalesce(${jobs.location}, '') || ' ' || coalesce(${jobs.province}, '')), to_tsquery('dutch', ${tsInput})) DESC`,
      )
      .limit(safeLimit);

    if (ftsResults.length > 0) return ftsResults;
  }

  // Fallback: ILIKE for short/unusual queries
  const words = query.trim().split(/\s+/).filter(Boolean);
  const titleConditions =
    words.length > 1
      ? or(...words.map((w) => ilike(jobs.title, `%${escapeLike(w)}%`)))
      : ilike(jobs.title, `%${escapeLike(query)}%`);
  return db
    .select()
    .from(jobs)
    .where(and(isNull(jobs.deletedAt), titleConditions))
    .orderBy(desc(jobs.scrapedAt))
    .limit(safeLimit);
}

/** Opdrachten zoeken, optioneel gefilterd op platform. Soft-deleted rijen worden uitgesloten. */
export async function searchJobs(opts: SearchJobsOptions = {}): Promise<Job[]> {
  const limit = Math.min(opts.limit ?? 50, 100);

  const conditions = [isNull(jobs.deletedAt)];

  if (opts.platform) {
    conditions.push(eq(jobs.platform, opts.platform));
  }

  return db
    .select()
    .from(jobs)
    .where(and(...conditions))
    .orderBy(desc(jobs.scrapedAt))
    .limit(limit);
}

/** Alle opdrachten ophalen met paginering. */
export type ListJobsSortBy =
  | "nieuwste"
  | "tarief_hoog"
  | "tarief_laag"
  | "deadline"
  | "geplaatst"
  | "startdatum";

const sortByMap: Record<ListJobsSortBy, ReturnType<typeof desc>> = {
  nieuwste: desc(jobs.scrapedAt),
  tarief_hoog: sql`CASE WHEN ${jobs.rateMax} > 500 THEN NULL ELSE ${jobs.rateMax} END DESC NULLS LAST`,
  tarief_laag: sql`${jobs.rateMin} ASC NULLS LAST`,
  deadline: asc(jobs.applicationDeadline),
  geplaatst: desc(jobs.postedAt),
  startdatum: asc(jobs.startDate),
};

export async function listJobs(
  opts: {
    limit?: number;
    offset?: number;
    platform?: string;
    q?: string;
    province?: string;
    rateMin?: number;
    rateMax?: number;
    contractType?: string;
    workArrangement?: string;
    hasDescription?: boolean;
    sortBy?: ListJobsSortBy;
    postedAfter?: Date | string;
    postedBefore?: Date | string;
    deadlineAfter?: Date | string;
    deadlineBefore?: Date | string;
    startDateAfter?: Date | string;
    startDateBefore?: Date | string;
  } = {},
): Promise<{ data: Job[]; total: number }> {
  const limit = Math.min(opts.limit ?? 50, 100);
  const offset = opts.offset ?? 0;

  const conditions = [isNull(jobs.deletedAt)];

  if (opts.platform) {
    conditions.push(eq(jobs.platform, opts.platform));
  }

  if (opts.q) {
    const tsInput = toTsQueryInput(opts.q);
    if (tsInput) {
      conditions.push(
        sql`to_tsvector('dutch', coalesce(${jobs.title}, '') || ' ' || coalesce(${jobs.company}, '') || ' ' || coalesce(${jobs.description}, '') || ' ' || coalesce(${jobs.location}, '') || ' ' || coalesce(${jobs.province}, '')) @@ to_tsquery('dutch', ${tsInput})`,
      );
    } else {
      conditions.push(ilike(jobs.title, `%${escapeLike(opts.q)}%`));
    }
  }

  if (opts.province) {
    const provinceMatch = or(
      ilike(jobs.province, `%${escapeLike(opts.province)}%`),
      ilike(jobs.location, `%${escapeLike(opts.province)}%`),
    );
    if (provinceMatch) conditions.push(provinceMatch);
  }

  if (opts.rateMin != null) {
    conditions.push(gte(jobs.rateMax, opts.rateMin));
  }

  if (opts.rateMax != null) {
    conditions.push(lte(jobs.rateMin, opts.rateMax));
  }

  if (opts.contractType) {
    conditions.push(eq(jobs.contractType, opts.contractType));
  }

  if (opts.workArrangement) {
    conditions.push(eq(jobs.workArrangement, opts.workArrangement));
  }

  if (opts.hasDescription) {
    conditions.push(isNotNull(jobs.description));
  }

  // Date filters
  if (opts.postedAfter) {
    conditions.push(gte(jobs.postedAt, new Date(opts.postedAfter)));
  }
  if (opts.postedBefore) {
    conditions.push(lte(jobs.postedAt, new Date(opts.postedBefore)));
  }
  if (opts.deadlineAfter) {
    conditions.push(gte(jobs.applicationDeadline, new Date(opts.deadlineAfter)));
  }
  if (opts.deadlineBefore) {
    conditions.push(lte(jobs.applicationDeadline, new Date(opts.deadlineBefore)));
  }
  if (opts.startDateAfter) {
    conditions.push(gte(jobs.startDate, new Date(opts.startDateAfter)));
  }
  if (opts.startDateBefore) {
    conditions.push(lte(jobs.startDate, new Date(opts.startDateBefore)));
  }

  const whereClause = and(...conditions);

  const [{ count }] = await db
    .select({ count: sql<number>`count(*)::int` })
    .from(jobs)
    .where(whereClause);

  const orderBy = sortByMap[opts.sortBy ?? "nieuwste"];

  const data = await db
    .select()
    .from(jobs)
    .where(whereClause)
    .orderBy(orderBy)
    .limit(limit)
    .offset(offset);

  return { data, total: count };
}

/** Opdracht bijwerken. Retourneert bijgewerkte job of null. */
export async function updateJob(
  id: string,
  data: Partial<
    Pick<
      Job,
      | "title"
      | "description"
      | "location"
      | "rateMin"
      | "rateMax"
      | "contractType"
      | "workArrangement"
    >
  >,
): Promise<Job | null> {
  const rows = await db
    .update(jobs)
    .set(data)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

  return rows[0] ?? null;
}

/** Opdracht verrijken met AI-geëxtraheerde data. Retourneert bijgewerkte job of null. */
export async function updateJobEnrichment(
  id: string,
  data: Partial<
    Pick<
      Job,
      | "educationLevel"
      | "workExperienceYears"
      | "workArrangement"
      | "languages"
      | "durationMonths"
      | "extensionPossible"
      | "descriptionSummary"
      | "categories"
    >
  >,
): Promise<Job | null> {
  const rows = await db
    .update(jobs)
    .set(data)
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

  return rows[0] ?? null;
}

/** Hybrid zoeken: combineert tekst (ILIKE) + vector (pgvector) met Reciprocal Rank Fusion. */
export async function hybridSearch(
  query: string,
  opts: {
    limit?: number;
    platform?: string;
    province?: string;
    rateMin?: number;
    rateMax?: number;
    contractType?: string;
    workArrangement?: string;
    sortBy?: ListJobsSortBy;
    postedAfter?: Date | string;
    deadlineBefore?: Date | string;
    startDateAfter?: Date | string;
  } = {},
): Promise<Array<Job & { score: number }>> {
  const limit = Math.min(opts.limit ?? 20, 100);
  const k = 60; // RRF constant — higher = more weight to lower-ranked results

  // Fetch more candidates to allow for post-filtering
  const fetchSize = Math.min(limit * 3, 100);

  // Run text search + vector search in parallel
  const [textResults, vectorResults] = await Promise.all([
    searchJobsByTitle(query, fetchSize),
    (async () => {
      try {
        const { findSimilarJobs } = await import("./embedding");
        return await findSimilarJobs(query, { limit: fetchSize, minScore: 0.3 });
      } catch {
        return []; // No embeddings available — fallback to text-only
      }
    })(),
  ]);

  // Build RRF score map: score = 1/(k + rank)
  const scoreMap = new Map<string, { rrfScore: number; job?: Job }>();

  textResults.forEach((job, rank) => {
    const id = job.id;
    const entry = scoreMap.get(id) ?? { rrfScore: 0 };
    entry.rrfScore += 1 / (k + rank + 1);
    entry.job = job;
    scoreMap.set(id, entry);
  });

  vectorResults.forEach((match, rank) => {
    const id = match.id;
    const entry = scoreMap.get(id) ?? { rrfScore: 0 };
    entry.rrfScore += 1 / (k + rank + 1);
    scoreMap.set(id, entry);
  });

  // Fetch full job objects for any vector-only results
  const vectorOnlyIds = [...scoreMap.entries()].filter(([, v]) => !v.job).map(([id]) => id);
  if (vectorOnlyIds.length > 0) {
    const fetched = await db
      .select()
      .from(jobs)
      .where(and(isNull(jobs.deletedAt), or(...vectorOnlyIds.map((id) => eq(jobs.id, id)))));
    const fetchMap = new Map(fetched.map((j) => [j.id, j]));
    for (const [id, entry] of scoreMap) {
      const fetched = fetchMap.get(id);
      if (!entry.job && fetched) {
        entry.job = fetched;
      }
    }
  }

  // Sort by combined RRF score descending (default), then post-filter
  const provinceLower = opts.province?.toLowerCase();

  const filtered = [...scoreMap.entries()]
    .sort((a, b) => b[1].rrfScore - a[1].rrfScore)
    .filter(([, v]) => {
      const job = v.job;
      if (!job) return false;
      if (opts.platform && job.platform !== opts.platform) return false;
      // Province: case-insensitive partial match (DB stores "Utrecht - Utrecht" or "Utrecht")
      if (
        provinceLower &&
        !(
          job.province?.toLowerCase().includes(provinceLower) ||
          job.location?.toLowerCase().includes(provinceLower)
        )
      )
        return false;
      if (opts.rateMin != null && (job.rateMax == null || job.rateMax < opts.rateMin)) return false;
      if (opts.rateMax != null && (job.rateMin == null || job.rateMin > opts.rateMax)) return false;
      if (opts.contractType && job.contractType !== opts.contractType) return false;
      if (opts.workArrangement && job.workArrangement !== opts.workArrangement) return false;
      if (opts.postedAfter && (!job.postedAt || job.postedAt < new Date(opts.postedAfter)))
        return false;
      if (
        opts.deadlineBefore &&
        (!job.applicationDeadline || job.applicationDeadline > new Date(opts.deadlineBefore))
      )
        return false;
      if (opts.startDateAfter && (!job.startDate || job.startDate < new Date(opts.startDateAfter)))
        return false;
      return true;
    });

  // Re-sort by explicit sortBy if specified (overrides RRF relevance ranking)
  if (opts.sortBy && opts.sortBy !== "nieuwste") {
    const sortFn = getSortComparator(opts.sortBy);
    filtered.sort((a, b) => {
      const jobA = a[1].job;
      const jobB = b[1].job;
      if (!jobA || !jobB) return 0;
      return sortFn(jobA, jobB);
    });
  }

  return filtered.slice(0, limit).map(([, v]) => ({
    ...(v.job as NonNullable<typeof v.job>),
    score: Math.round(v.rrfScore * 10000) / 10000,
  }));
}

function getTimestamp(d: Date | string | null | undefined, fallback: number): number {
  if (!d) return fallback;
  return new Date(d).getTime();
}

function getSortComparator(sortBy: ListJobsSortBy): (a: Job, b: Job) => number {
  switch (sortBy) {
    case "tarief_hoog":
      return (a, b) => {
        const aRate = a.rateMax && a.rateMax <= 500 ? a.rateMax : 0;
        const bRate = b.rateMax && b.rateMax <= 500 ? b.rateMax : 0;
        return bRate - aRate;
      };
    case "tarief_laag":
      return (a, b) =>
        (a.rateMin ?? Number.MAX_SAFE_INTEGER) - (b.rateMin ?? Number.MAX_SAFE_INTEGER);
    case "deadline":
      return (a, b) =>
        getTimestamp(a.applicationDeadline, Number.MAX_SAFE_INTEGER) -
        getTimestamp(b.applicationDeadline, Number.MAX_SAFE_INTEGER);
    case "geplaatst":
      return (a, b) => getTimestamp(b.postedAt, 0) - getTimestamp(a.postedAt, 0);
    case "startdatum":
      return (a, b) =>
        getTimestamp(a.startDate, Number.MAX_SAFE_INTEGER) -
        getTimestamp(b.startDate, Number.MAX_SAFE_INTEGER);
    default:
      return () => 0;
  }
}

/** Alle actieve (niet-verwijderde) jobs ophalen. Hogere limiet voor batch matching. */
export async function listActiveJobs(limit?: number): Promise<Job[]> {
  const safeLimit = Math.min(limit ?? 200, 500);

  return db
    .select()
    .from(jobs)
    .where(isNull(jobs.deletedAt))
    .orderBy(desc(jobs.scrapedAt))
    .limit(safeLimit);
}

/** Opdracht soft-deleten. Retourneert true als gevonden en verwijderd. */
export async function deleteJob(id: string): Promise<boolean> {
  const rows = await db
    .update(jobs)
    .set({ deletedAt: new Date() })
    .where(and(eq(jobs.id, id), isNull(jobs.deletedAt)))
    .returning();

  return rows.length > 0;
}

/** Statistieken: aantal per platform, per provincie, gemiddeld tarief. */
export async function getJobStats(): Promise<{
  total: number;
  byPlatform: Array<{ platform: string; count: number }>;
  byProvince: Array<{ province: string | null; count: number }>;
  avgRateMin: number | null;
  avgRateMax: number | null;
}> {
  const [byPlatformRows, byProvinceRows, aggRow] = await Promise.all([
    db
      .select({
        platform: jobs.platform,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .where(isNull(jobs.deletedAt))
      .groupBy(jobs.platform)
      .orderBy(sql`count(*) desc`),
    db
      .select({
        province: jobs.province,
        count: sql<number>`count(*)::int`,
      })
      .from(jobs)
      .where(isNull(jobs.deletedAt))
      .groupBy(jobs.province)
      .orderBy(sql`count(*) desc`)
      .limit(20),
    db
      .select({
        total: sql<number>`count(*)::int`,
        avgRateMin: sql<number | null>`avg(${jobs.rateMin})::float`,
        avgRateMax: sql<number | null>`avg(${jobs.rateMax})::float`,
      })
      .from(jobs)
      .where(isNull(jobs.deletedAt)),
  ]);

  const agg = aggRow[0];
  return {
    total: agg?.total ?? 0,
    byPlatform: byPlatformRows.map((r) => ({ platform: r.platform, count: r.count })),
    byProvince: byProvinceRows.map((r) => ({
      province: r.province,
      count: r.count,
    })),
    avgRateMin: agg?.avgRateMin != null ? Math.round(agg.avgRateMin) : null,
    avgRateMax: agg?.avgRateMax != null ? Math.round(agg.avgRateMax) : null,
  };
}
