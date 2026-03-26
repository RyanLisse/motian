import { db, sql } from "../../db";
import { jobDedupeRanks, jobs } from "../../db/schema";
import { getVisibleVacancyCondition } from "./filters";

/**
 * Recomputes dedupe ranks for all open jobs and upserts into `job_dedupe_ranks`.
 *
 * The dedupe logic mirrors `buildDedupedJobsCte` in `deduplication.ts`:
 * it partitions by (dedupe_title_normalized, dedupe_client_normalized, dedupe_location_normalized)
 * and ranks by scraped_at DESC, id DESC within each partition.
 */
export async function refreshDedupeRanks(): Promise<{
  rowsUpserted: number;
  computedAt: Date;
}> {
  const computedAt = new Date();

  const statusCondition = getVisibleVacancyCondition();

  const result = await (
    db as unknown as { execute(sql: ReturnType<typeof sql>): Promise<{ rowCount: number }> }
  ).execute(sql`
    WITH ranked AS (
      SELECT
        ${jobs.id} AS job_id,
        ROW_NUMBER() OVER (
          PARTITION BY
            ${jobs.dedupeTitleNormalized},
            ${jobs.dedupeClientNormalized},
            ${jobs.dedupeLocationNormalized}
          ORDER BY ${jobs.scrapedAt} DESC NULLS LAST, ${jobs.id} DESC
        ) AS dedupe_rank,
        CONCAT_WS(
          E'\x1f',
          ${jobs.dedupeTitleNormalized},
          ${jobs.dedupeClientNormalized},
          ${jobs.dedupeLocationNormalized}
        ) AS dedupe_group
      FROM ${jobs}
      WHERE ${statusCondition}
    )
    INSERT INTO ${jobDedupeRanks} (job_id, dedupe_rank, dedupe_group, computed_at)
    SELECT job_id, dedupe_rank, dedupe_group, ${computedAt}
    FROM ranked
    ON CONFLICT (job_id) DO UPDATE SET
      dedupe_rank = EXCLUDED.dedupe_rank,
      dedupe_group = EXCLUDED.dedupe_group,
      computed_at = EXCLUDED.computed_at
  `);

  return {
    rowsUpserted: result.rowCount ?? 0,
    computedAt,
  };
}

const STALE_THRESHOLD_MS = 30 * 60 * 1000; // 30 minutes

/**
 * Returns the latest `computed_at` timestamp and whether the ranks are fresh.
 */
export async function getDedupeRanksFreshness(): Promise<{
  computedAt: Date | null;
  isFresh: boolean;
}> {
  const rows = await db
    .select({ computedAt: jobDedupeRanks.computedAt })
    .from(jobDedupeRanks)
    .orderBy(sql`${jobDedupeRanks.computedAt} DESC`)
    .limit(1);

  const computedAt = rows[0]?.computedAt ?? null;
  if (!computedAt) {
    return { computedAt: null, isFresh: false };
  }

  const ageMs = Date.now() - computedAt.getTime();
  return { computedAt, isFresh: ageMs < STALE_THRESHOLD_MS };
}
