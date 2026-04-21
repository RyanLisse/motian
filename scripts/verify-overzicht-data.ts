// Ops helper: audit the numbers that power the Overzicht + Vacatures pages.
// Runs the same queries as the service layer plus cross-checks (dedup ranks,
// sidebar metadata, recent scrape runs) so you can spot drift quickly.
import { db } from "@motian/db";
import { sql } from "drizzle-orm";

type Row = Record<string, unknown>;
type ExecResult<T> = { rows?: T[] } | T[];

async function q<T extends Row>(label: string, statement: ReturnType<typeof sql>) {
  const result = (await db.execute<T>(statement)) as ExecResult<T>;
  const rows = (result as { rows?: T[] }).rows ?? (result as T[]);
  console.log(`\n=== ${label} ===`);
  console.table(rows);
  return rows;
}

async function main() {
  // 1. Overzicht headline (deduped open count via jobDedupeRanks)
  await q(
    "Overzicht headline (deduped open, jobDedupeRanks rank=1)",
    sql`
      select cast(count(*) as integer) as deduped_open
      from jobs j
      inner join job_dedupe_ranks r on r.job_id = j.id
      where j.status = 'open' and j.deleted_at is null and r.dedupe_rank = 1
    `,
  );

  // 1b. Fallback CTE (same query overzicht uses if ranks table is empty)
  await q(
    "Overzicht fallback (CTE rank per dedupe tuple)",
    sql`
      with ranked as (
        select j.id,
          row_number() over (
            partition by j.dedupe_title_normalized, j.dedupe_client_normalized, j.dedupe_location_normalized
            order by j.scraped_at desc nulls last, j.id desc
          ) as rn
        from jobs j
        where j.status = 'open' and j.deleted_at is null
      )
      select cast(count(*) as integer) as deduped_open_cte from ranked where rn = 1
    `,
  );

  // 2. Sidebar (what Vacatures page shows in precomputed table)
  await q(
    "Vacatures sidebar (precomputed totalCount)",
    sql`
      select total_count, computed_at
      from sidebar_metadata
      where id = 'default'
    `,
  );

  // 3. Raw visible count (not archived, not soft-deleted) — what overzicht also uses for platform counts
  await q(
    "Raw visible (ne archived, not deleted)",
    sql`
      select cast(count(*) as integer) as visible_total
      from jobs where status != 'archived' and deleted_at is null
    `,
  );

  // 4. Raw open count (no dedup) — the OLD sidebar query
  await q(
    "Raw open (no dedup) — old sidebar totalCount",
    sql`
      select cast(count(*) as integer) as raw_open
      from jobs where status = 'open' and deleted_at is null
    `,
  );

  // 5. Platform breakdown — what overzicht "per platform" chart shows
  await q(
    "Per-platform visible counts (overzicht chart)",
    sql`
      select platform,
             cast(count(*) as integer) as total,
             cast(count(*) filter (where scraped_at >= now() - interval '7 days') as integer) as weekly_new
      from jobs
      where status != 'archived' and deleted_at is null
      group by platform
      order by total desc
      limit 10
    `,
  );

  // 6. Scraper dashboard — recent runs per platform
  await q(
    "Scraper dashboard (last run per platform)",
    sql`
      select distinct on (platform)
        platform, run_at, status, jobs_found, jobs_new, duplicates,
        cast((extract(epoch from (now() - run_at)) / 3600) as integer) as hours_ago
      from scrape_results
      order by platform, run_at desc
    `,
  );

  // 7. Scraper configs state
  await q(
    "Scraper configs state",
    sql`
      select platform, is_active, consecutive_failures, last_run_status, last_run_at, validation_status
      from scraper_configs where platform in ('opdrachtoverheid', 'werkzoeken', 'mipublic')
      order by platform
    `,
  );

  // 8. Dedupe ranks freshness
  await q(
    "Dedupe ranks freshness",
    sql`
      select
        cast(count(*) as integer) as rank_rows,
        max(computed_at) as last_computed
      from job_dedupe_ranks
    `,
  );

  // 9. Jobs added today (fresh ingestion signal)
  await q(
    "Jobs scraped in last 24h",
    sql`
      select platform,
             cast(count(*) as integer) as new_today
      from jobs
      where scraped_at >= now() - interval '24 hours'
        and status != 'archived' and deleted_at is null
      group by platform order by new_today desc
    `,
  );

  // 10. Check for orphan/weird states (sanity)
  await q(
    "Sanity: jobs with null status or no platform",
    sql`
      select
        cast(count(*) filter (where status is null) as integer) as null_status,
        cast(count(*) filter (where platform is null or platform = '') as integer) as no_platform,
        cast(count(*) filter (where deleted_at is not null) as integer) as soft_deleted
      from jobs
    `,
  );
}

main()
  .then(() => process.exit(0))
  .catch((err) => {
    console.error(err);
    process.exit(1);
  });
