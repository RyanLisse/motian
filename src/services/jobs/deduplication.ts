import { db, inArray, type SQL, sql } from "../../db";
import { jobs } from "../../db/schema";
import type { ListJobsSortBy } from "./filters";
import { getJobReadSelection, type Job } from "./repository";

type DedupableJob = Pick<Job, "title" | "company" | "endClient" | "province" | "location">;

type DedupedJobIdRow = { id: string };
type DedupedJobPageRow = { id: string | null; total: number | string | null };
type JobsDeduplicationMode = "normalized";
type ResolvedJobsDeduplicationMode = JobsDeduplicationMode;

function normalizeDeduplicationPart(value: string | null | undefined) {
  return (value ?? "")
    .toLocaleLowerCase("nl-NL")
    .replace(/[^\p{L}\p{N}]+/gu, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function getListSortOrderSql(sortBy: ListJobsSortBy = "nieuwste") {
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

function getDeduplicationPartitionExpressions(mode: ResolvedJobsDeduplicationMode) {
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

function buildDedupedJobsCte({
  whereClause,
  partitionOrderBy,
  deduplicationPartitionExpressions,
  extraSelections,
}: {
  whereClause: SQL;
  partitionOrderBy: SQL;
  deduplicationPartitionExpressions: ReturnType<typeof getDeduplicationPartitionExpressions>;
  extraSelections?: SQL;
}) {
  return sql`
    with ranked_jobs as (
      select
        ${jobs.id} as id,
        ${jobs.scrapedAt} as scraped_at,
        case when ${jobs.rateMax} > 500 then null else ${jobs.rateMax} end as sort_rate_max,
        ${jobs.rateMin} as sort_rate_min,
        ${jobs.applicationDeadline} as sort_application_deadline,
        ${jobs.postedAt} as sort_posted_at,
        ${jobs.startDate} as sort_start_date
        ${extraSelections ? sql`, ${extraSelections}` : sql``},
        row_number() over (
          partition by
            ${deduplicationPartitionExpressions.title},
            ${deduplicationPartitionExpressions.client},
            ${deduplicationPartitionExpressions.location}
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

export function collapseScoredJobsByVacancy<TJob extends DedupableJob>(
  entries: Array<{ job: TJob; score: number }>,
) {
  const grouped = new Map<string, { job: TJob; score: number }>();

  for (const entry of entries) {
    const dedupeKey = getJobDeduplicationKey(entry.job);
    const existing = grouped.get(dedupeKey);

    if (existing) {
      existing.score += entry.score;
      continue;
    }

    grouped.set(dedupeKey, { ...entry });
  }

  return [...grouped.values()];
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
    });
    const result = await (
      db as unknown as { execute(sql: SQL): Promise<{ rows: DedupedJobPageRow[] }> }
    ).execute(sql`
      ${cte}
      select id, (select cast(count(*) as integer) from deduped_jobs) as total
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
