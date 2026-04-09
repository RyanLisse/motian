import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockListPlatformCatalog,
  mockGetPlatformOnboardingStatus,
  mockRunScrapePipeline,
  mockRevalidateTag,
  mockCanActivatePlatformOnboarding,
} = vi.hoisted(() => ({
  mockListPlatformCatalog: vi.fn(),
  mockGetPlatformOnboardingStatus: vi.fn(),
  mockRunScrapePipeline: vi.fn(),
  mockRevalidateTag: vi.fn(),
  mockCanActivatePlatformOnboarding: vi.fn(),
}));

vi.mock("ai", () => ({
  tool: <T extends object>(definition: T) => definition,
}));

vi.mock("next/cache", () => ({
  revalidateTag: mockRevalidateTag,
}));

vi.mock("../src/services/scrapers", () => ({
  listPlatformCatalog: mockListPlatformCatalog,
  getPlatformOnboardingStatus: mockGetPlatformOnboardingStatus,
}));

vi.mock("../src/services/scrape-pipeline", () => ({
  runScrapePipeline: mockRunScrapePipeline,
}));

vi.mock("../src/services/platform-onboarding", () => ({
  canActivatePlatformOnboarding: mockCanActivatePlatformOnboarding,
}));

import { triggerScraper } from "../src/ai/tools/trigger-scraper";

type TriggerScraperTool = {
  execute: (input: { platform: string }) => Promise<Record<string, unknown>>;
};

const tool = triggerScraper as unknown as TriggerScraperTool;

describe("triggerScraper tool", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListPlatformCatalog.mockResolvedValue([{ slug: "striive" }, { slug: "linkedin" }]);
    mockCanActivatePlatformOnboarding.mockReturnValue(false);
  });

  it("returns recovery guidance for unknown platforms", async () => {
    const result = await tool.execute({ platform: "unknown-platform" });

    expect(result).toMatchObject({
      error: "Onbekend platform: unknown-platform",
      availablePlatforms: ["striive", "linkedin"],
      recommendedTools: ["platformsList", "platformAutoSetup"],
    });
    expect(mockGetPlatformOnboardingStatus).not.toHaveBeenCalled();
  });

  it("returns onboarding next steps when config is missing", async () => {
    mockGetPlatformOnboardingStatus.mockResolvedValue({
      catalog: { slug: "striive" },
      config: null,
      latestRun: {
        status: "waiting_for_credentials",
        nextActions: ["collect_credentials_from_user", "resume_onboarding"],
      },
    });

    const result = await tool.execute({ platform: "striive" });

    expect(result).toMatchObject({
      error: "Geen scraper configuratie gevonden voor striive",
      onboardingStatus: "waiting_for_credentials",
      recommendedTools: ["platformOnboardingStatus", "platformConfigCreate"],
      nextActions: ["collect_credentials_from_user", "resume_onboarding"],
    });
  });

  it("surfaces activation guidance for inactive but ready configs", async () => {
    mockCanActivatePlatformOnboarding.mockReturnValue(true);
    mockGetPlatformOnboardingStatus.mockResolvedValue({
      catalog: { slug: "striive" },
      config: {
        baseUrl: "https://example.com",
        isActive: false,
        validationStatus: "validated",
        lastTestImportStatus: "success",
      },
      latestRun: {
        status: "tested",
        nextActions: ["activate"],
      },
    });

    const result = await tool.execute({ platform: "striive" });

    expect(result).toMatchObject({
      error: "Scraper voor striive is niet actief",
      onboardingStatus: "tested",
      validationStatus: "validated",
      lastTestImportStatus: "success",
      recommendedTools: ["platformActivate", "platformOnboardingStatus"],
      nextActions: ["activate"],
    });
    expect(mockRunScrapePipeline).not.toHaveBeenCalled();
  });

  it("keeps the success path unchanged and revalidates related tags", async () => {
    mockGetPlatformOnboardingStatus.mockResolvedValue({
      catalog: { slug: "striive" },
      config: {
        baseUrl: "https://example.com",
        isActive: true,
        validationStatus: "validated",
        lastTestImportStatus: "success",
      },
      latestRun: {
        status: "completed",
        nextActions: [],
      },
    });
    mockRunScrapePipeline.mockResolvedValue({
      jobsNew: 3,
      duplicates: 1,
      errors: [],
    });

    const result = await tool.execute({ platform: "striive" });

    expect(result).toEqual({
      platform: "striive",
      jobsNew: 3,
      duplicates: 1,
      errors: undefined,
      status: "success",
    });
    expect(mockRevalidateTag).toHaveBeenCalledWith("jobs", "default");
    expect(mockRevalidateTag).toHaveBeenCalledWith("scrape-results", "default");
    expect(mockRevalidateTag).toHaveBeenCalledWith("scrapers", "default");
  });
});
