import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  validateExternalUrl,
  getPlatformByBaseUrl,
  createPlatformCatalogEntry,
  createConfig,
  trigger,
  revalidatePath,
  publish,
  analyzePlatform,
} = vi.hoisted(() => ({
  validateExternalUrl: vi.fn(),
  getPlatformByBaseUrl: vi.fn(),
  createPlatformCatalogEntry: vi.fn(),
  createConfig: vi.fn(),
  trigger: vi.fn(),
  revalidatePath: vi.fn(),
  publish: vi.fn(),
  analyzePlatform: vi.fn(),
}));

vi.mock("../src/services/scrapers", () => ({
  activatePlatform: vi.fn(),
  completeOnboarding: vi.fn(),
  createConfig,
  createPlatformCatalogEntry,
  getConfigByPlatform: vi.fn(),
  getPlatformByBaseUrl,
  getPlatformOnboardingStatus: vi.fn(),
  listPlatformCatalog: vi.fn(),
  triggerTestRun: vi.fn(),
  updateConfig: vi.fn(),
  validateConfig: vi.fn(),
  validateExternalUrl,
}));

vi.mock("../src/services/platform-analyzer", () => ({
  analyzePlatform,
}));

vi.mock("@trigger.dev/sdk", () => ({
  tasks: {
    trigger,
  },
}));

vi.mock("next/cache", () => ({
  revalidatePath,
}));

vi.mock("../src/lib/event-bus", () => ({
  publish,
}));

import { handlers } from "@/src/mcp/tools/platforms";

describe("platform_auto_setup MCP credential gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateExternalUrl.mockResolvedValue(undefined);
    getPlatformByBaseUrl.mockResolvedValue(null);
    createPlatformCatalogEntry.mockResolvedValue(undefined);
    createConfig.mockResolvedValue(undefined);
    trigger.mockResolvedValue({ id: "run-123" });
  });

  it("requires credentials for api_key auth instead of triggering onboarding", async () => {
    analyzePlatform.mockResolvedValue({
      slug: "api-platform",
      displayName: "API Platform",
      description: "API only bron",
      defaultBaseUrl: "https://example.com/jobs",
      adapterKind: "api_json",
      authMode: "api_key",
      capabilities: ["search"],
      scrapingStrategy: {
        listSelector: ".job",
        linkSelector: "a",
        paginationType: "none",
        maxPages: 1,
        fieldMapping: { title: ".title" },
        needsDetailPage: false,
      },
    });

    const result = await handlers.platform_auto_setup({
      url: "https://example.com/jobs",
    });

    expect(result).toEqual({
      status: "credentials_needed",
      platform: "api-platform",
      displayName: "API Platform",
      authMode: "api_key",
    });
    expect(createPlatformCatalogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "api-platform",
        authMode: "api_key",
        source: "mcp",
      }),
    );
    expect(createConfig).not.toHaveBeenCalled();
    expect(trigger).not.toHaveBeenCalled();
  });
});
