import { publish } from "../lib/event-bus";
import { enrichJobsBatch } from "./ai-enrichment";
import { normalizeAndSaveJobs } from "./normalize";
import { recordScrapeResult } from "./record-scrape-result";
import { scrapeFlextender, scrapeOpdrachtoverheid, scrapeStriive } from "./scrapers/index";

type ScrapeStatus = "success" | "partial" | "failed";
export type ScrapePipelineBatchConfig = {
  platform: string;
  baseUrl: string;
};

export type ScrapePipelineRunResult = {
  jobsNew: number;
  duplicates: number;
  errors: string[];
};

const DEFAULT_SCRAPE_PIPELINE_CONCURRENCY = 2;

function parseBoundedIntegerEnv(
  value: string | undefined,
  fallback: number,
  min: number,
  max: number,
): number {
  if (!value) return fallback;

  const parsed = Number.parseInt(value, 10);
  if (!Number.isFinite(parsed)) return fallback;

  return Math.min(Math.max(parsed, min), max);
}

export function getScrapePipelineConcurrency(env: NodeJS.ProcessEnv = process.env): number {
  return parseBoundedIntegerEnv(
    env.SCRAPE_PIPELINE_CONCURRENCY,
    DEFAULT_SCRAPE_PIPELINE_CONCURRENCY,
    1,
    10,
  );
}

async function recordFailure(platform: string, errors: string[], startTime: number): Promise<void> {
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
  } catch (recordErr) {
    console.error(`[scrape-pipeline] recordScrapeResult mislukt voor ${platform}:`, recordErr);
  }
  publish("scrape:error", { platform, errors });
}

export async function runScrapePipeline(
  platform: string,
  url: string,
): Promise<ScrapePipelineRunResult> {
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
    await recordFailure(platform, errors, startTime);
    return { jobsNew: 0, duplicates: 0, errors };
  }

  // Safety net: scraper returned data but nothing parsed — treat as suspicious
  if (listings.length === 0) {
    const errors = [`${platform}: scraper retourneerde 0 listings (mogelijk stille fout)`];
    await recordFailure(platform, errors, startTime);
    return { jobsNew: 0, duplicates: 0, errors };
  }

  const result = await normalizeAndSaveJobs(platform, listings);
  const durationMs = Date.now() - startTime;
  const status: ScrapeStatus =
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
      jobIds: result.jobIds,
    });
  } catch (recordErr) {
    console.error(`[scrape-pipeline] recordScrapeResult mislukt voor ${platform}:`, recordErr);
  }

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

export async function runScrapePipelinesWithConcurrency<T extends ScrapePipelineBatchConfig>(
  configs: T[],
  options?: {
    concurrency?: number;
    runner?: (config: T) => Promise<ScrapePipelineRunResult>;
  },
): Promise<PromiseSettledResult<ScrapePipelineRunResult>[]> {
  if (configs.length === 0) {
    return [];
  }

  const runner =
    options?.runner ?? ((config: T) => runScrapePipeline(config.platform, config.baseUrl));
  const concurrency = Math.max(
    1,
    Math.min(options?.concurrency ?? getScrapePipelineConcurrency(), configs.length),
  );
  const results: PromiseSettledResult<ScrapePipelineRunResult>[] = new Array(configs.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < configs.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      const config = configs[currentIndex];

      try {
        results[currentIndex] = {
          status: "fulfilled",
          value: await runner(config),
        };
      } catch (reason) {
        results[currentIndex] = {
          status: "rejected",
          reason,
        };
      }
    }
  }

  await Promise.all(Array.from({ length: concurrency }, () => worker()));
  return results;
}
