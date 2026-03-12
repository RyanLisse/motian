import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  publish,
  enrichJobsBatch,
  normalizeAndSaveJobs,
  recordScrapeResult,
  getConfigByPlatform,
  toRuntimeConfig,
  getPlatformAdapter,
} = vi.hoisted(() => ({
  publish: vi.fn(),
  enrichJobsBatch: vi.fn(() => Promise.resolve()),
  normalizeAndSaveJobs: vi.fn(),
  recordScrapeResult: vi.fn(() => Promise.resolve()),
  getConfigByPlatform: vi.fn(),
  toRuntimeConfig: vi.fn(),
  getPlatformAdapter: vi.fn(),
}));

vi.mock("../src/lib/event-bus", () => ({ publish }));
vi.mock("../src/services/ai-enrichment", () => ({
  enrichJobsBatch,
}));
vi.mock("../src/services/normalize", () => ({
  normalizeAndSaveJobs,
}));
vi.mock("../src/services/record-scrape-result", () => ({
  recordScrapeResult,
}));
vi.mock("../src/services/scrapers", () => ({
  getConfigByPlatform,
  toRuntimeConfig,
}));
vi.mock("../src/services/scrapers/index", () => ({
  getPlatformAdapter,
}));

import { runScrapePipeline } from "../src/services/scrape-pipeline";

describe("runScrapePipeline", () => {
  beforeEach(() => {
    publish.mockReset();
    enrichJobsBatch.mockClear();
    normalizeAndSaveJobs.mockReset();
    recordScrapeResult.mockReset();
    recordScrapeResult.mockResolvedValue(undefined);
    getConfigByPlatform.mockReset();
    toRuntimeConfig.mockReset();
    getPlatformAdapter.mockReset();
  });

  it("records unsupported platforms as failed runs instead of returning early", async () => {
    getPlatformAdapter.mockReturnValue(undefined);

    const result = await runScrapePipeline("unsupported-board", "https://example.com");

    expect(result).toEqual({
      jobsNew: 0,
      duplicates: 0,
      errors: ["Unknown platform: unsupported-board"],
    });
    expect(recordScrapeResult).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "unsupported-board",
        status: "failed",
        errors: ["Unknown platform: unsupported-board"],
      }),
    );
    expect(publish).toHaveBeenCalledWith("scrape:error", {
      platform: "unsupported-board",
      errors: ["Unknown platform: unsupported-board"],
    });
  });

  it("returns merged scraper and normalization errors to callers", async () => {
    const scrape = vi.fn().mockResolvedValue({
      listings: [{ externalId: "1" }],
      errors: ["scraper warning"],
    });

    getPlatformAdapter.mockReturnValue({ scrape });
    getConfigByPlatform.mockResolvedValue({
      id: "cfg-1",
      platform: "werkzoeken",
      baseUrl: "https://www.werkzoeken.nl",
      parameters: {},
      authConfigEncrypted: null,
      credentialsRef: null,
    });
    toRuntimeConfig.mockReturnValue({
      slug: "werkzoeken",
      baseUrl: "https://www.werkzoeken.nl",
      parameters: {},
      auth: {},
    });
    normalizeAndSaveJobs.mockResolvedValue({
      jobsNew: 2,
      duplicates: 1,
      errors: ["normalize warning"],
      jobIds: ["job-1", "job-2"],
    });

    const result = await runScrapePipeline("werkzoeken", "https://www.werkzoeken.nl");

    expect(result).toEqual({
      jobsNew: 2,
      duplicates: 1,
      errors: ["scraper warning", "normalize warning"],
    });
    expect(recordScrapeResult).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "werkzoeken",
        status: "partial",
        errors: ["scraper warning", "normalize warning"],
      }),
    );
  });
});
