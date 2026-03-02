import { tool } from "ai";
import { isNull, sql } from "drizzle-orm";
import { z } from "zod";
import { db } from "@/src/db";
import { jobs, scrapeResults } from "@/src/db/schema";

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
        // Outlier cap: exclude rates > 500 EUR/hour (likely data errors or daily rates)
        const RATE_CAP = 500;

        const perPlatform = await db
          .select({
            platform: jobs.platform,
            avgMin: sql<number>`round(avg(rate_min) FILTER (WHERE rate_min > 0 AND rate_min <= ${RATE_CAP}))::int`,
            avgMax: sql<number>`round(avg(rate_max) FILTER (WHERE rate_max > 0 AND rate_max <= ${RATE_CAP}))::int`,
            // Single "effective rate" using whichever field is available
            avgTarief: sql<number>`round(avg(COALESCE(NULLIF(rate_max,0), NULLIF(rate_min,0))) FILTER (WHERE COALESCE(NULLIF(rate_max,0), NULLIF(rate_min,0)) <= ${RATE_CAP}))::int`,
            total: sql<number>`count(*)::int`,
            metTarief: sql<number>`count(*) FILTER (WHERE rate_min IS NOT NULL OR rate_max IS NOT NULL)::int`,
            zonderTarief: sql<number>`count(*) FILTER (WHERE rate_min IS NULL AND rate_max IS NULL)::int`,
          })
          .from(jobs)
          .where(isNull(jobs.deletedAt))
          .groupBy(jobs.platform);

        // Overall cross-platform average (jobs with at least one rate field, excl. outliers)
        const [overall] = await db
          .select({
            avgTarief: sql<number>`round(avg(COALESCE(NULLIF(rate_max,0), NULLIF(rate_min,0))) FILTER (WHERE COALESCE(NULLIF(rate_max,0), NULLIF(rate_min,0)) BETWEEN 1 AND ${RATE_CAP}))::int`,
            metTarief: sql<number>`count(*) FILTER (WHERE rate_min IS NOT NULL OR rate_max IS NOT NULL)::int`,
            total: sql<number>`count(*)::int`,
          })
          .from(jobs)
          .where(isNull(jobs.deletedAt));

        return {
          analysis: "Gemiddelde tarieven per platform",
          data: {
            perPlatform,
            overall,
            toelichting: `Tarieven boven ${RATE_CAP} EUR/uur worden als uitschieters beschouwd en niet meegenomen in het gemiddelde. 'zonderTarief' = opdrachten zonder tariefinformatie.`,
          },
        };
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
