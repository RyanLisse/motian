import type { SQL } from "drizzle-orm";
import { inArray, sql } from "drizzle-orm";
import { db } from "../../db";
import { jobs } from "../../db/schema";
import type { ListJobsSortBy } from "./filters";
import { type Job, jobReadSelection } from "./repository";

type DedupableJob = Pick<Job, "title" | "company" | "endClient" | "province" | "location">;

type DedupedJobIdRow = { id: string };
type DedupedJobPageRow = { id: string | null; total: number | string | null };
type JobsDeduplicationMigrationRow = { migration_applied: boolean | number | string | null };
type JobsDeduplicationTableSchemaRow = { table_schema: string | null };
type JobsDeduplicationMode = "unknown" | "normalized" | "legacy";
type ResolvedJobsDeduplicationMode = Exclude<JobsDeduplicationMode, "unknown">;

const JOBS_DEDUPE_COLUMN_NAMES = [
  "dedupe_title_normalized",
  "dedupe_client_normalized",
  "dedupe_location_normalized",
] as const;
const JOBS_DEDUPE_BACKFILL_MIGRATION_HASH =
  "de9573fb28a78df406df11f368ea0972f5ad11251dc6864791ba5b354f59768d";
const POSTGRES_MISSING_COLUMN_ERROR_CODE = "42703";

let jobsDeduplicationMode: JobsDeduplicationMode = "unknown";
let jobsDeduplicationModePromise: Promise<ResolvedJobsDeduplicationMode> | null = null;

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

function isMissingJobsDeduplicationColumn(error: unknown): boolean {
  if (!error || typeof error !== "object") {
    return false;
  }

  const code = "code" in error ? error.code : undefined;
  const column = "column" in error ? error.column : undefined;
  const message = "message" in error && typeof error.message === "string" ? error.message : "";
  const cause = "cause" in error ? error.cause : undefined;

  return (
    (code === POSTGRES_MISSING_COLUMN_ERROR_CODE &&
      JOBS_DEDUPE_COLUMN_NAMES.some(
        (dedupeColumn) => column === dedupeColumn || message.includes(dedupeColumn),
      )) ||
    (cause ? isMissingJobsDeduplicationColumn(cause) : false)
  );
}

function setJobsDeduplicationMode(
  mode: ResolvedJobsDeduplicationMode,
): ResolvedJobsDeduplicationMode {
  jobsDeduplicationMode = mode;
  jobsDeduplicationModePromise = null;
  return mode;
}

function readBooleanResult(value: boolean | number | string | null | undefined): boolean {
  if (typeof value === "boolean") {
    return value;
  }

  if (typeof value === "number") {
    return value !== 0;
  }

  if (typeof value === "string") {
    const normalized = value.trim().toLowerCase();
    return normalized === "true" || normalized === "t" || normalized === "1";
  }

  return false;
}

function quoteIdentifier(identifier: string): string {
  return `"${identifier.replaceAll('"', '""')}"`;
}

async function jobsDeduplicationHelpersNeedBackfill(): Promise<boolean> {
  const migrationsTableResult = await db.execute(sql<JobsDeduplicationTableSchemaRow>`
    select table_schema
    from information_schema.tables
    where table_name = '__drizzle_migrations'
    order by
      case
        when table_schema = 'drizzle' then 0
        when table_schema = current_schema() then 1
        else 2
      end,
      table_schema asc
    limit 1
  `);

  const migrationsTableRow = migrationsTableResult.rows[0] as
    | JobsDeduplicationTableSchemaRow
    | undefined;
  const migrationsTableSchema = migrationsTableRow?.table_schema;
  if (!migrationsTableSchema) {
    return true;
  }

  const migrationsTable = sql.raw(
    `${quoteIdentifier(migrationsTableSchema)}.${quoteIdentifier("__drizzle_migrations")}`,
  );
  const result = await db.execute(sql<JobsDeduplicationMigrationRow>`
    select exists(
      select 1
      from ${migrationsTable}
      where hash = ${JOBS_DEDUPE_BACKFILL_MIGRATION_HASH}
    ) as migration_applied
  `);

  const readinessRow = result.rows[0] as JobsDeduplicationMigrationRow | undefined;
  return !readBooleanResult(readinessRow?.migration_applied);
}

async function getJobsDeduplicationMode(): Promise<ResolvedJobsDeduplicationMode> {
  if (jobsDeduplicationMode !== "unknown") {
    return jobsDeduplicationMode;
  }

  if (!jobsDeduplicationModePromise) {
    jobsDeduplicationModePromise = (async () => {
      try {
        const result = await db.execute(sql<{ present_count: number | string | null }>`
          select count(*)::int as present_count
          from information_schema.columns
          where table_schema = current_schema()
            and table_name = 'jobs'
            and column_name in (
              'dedupe_title_normalized',
              'dedupe_client_normalized',
              'dedupe_location_normalized'
            )
        `);
        const presentCount = Number(result.rows[0]?.present_count ?? 0);
        if (presentCount !== JOBS_DEDUPE_COLUMN_NAMES.length) {
          return setJobsDeduplicationMode("legacy");
        }

        try {
          return setJobsDeduplicationMode(
            (await jobsDeduplicationHelpersNeedBackfill()) ? "legacy" : "normalized",
          );
        } catch (error) {
          if (isMissingJobsDeduplicationColumn(error)) {
            return setJobsDeduplicationMode("legacy");
          }

          throw error;
        }
      } catch (error) {
        jobsDeduplicationModePromise = null;
        throw error;
      }
    })();
  }

  return jobsDeduplicationModePromise;
}

function getDeduplicationFallbackExpression(value: SQL): SQL {
  return sql`trim(regexp_replace(lower(coalesce(${value}, '')), '[^[:alnum:]]+', ' ', 'g'))`;
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
  if ((await getJobsDeduplicationMode()) === "legacy") {
    return runForMode("legacy");
  }

  try {
    const result = await runForMode("normalized");
    setJobsDeduplicationMode("normalized");
    return result;
  } catch (error) {
    if (!isMissingJobsDeduplicationColumn(error)) {
      throw error;
    }

    setJobsDeduplicationMode("legacy");
    return runForMode("legacy");
  }
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

  return withJobsDeduplicationCompatibility(async (mode) => {
    const cte = buildDedupedJobsCte({
      whereClause,
      partitionOrderBy:
        partitionOrderBy ??
        sortOrder?.partitionOrderBy ??
        sql`${jobs.scrapedAt} desc nulls last, ${jobs.id} desc`,
      deduplicationPartitionExpressions: getDeduplicationPartitionExpressions(mode),
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
  });
}
