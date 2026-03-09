import { logger, schedules } from "@trigger.dev/sdk";
import { and, eq, lt } from "drizzle-orm";
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
      .set({ status: "closed" })
      .where(and(eq(jobs.status, "open"), lt(jobs.applicationDeadline, now)))
      .returning({ id: jobs.id });

    logger.info("Vacature verloop check voltooid", {
      expiredCount: expired.length,
    });

    return { expiredCount: expired.length, expiredIds: expired.map((j) => j.id) };
  },
});
