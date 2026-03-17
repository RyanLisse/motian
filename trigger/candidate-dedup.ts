import { logger, schedules } from "@trigger.dev/sdk";
import { db, sql } from "@/src/db";

/**
 * Weekly task to detect and flag duplicate candidates.
 *
 * Identifies candidates with the same email or very similar names+roles.
 * Logs duplicates for manual review — does not auto-merge to prevent data loss.
 */
export const candidateDedupTask = schedules.task({
  id: "candidate-dedup",
  cron: {
    pattern: "0 4 * * 0", // Sundays at 4:00 AM
    timezone: "Europe/Amsterdam",
  },
  run: async () => {
    // Find candidates sharing the same email (most reliable dedup signal)
    const emailDupRows = await db.all<{ email: string; ids: string; cnt: number }>(sql`
      SELECT email, group_concat(id) AS ids, count(*) AS cnt
      FROM candidates
      WHERE email IS NOT NULL
        AND deleted_at IS NULL
      GROUP BY email
      HAVING count(*) > 1
      LIMIT 50
    `);

    // Find candidates with identical name + role (fuzzy dedup)
    const nameDupRows = await db.all<{
      norm_name: string;
      role: string;
      ids: string;
      cnt: number;
    }>(sql`
      SELECT lower(name) AS norm_name, role,
             group_concat(id) AS ids,
             count(*) AS cnt
      FROM candidates
      WHERE deleted_at IS NULL
        AND name IS NOT NULL
      GROUP BY lower(name), role
      HAVING count(*) > 1
      LIMIT 50
    `);

    const emailDups = emailDupRows.map((d) => ({ ...d, ids: d.ids.split(",") }));
    const nameDups = nameDupRows.map((d) => ({ ...d, ids: d.ids.split(",") }));

    logger.info("Kandidaat deduplicatie scan voltooid", {
      emailDuplicateGroups: emailDups.length,
      nameRoleDuplicateGroups: nameDups.length,
    });

    return {
      emailDuplicates: emailDups.map((d) => ({
        email: d.email,
        candidateIds: d.ids,
        count: Number(d.cnt),
      })),
      nameRoleDuplicates: nameDups.map((d) => ({
        name: d.norm_name,
        role: d.role,
        candidateIds: d.ids,
        count: Number(d.cnt),
      })),
    };
  },
});
