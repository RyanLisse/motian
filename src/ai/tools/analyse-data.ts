import { tool } from "ai";
import { z } from "zod";
import { db } from "@/src/db";
import { jobs, scrapeResults } from "@/src/db/schema";
import { sql, isNull, eq } from "drizzle-orm";

export const analyseData = tool({
  description:
    "Voer data-analyse uit op de recruitment database. Kan aggregaties uitvoeren zoals: opdrachten per platform, gemiddelde tarieven, totaal aantal, recente scrape resultaten, etc.",
  inputSchema: z.object({
    analysis: z
      .enum([
        "jobs_per_platform",
        "avg_rates",
        "total_counts",
        "recent_scrapes",
        "jobs_per_province",
        "deadline_overview",
      ])
      .describe(
        "Type analyse: jobs_per_platform, avg_rates, total_counts, recent_scrapes, jobs_per_province, deadline_overview",
      ),
  }),
  execute: async ({ analysis }): Promise<{ analysis: string; data: unknown }> => {
    switch (analysis) {
      case "jobs_per_platform": {
        const rows = await db
          .select({
            platform: jobs.platform,
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(isNull(jobs.deletedAt))
          .groupBy(jobs.platform);
        return { analysis: "Opdrachten per platform", data: rows };
      }

      case "avg_rates": {
        const rows = await db
          .select({
            platform: jobs.platform,
            avgMin: sql<number>`round(avg(rate_min))::int`,
            avgMax: sql<number>`round(avg(rate_max))::int`,
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(isNull(jobs.deletedAt))
          .groupBy(jobs.platform);
        return { analysis: "Gemiddelde tarieven per platform", data: rows };
      }

      case "total_counts": {
        const [result] = await db
          .select({
            total: sql<number>`count(*)::int`,
            withDescription: sql<number>`count(description)::int`,
            withEmbedding: sql<number>`count(embedding)::int`,
          })
          .from(jobs)
          .where(isNull(jobs.deletedAt));
        return { analysis: "Totaal overzicht", data: result };
      }

      case "recent_scrapes": {
        const rows = await db
          .select({
            platform: scrapeResults.platform,
            runAt: scrapeResults.runAt,
            status: scrapeResults.status,
            jobsFound: scrapeResults.jobsFound,
            jobsNew: scrapeResults.jobsNew,
            duplicates: scrapeResults.duplicates,
          })
          .from(scrapeResults)
          .orderBy(sql`run_at DESC`)
          .limit(10);
        return { analysis: "Laatste 10 scrape resultaten", data: rows };
      }

      case "jobs_per_province": {
        const rows = await db
          .select({
            province: jobs.province,
            count: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(isNull(jobs.deletedAt))
          .groupBy(jobs.province)
          .orderBy(sql`count(*) DESC`);
        return { analysis: "Opdrachten per provincie", data: rows };
      }

      case "deadline_overview": {
        const rows = await db
          .select({
            total: sql<number>`count(*)::int`,
            expiringSoon: sql<number>`count(*) FILTER (WHERE application_deadline BETWEEN now() AND now() + interval '7 days')::int`,
            expired: sql<number>`count(*) FILTER (WHERE application_deadline < now())::int`,
            noDeadline: sql<number>`count(*) FILTER (WHERE application_deadline IS NULL)::int`,
          })
          .from(jobs)
          .where(isNull(jobs.deletedAt));
        return { analysis: "Deadline overzicht", data: rows[0] };
      }

      default:
        return { analysis: "error", data: "Onbekend analyse type" };
    }
  },
});
