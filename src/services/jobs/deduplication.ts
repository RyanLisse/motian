import type { SQL } from "drizzle-orm";
import { inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";
import type { ListJobsSortBy } from "./filters";
import { type Job, jobReadSelection } from "./repository";

type DedupableJob = Pick<Job, "title" | "company" | "endClient" | "province" | "location">;

type DedupedJobIdRow = { id: string };
type DedupedJobPageRow = { id: string | null; total: number | string | null };

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
        partitionOrderBy: sql`case when ${jobs.rateMax} > 500 then null else ${jobs.rateMax} end desc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`sort_rate_max desc nulls last, id desc`,
      };
    case "tarief_laag":
      return {
        partitionOrderBy: sql`${jobs.rateMin} asc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`sort_rate_min asc nulls last, id desc`,
      };
    case "deadline":
      return {
        partitionOrderBy: sql`${jobs.applicationDeadline} asc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`sort_application_deadline asc nulls last, id desc`,
      };
    case "deadline_desc":
      return {
        partitionOrderBy: sql`${jobs.applicationDeadline} desc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`sort_application_deadline desc nulls last, id desc`,
      };
    case "geplaatst":
      return {
        partitionOrderBy: sql`${jobs.postedAt} desc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`sort_posted_at desc nulls last, id desc`,
      };
    case "startdatum":
      return {
        partitionOrderBy: sql`${jobs.startDate} asc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`sort_start_date asc nulls last, id desc`,
      };
    default:
      return {
        partitionOrderBy: sql`${jobs.scrapedAt} desc nulls last, ${jobs.id} desc`,
        resultOrderBy: sql`scraped_at desc nulls last, id desc`,
      };
  }
}

function buildDedupedJobsCte({
  whereClause,
  partitionOrderBy,
  extraSelections,
}: {
  whereClause: SQL;
  partitionOrderBy: SQL;
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
            ${jobs.dedupeTitleNormalized},
            ${jobs.dedupeClientNormalized},
            ${jobs.dedupeLocationNormalized}
          order by ${partitionOrderBy}
        ) as dedupe_rank
      from ${jobs}
      where ${whereClause}
    ),
    deduped_jobs as materialized (
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
    .select(jobReadSelection)
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
  const cte = buildDedupedJobsCte({
    whereClause,
    partitionOrderBy:
      partitionOrderBy ??
      sortOrder?.partitionOrderBy ??
      sql`${jobs.scrapedAt} desc nulls last, ${jobs.id} desc`,
    extraSelections,
  });
  const result = await db.execute(sql<DedupedJobIdRow>`
    ${cte}
    select id
    from deduped_jobs
    order by ${resultOrderBy ?? sortOrder?.resultOrderBy ?? sql`scraped_at desc nulls last, id desc`}
    limit ${limit}
    offset ${offset}
  `);

  return (result.rows as DedupedJobIdRow[]).map((row) => row.id);
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
  const cte = buildDedupedJobsCte({
    whereClause,
    partitionOrderBy: sortOrder.partitionOrderBy,
  });
  const result = await db.execute(sql<DedupedJobPageRow>`
    ${cte}
    select page.id, totals.total
    from (
      select count(*)::int as total
      from deduped_jobs
    ) totals
    left join lateral (
      select id
      from deduped_jobs
      order by ${sortOrder.resultOrderBy}
      limit ${limit}
      offset ${offset}
    ) page on true
  `);

  const rows = result.rows as DedupedJobPageRow[];
  const total = rows[0]?.total == null ? 0 : Number(rows[0].total);

  return {
    ids: rows.flatMap((row) => (row.id ? [row.id] : [])),
    total,
  };
}
