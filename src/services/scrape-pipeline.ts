import { publish } from "../lib/event-bus";
import { enrichJobsBatch } from "./ai-enrichment";
import { normalizeAndSaveJobs } from "./normalize";
import { recordScrapeResult } from "./record-scrape-result";
import { scrapeFlextender, scrapeOpdrachtoverheid, scrapeStriive } from "./scrapers/index";

export async function runScrapePipeline(
  platform: string,
  url: string,
): Promise<{ jobsNew: number; duplicates: number; errors: string[] }> {
  const startTime = Date.now();

  publish("scrape:start", { platform });

  let listings: Record<string, unknown>[];
  try {
    switch (platform) {
      case "opdrachtoverheid":
        listings = await scrapeOpdrachtoverheid();
        break;
      case "flextender":
        listings = await scrapeFlextender();
        break;
      case "striive":
        listings = await scrapeStriive(url);
        break;
      default:
        return { jobsNew: 0, duplicates: 0, errors: [`Unknown platform: ${platform}`] };
    }
  } catch (err) {
    const errors = [err instanceof Error ? err.message : String(err)];
    try {
      await recordScrapeResult({
        platform,
        jobsFound: 0,
        jobsNew: 0,
        duplicates: 0,
        durationMs: Date.now() - startTime,
        status: "failed",
        errors,
      });
    } catch {}
    publish("scrape:error", { platform, errors });
    return { jobsNew: 0, duplicates: 0, errors };
  }

  const result = await normalizeAndSaveJobs(platform, listings);
  const durationMs = Date.now() - startTime;
  const status =
    result.errors.length === 0
      ? "success"
      : result.jobsNew > 0 || result.duplicates > 0
        ? "partial"
        : "failed";

  try {
    await recordScrapeResult({
      platform,
      jobsFound: listings.length,
      jobsNew: result.jobsNew,
      duplicates: result.duplicates,
      durationMs,
      status,
      errors: result.errors,
    });
  } catch {}

  publish("scrape:complete", {
    platform,
    jobsFound: listings.length,
    jobsNew: result.jobsNew,
    duplicates: result.duplicates,
    durationMs,
    status,
  });

  // Fire-and-forget AI enrichment for new jobs
  if (result.jobsNew > 0) {
    enrichJobsBatch({ platform }).catch((err) =>
      console.error(`[AI Enrichment] Failed for ${platform}:`, err),
    );
  }

  return result;
}
