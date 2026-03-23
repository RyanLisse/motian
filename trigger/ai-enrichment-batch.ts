import { logger, schedules } from "@trigger.dev/sdk";
import { enrichJobsBatch } from "@/src/services/ai-enrichment";

/**
 * Post-scrape AI enrichment — runs after scrape-pipeline completes.
 *
 * Enriches unenriched jobs with Gemini Flash Lite:
 * - descriptionSummary (NL/EN)
 * - categories, educationLevel, workArrangement, languages
 * - workExperienceYears, durationMonths, extensionPossible
 *
 * Previously this ran fire-and-forget inside scrape-pipeline,
 * but pending AI promises blocked the process exit and caused
 * Trigger.dev maxDuration timeouts. Now runs independently.
 */
export const aiEnrichmentBatchTask = schedules.task({
  id: "ai-enrichment-batch",
  cron: {
    pattern: "30 6,10,14,18 * * *", // 30 min after each scrape run
    timezone: "Europe/Amsterdam",
  },
  maxDuration: 300, // 5 minutes — platforms run in parallel now
  run: async () => {
    logger.info("AI enrichment batch gestart");

    const platforms = ["flextender", "opdrachtoverheid", "striive"];
    const results: Record<string, { enriched: number; skipped: number; errors: string[] }> = {};

    const settled = await Promise.allSettled(
      platforms.map(async (platform) => {
        const result = await enrichJobsBatch({ platform, limit: 50 });
        results[platform] = result;
        logger.info(`${platform}: ${result.enriched} verrijkt, ${result.skipped} overgeslagen`, {
          platform,
          ...result,
        });
      }),
    );

    for (let i = 0; i < platforms.length; i++) {
      const s = settled[i];
      if (s.status === "rejected") {
        const platform = platforms[i];
        const msg = s.reason instanceof Error ? s.reason.message : String(s.reason);
        results[platform] = { enriched: 0, skipped: 0, errors: [msg] };
        logger.error(`${platform}: enrichment mislukt`, { platform, error: msg });
      }
    }

    const totalEnriched = Object.values(results).reduce((sum, r) => sum + r.enriched, 0);
    const totalErrors = Object.values(results).reduce((sum, r) => sum + r.errors.length, 0);

    logger.info("AI enrichment batch voltooid", { totalEnriched, totalErrors });

    return { results, totalEnriched, totalErrors };
  },
});
