import { logger, schedules } from "@trigger.dev/sdk";
import { and, isNull, lt } from "drizzle-orm";
import { db } from "@/src/db";
import { jobs } from "@/src/db/schema";

export const vacancyExpiryTask = schedules.task({
  id: "vacancy-expiry",
  cron: {
    pattern: "0 3 * * *", // Daily at 3:00 AM
    timezone: "Europe/Amsterdam",
  },
  run: async () => {
    const now = new Date();

    const expired = await db
      .update(jobs)
      .set({ deletedAt: now })
      .where(and(lt(jobs.applicationDeadline, now), isNull(jobs.deletedAt)))
      .returning({ id: jobs.id });

    logger.info("Vacature verloop check voltooid", {
      expiredCount: expired.length,
    });

    return { expiredCount: expired.length, expiredIds: expired.map((j) => j.id) };
  },
});
