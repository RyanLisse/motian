import { logger, schedules } from "@trigger.dev/sdk";
import { db, sql } from "@/src/db";
import { kpiSnapshots } from "@/src/db/kpi-snapshots-schema";

/**
 * Daily KPI snapshot — runs at 23:00 Amsterdam time.
 *
 * Captures a daily snapshot of recruitment funnel metrics:
 *   - Open vacatures count
 *   - New candidates (created today)
 *   - Total pipeline entries
 *   - Matches created today
 */
export const dailyKpiSnapshotTask = schedules.task({
  id: "daily-kpi-snapshot",
  cron: {
    pattern: "0 23 * * *",
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 60,
  run: async () => {
    const today = new Date().toISOString().slice(0, 10);

    const [counts] = await db
      .select({
        openVacatures: sql<number>`cast(coalesce(
          (select count(*) from jobs where status = 'open' and deleted_at is null),
          0) as integer)`,
        newCandidates: sql<number>`cast(coalesce(
          (select count(*) from candidates
           where created_at >= current_date and deleted_at is null),
          0) as integer)`,
        pipelineTotal: sql<number>`cast(coalesce(
          (select count(*) from applications where deleted_at is null),
          0) as integer)`,
        matchesCreated: sql<number>`cast(coalesce(
          (select count(*) from job_matches
           where created_at >= current_date),
          0) as integer)`,
      })
      .from(sql`(select 1) as _dummy`);

    const row = {
      date: today,
      openVacatures: counts.openVacatures,
      newCandidates: counts.newCandidates,
      pipelineTotal: counts.pipelineTotal,
      matchesCreated: counts.matchesCreated,
    };

    await db.insert(kpiSnapshots).values(row);

    logger.info("KPI snapshot opgeslagen", row);

    return row;
  },
});
