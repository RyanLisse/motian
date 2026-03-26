import { and, db, inArray, isNotNull, isNull, type SQL, sql } from "../../db";
import { applications, jobs } from "../../db/schema";
import type { ListJobsSortBy } from "./filters";
import { getJobReadSelection, type Job } from "./repository";

type DedupableJob = Pick<
  Job,
  "id" | "title" | "company" | "endClient" | "province" | "location" | "scrapedAt"
>;

type DedupedJobIdRow = { id: string };
type DedupedJobPageRow = { id: string | null; total: number | string | null };
type ResolvedJobsDeduplicationMode = "normalized";

function normalizeDeduplicationPart(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function getListSortOrderSql(sortBy: ListJobsSortBy = "nieuwste") {
  switch (sortBy) {
    case "tarief_hoog":
      return {
        partitionOrderBy: sql`case when ${jobs.rateMax} > 500 then 1 else 0 end, ${jobs.rateMax} desc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`case when sort_rate_max is null then 1 else 0 end, sort_rate_max desc, id desc`,
      };
    case "tarief_laag":
      return {
        partitionOrderBy: sql`${jobs.rateMin} asc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`case when sort_rate_min is null then 1 else 0 end, sort_rate_min asc, id desc`,
      };
    case "deadline":
      return {
        partitionOrderBy: sql`${jobs.applicationDeadline} asc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`case when sort_application_deadline is null then 1 else 0 end, sort_application_deadline asc, id desc`,
      };
    case "deadline_desc":
      return {
        partitionOrderBy: sql`${jobs.applicationDeadline} desc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`case when sort_application_deadline is null then 1 else 0 end, sort_application_deadline desc, id desc`,
      };
    case "geplaatst":
      return {
        partitionOrderBy: sql`${jobs.postedAt} desc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`case when sort_posted_at is null then 1 else 0 end, sort_posted_at desc, id desc`,
      };
    case "startdatum":
      return {
        partitionOrderBy: sql`${jobs.startDate} asc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`case when sort_start_date is null then 1 else 0 end, sort_start_date asc, id desc`,
      };
    default:
      return {
        partitionOrderBy: sql`${jobs.scrapedAt} desc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`case when scraped_at is null then 1 else 0 end, scraped_at desc, id desc`,
      };
  }
}

function getDeduplicationFallbackExpression(value: SQL): SQL {
  return sql`lower(coalesce(${value}, ''))`;
}

export function getDeduplicationPartitionExpressions(mode: ResolvedJobsDeduplicationMode) {
  if (mode === "normalized") {
    return {
      title: sql`${jobs.dedupeTitleNormalized}`,
      client: sql`${jobs.dedupeClientNormalized}`,
      location: sql`${jobs.dedupeLocationNormalized}`,
    };
  }

  return {
    title: getDeduplicationFallbackExpression(sql`${jobs.title}`),
    client: getDeduplicationFallbackExpression(
      sql`coalesce(${jobs.endClient}, ${jobs.company}, '')`,
    ),
    location: getDeduplicationFallbackExpression(
      sql`coalesce(${jobs.province}, ${jobs.location}, '')`,
    ),
  };
}

async function withJobsDeduplicationCompatibility<T>(
  runForMode: (mode: ResolvedJobsDeduplicationMode) => Promise<T>,
): Promise<T> {
  return runForMode("normalized");
}

/** Maximum rows fed into the PARTITION BY window to bound CPU cost. */
const DEDUPE_PRE_FETCH_CAP = 500;

function computePreFetchLimit(offset: number, limit: number): number {
  return Math.min((offset + limit) * 5, DEDUPE_PRE_FETCH_CAP);
}

export function buildDedupedJobsCte({
  whereClause,
  partitionOrderBy,
  deduplicationPartitionExpressions,
  extraSelections,
  preFetchLimit,
}: {
  whereClause: SQL;
  partitionOrderBy: SQL;
  deduplicationPartitionExpressions: ReturnType<typeof getDeduplicationPartitionExpressions>;
  extraSelections?: SQL;
  /** When set, adds a pre_filtered CTE that caps rows before the window function. */
  preFetchLimit?: number;
}) {
  const selectColumns = sql`
    ${jobs.id} as id,
    ${jobs.scrapedAt} as scraped_at,
    case when ${jobs.rateMax} > 500 then null else ${jobs.rateMax} end as sort_rate_max,
    ${jobs.rateMin} as sort_rate_min,
    ${jobs.applicationDeadline} as sort_application_deadline,
    ${jobs.postedAt} as sort_posted_at,
    ${jobs.startDate} as sort_start_date
    ${extraSelections ? sql`, ${extraSelections}` : sql``},
    ${deduplicationPartitionExpressions.title} as dedupe_title,
    ${deduplicationPartitionExpressions.client} as dedupe_client,
    ${deduplicationPartitionExpressions.location} as dedupe_location`;

  if (preFetchLimit != null && preFetchLimit > 0) {
    return sql`
      with pre_filtered as (
        select ${selectColumns}
        from ${jobs}
        where ${whereClause}
        order by ${partitionOrderBy}
        limit ${preFetchLimit}
      ),
      ranked_jobs as (
        select pre_filtered.*,
          row_number() over (
            partition by dedupe_title, dedupe_client, dedupe_location
            order by ${partitionOrderBy}
          ) as dedupe_rank
        from pre_filtered
      ),
      deduped_jobs as (
        select * from ranked_jobs where dedupe_rank = 1
      )
    `;
  }

  return sql`
    with ranked_jobs as (
      select ${selectColumns},
        row_number() over (
          partition by dedupe_title, dedupe_client, dedupe_location
          order by ${partitionOrderBy}
        ) as dedupe_rank
      from ${jobs}
      where ${whereClause}
    ),
    deduped_jobs as (
      select *
      from ranked_jobs
      where dedupe_rank = 1
    )
  `;
}

export function getJobDeduplicationKey(job: DedupableJob) {
  return [
    normalizeDeduplicationPart(job.title),
    normalizeDeduplicationPart(job.endClient ?? job.company),
    normalizeDeduplicationPart(job.province ?? job.location),
  ].join("\u001f");
}

function isPreferableDedupCandidate(
  candidate: { score: number; job: DedupableJob },
  current: { score: number; job: DedupableJob },
): boolean {
  if (candidate.score !== current.score) {
    return candidate.score > current.score;
  }

  const candidateDate = candidate.job.scrapedAt ? new Date(candidate.job.scrapedAt).getTime() : 0;
  const currentDate = current.job.scrapedAt ? new Date(current.job.scrapedAt).getTime() : 0;
  if (candidateDate !== currentDate) {
    return candidateDate > currentDate;
  }

  return candidate.job.id > current.job.id;
}

export function collapseScoredJobsByVacancy<TJob extends DedupableJob>(
  entries: Array<{ job: TJob; score: number }>,
) {
  const grouped = new Map<string, { job: TJob; score: number; representativeScore: number }>();

  for (const entry of entries) {
    const dedupeKey = getJobDeduplicationKey(entry.job);
    const existing = grouped.get(dedupeKey);

    if (existing) {
      const shouldReplaceRepresentative = isPreferableDedupCandidate(
        { score: entry.score, job: entry.job as DedupableJob },
        { score: existing.representativeScore, job: existing.job },
      );

      existing.score += entry.score;
      if (shouldReplaceRepresentative) {
        existing.job = entry.job;
        existing.representativeScore = entry.score;
      }

      continue;
    }

    grouped.set(dedupeKey, { ...entry, representativeScore: entry.score });
  }

  return [...grouped.values()].map(({ job, score }) => ({ job, score }));
}

export async function loadJobsByIds(ids: string[]): Promise<Job[]> {
  if (ids.length === 0) return [];

  const rows = await db
    .select(getJobReadSelection())
    .from(jobs)
    .where(inArray(jobs.id, ids))
    .limit(ids.length);

  const rowMap = new Map(rows.map((job) => [job.id, job]));
  return ids.flatMap((id) => {
    const job = rowMap.get(id);
    return job ? [job] : [];
  });
}

export async function loadJobPageRowsByIds(ids: string[]) {
  if (ids.length === 0) return [];

  const pipelineCounts = db
    .select({
      jobId: applications.jobId,
      pipelineCount: sql<number>`sum(case when ${applications.stage} != 'rejected' then 1 else 0 end)::int`,
    })
    .from(applications)
    .where(
      and(
        inArray(applications.jobId, ids),
        isNotNull(applications.jobId),
        isNull(applications.deletedAt),
      ),
    )
    .groupBy(applications.jobId)
    .as("pipeline_counts");

  const rows = await db
    .select({
      id: jobs.id,
      title: jobs.title,
      company: sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`,
      location: sql<string | null>`coalesce(${jobs.location}, ${jobs.province})`,
      platform: jobs.platform,
      workArrangement: jobs.workArrangement,
      contractType: jobs.contractType,
      applicationDeadline: jobs.applicationDeadline,
      pipelineCount: sql<number>`coalesce(${pipelineCounts.pipelineCount}, 0)::int`,
    })
    .from(jobs)
    .leftJoin(pipelineCounts, sql`${pipelineCounts.jobId} = ${jobs.id}`)
    .where(inArray(jobs.id, ids))
    .limit(ids.length);

  const rowMap = new Map(
    rows.map((row) => [
      row.id,
      {
        ...row,
        hasPipeline: row.pipelineCount > 0,
      },
    ]),
  );

  return ids.flatMap((id) => {
    const row = rowMap.get(id);
    return row ? [row] : [];
  });
}

export async function fetchDedupedJobIds({
  whereClause,
  limit,
  offset = 0,
  sortBy,
  partitionOrderBy,
  resultOrderBy,
  extraSelections,
}: {
  whereClause: SQL;
  limit: number;
  offset?: number;
  sortBy?: ListJobsSortBy;
  partitionOrderBy?: SQL;
  resultOrderBy?: SQL;
  extraSelections?: SQL;
}): Promise<string[]> {
  const sortOrder = sortBy ? getListSortOrderSql(sortBy) : undefined;

  return withJobsDeduplicationCompatibility(async (mode) => {
    const cte = buildDedupedJobsCte({
      whereClause,
      partitionOrderBy:
        partitionOrderBy ??
        sortOrder?.partitionOrderBy ??
        sql`${jobs.scrapedAt} desc, ${jobs.id} desc`,
      deduplicationPartitionExpressions: getDeduplicationPartitionExpressions(mode),
      extraSelections,
      preFetchLimit: computePreFetchLimit(offset, limit),
    });
    const result = await (
      db as unknown as { execute(sql: SQL): Promise<{ rows: DedupedJobIdRow[] }> }
    ).execute(sql`
      ${cte}
      select id
      from deduped_jobs
      order by ${resultOrderBy ?? sortOrder?.resultOrderBy ?? sql`scraped_at desc, id desc`}
      limit ${limit}
      offset ${offset}
    `);
    const rows = result.rows;

    return rows.map((row) => row.id);
  });
}

export async function fetchDedupedJobsPage({
  whereClause,
  limit,
  offset = 0,
  sortBy,
}: {
  whereClause: SQL;
  limit: number;
  offset?: number;
  sortBy?: ListJobsSortBy;
}): Promise<{ ids: string[]; total: number }> {
  const sortOrder = getListSortOrderSql(sortBy);

  return withJobsDeduplicationCompatibility(async (mode) => {
    const cte = buildDedupedJobsCte({
      whereClause,
      partitionOrderBy: sortOrder.partitionOrderBy,
      deduplicationPartitionExpressions: getDeduplicationPartitionExpressions(mode),
      preFetchLimit: computePreFetchLimit(offset, limit),
    });
    const result = await (
      db as unknown as { execute(sql: SQL): Promise<{ rows: DedupedJobPageRow[] }> }
    ).execute(sql`
      ${cte}
      select id, cast(count(*) over() as integer) as total
      from deduped_jobs
      order by ${sortOrder.resultOrderBy}
      limit ${limit}
      offset ${offset}
    `);
    const rows = result.rows;

    const total = rows[0]?.total == null ? 0 : Number(rows[0].total);

    return {
      ids: rows.flatMap((row) => (row.id ? [row.id] : [])),
      total,
    };
  });
}
