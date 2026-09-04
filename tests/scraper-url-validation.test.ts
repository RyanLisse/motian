import { beforeEach, describe, expect, it, vi } from "vitest";

const { dnsLookup } = vi.hoisted(() => ({
  dnsLookup: vi.fn(),
}));

vi.mock("node:dns", () => ({
  default: {
    promises: {
      lookup: dnsLookup,
    },
  },
  promises: {
    lookup: dnsLookup,
  },
}));

import { runScrapePipeline } from "../src/services/scrape-pipeline";
import { validateExternalUrl } from "../src/services/scrapers";

const {
  publish,
  normalizeAndSaveJobs,
  recordScrapeResult,
  getConfigByPlatform,
  getPlatformCatalogEntry,
  toRuntimeConfig,
  getPlatformAdapter,
  getDynamicAdapter,
} = vi.hoisted(() => ({
  publish: vi.fn(),
  normalizeAndSaveJobs: vi.fn(),
  recordScrapeResult: vi.fn(() => Promise.resolve()),
  getConfigByPlatform: vi.fn(),
  getPlatformCatalogEntry: vi.fn(),
  toRuntimeConfig: vi.fn(),
  getPlatformAdapter: vi.fn(),
  getDynamicAdapter: vi.fn(),
}));

vi.mock("../src/lib/event-bus", () => ({ publish }));
vi.mock("../src/services/normalize", () => ({ normalizeAndSaveJobs }));
vi.mock("../src/services/record-scrape-result", () => ({ recordScrapeResult }));
vi.mock("../src/services/scrapers/index", () => ({ getPlatformAdapter }));
vi.mock("@motian/scrapers", () => ({ getDynamicAdapter }));

// Keep real validateExternalUrl; only stub config/runtime helpers from scrapers.
vi.mock("../src/services/scrapers", async (importOriginal) => {
  const actual = await importOriginal<typeof import("../src/services/scrapers")>();
  return {
    ...actual,
    getConfigByPlatform,
    getPlatformCatalogEntry,
    toRuntimeConfig,
  };
});

describe("WP4 outbound URL validation (AE5 / R13)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    dnsLookup.mockReset();
    publish.mockReset();
    normalizeAndSaveJobs.mockReset();
    recordScrapeResult.mockReset();
    recordScrapeResult.mockResolvedValue(undefined);
    getConfigByPlatform.mockReset();
    getPlatformCatalogEntry.mockResolvedValue(null);
    toRuntimeConfig.mockReset();
    getPlatformAdapter.mockReset();
    getDynamicAdapter.mockReset();
  });

  it("validateExternalUrl rejects loopback, link-local, and metadata addresses", async () => {
    dnsLookup.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);
    await expect(validateExternalUrl("https://localhost/jobs")).rejects.toThrow(
      /privé netwerk adres/,
    );

    dnsLookup.mockResolvedValueOnce([{ address: "169.254.169.254", family: 4 }]);
    await expect(validateExternalUrl("https://metadata.internal/latest")).rejects.toThrow(
      /privé netwerk adres/,
    );

    dnsLookup.mockResolvedValueOnce([{ address: "10.0.0.5", family: 4 }]);
    await expect(validateExternalUrl("https://intranet.example/jobs")).rejects.toThrow(
      /privé netwerk adres/,
    );
  });

  it("validateExternalUrl rejects multi-record DNS when any address is private", async () => {
    dnsLookup.mockResolvedValueOnce([
      { address: "203.0.113.10", family: 4 },
      { address: "192.168.1.10", family: 4 },
    ]);

    await expect(validateExternalUrl("https://dual.example/jobs")).rejects.toThrow(
      /privé netwerk adres/,
    );
  });

  it("validateExternalUrl allows public HTTPS destinations", async () => {
    dnsLookup.mockResolvedValueOnce([{ address: "203.0.113.50", family: 4 }]);
    await expect(validateExternalUrl("https://jobs.example/list")).resolves.toBeUndefined();
  });

  it("createConfig and updateConfig call validateExternalUrl before persist", async () => {
    const source = await import("node:fs").then((fs) =>
      fs.readFileSync(new URL("../src/services/scrapers.ts", import.meta.url), "utf8"),
    );

    const createFn = source.slice(source.indexOf("export async function createConfig("));
    const createBody = createFn.slice(0, createFn.indexOf("export async function updateConfig("));
    expect(createBody).toContain("await validateExternalUrl(baseUrl)");
    expect(createBody.indexOf("await validateExternalUrl(baseUrl)")).toBeLessThan(
      createBody.indexOf(".insert(scraperConfigs)"),
    );

    const updateFn = source.slice(source.indexOf("export async function updateConfig("));
    const updateBody = updateFn.slice(
      0,
      updateFn.indexOf("export async function getLatestOnboardingRun("),
    );
    expect(updateBody).toContain("await validateExternalUrl(baseUrl)");
    expect(updateBody.indexOf("await validateExternalUrl(baseUrl)")).toBeLessThan(
      updateBody.indexOf(".update(scraperConfigs)"),
    );
  });

  it("runScrapePipeline rejects when DNS becomes private between save and fetch", async () => {
    const scrape = vi.fn();
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

    // Target resolved to a public IP at save time, but private at fetch time.
    dnsLookup.mockResolvedValueOnce([{ address: "127.0.0.1", family: 4 }]);

    const result = await runScrapePipeline("werkzoeken", "https://www.werkzoeken.nl");

    expect(scrape).not.toHaveBeenCalled();
    expect(result.jobsNew).toBe(0);
    expect(result.errors.some((e) => /privé netwerk adres/.test(e))).toBe(true);
    expect(recordScrapeResult).toHaveBeenCalledWith(
      expect.objectContaining({
        platform: "werkzoeken",
        status: "failed",
      }),
    );
  });

  it("runScrapePipeline validates then scrapes when the target stays public", async () => {
    const scrape = vi.fn().mockResolvedValue({
      listings: [{ externalId: "1" }],
      errors: [],
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
      jobsNew: 1,
      duplicates: 0,
      errors: [],
      jobIds: ["job-1"],
    });
    dnsLookup.mockResolvedValueOnce([{ address: "203.0.113.50", family: 4 }]);

    const result = await runScrapePipeline("werkzoeken", "https://www.werkzoeken.nl");

    expect(scrape).toHaveBeenCalledOnce();
    expect(result).toEqual({ jobsNew: 1, duplicates: 0, errors: [] });
  });
});
