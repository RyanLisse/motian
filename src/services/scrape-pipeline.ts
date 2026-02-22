import { scrapeOpdrachtoverheid, scrapeFlextender, scrapeStriive } from "./scrapers/index";
import { normalizeAndSaveJobs } from "./normalize";
import { recordScrapeResult } from "./record-scrape-result";

export async function runScrapePipeline(
  platform: string,
  url: string,
): Promise<{ jobsNew: number; duplicates: number; errors: string[] }> {
  const startTime = Date.now();

  let listings: any[];
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
    return { jobsNew: 0, duplicates: 0, errors };
  }

  const result = await normalizeAndSaveJobs(platform, listings);
  const durationMs = Date.now() - startTime;
  const status =
    result.errors.length === 0
      ? "success"
      : result.jobsNew > 0
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

  return result;
}
