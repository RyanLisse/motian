import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  analyzePlatform,
  validateExternalUrl,
  getPlatformByBaseUrl,
  getPlatformOnboardingStatus,
  createPlatformCatalogEntry,
  createConfig,
  trigger,
  createPublicToken,
  revalidateTag,
} = vi.hoisted(() => ({
  analyzePlatform: vi.fn(),
  validateExternalUrl: vi.fn(),
  getPlatformByBaseUrl: vi.fn(),
  getPlatformOnboardingStatus: vi.fn(),
  createPlatformCatalogEntry: vi.fn(),
  createConfig: vi.fn(),
  trigger: vi.fn(),
  createPublicToken: vi.fn(),
  revalidateTag: vi.fn(),
}));

vi.mock("@/src/services/platform-analyzer", () => ({
  analyzePlatform,
}));

vi.mock("@/src/services/scrapers", () => ({
  completeOnboarding: vi.fn(),
  createConfig,
  createPlatformCatalogEntry,
  getConfigByPlatform: vi.fn(),
  getPlatformByBaseUrl,
  getPlatformCatalogEntry: vi.fn(),
  getPlatformOnboardingStatus,
  updateConfigParameters: vi.fn(),
  validateExternalUrl,
}));

vi.mock("@trigger.dev/sdk", () => ({
  auth: {
    createPublicToken,
  },
  tasks: {
    trigger,
  },
}));

vi.mock("next/cache", () => ({
  revalidateTag,
}));

import { platformAutoSetup } from "@/src/ai/tools/platform-dynamic";

describe("platformAutoSetup credential gate", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    validateExternalUrl.mockResolvedValue(undefined);
    getPlatformByBaseUrl.mockResolvedValue(null);
    createPlatformCatalogEntry.mockResolvedValue(undefined);
    createConfig.mockResolvedValue({ id: "cfg-api-key" });
    trigger.mockResolvedValue({ id: "run-123" });
    createPublicToken.mockResolvedValue("token-123");
    getPlatformOnboardingStatus.mockResolvedValue({ latestRun: null });
  });

  it("treats api_key auth as credentials-required and exposes GenUI field metadata", async () => {
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

    const result = await platformAutoSetup.execute?.({
      url: "https://example.com/jobs",
    });

    expect(result).toEqual({
      status: "credentials_needed",
      platform: "api-platform",
      displayName: "API Platform",
      authMode: "api_key",
      fields: [{ name: "apiKey", label: "API-sleutel", type: "password" }],
    });
    expect(createPlatformCatalogEntry).toHaveBeenCalledWith(
      expect.objectContaining({
        slug: "api-platform",
        authMode: "api_key",
        source: "agent",
      }),
    );
    expect(createConfig).toHaveBeenCalledWith({
      platform: "api-platform",
      baseUrl: "https://example.com/jobs",
      parameters: {
        scrapingStrategy: {
          listSelector: ".job",
          linkSelector: "a",
          paginationType: "none",
          maxPages: 1,
          fieldMapping: { title: ".title" },
          needsDetailPage: false,
        },
      },
      source: "agent",
    });
    expect(trigger).not.toHaveBeenCalled();
    expect(createPublicToken).not.toHaveBeenCalled();
    expect(revalidateTag).toHaveBeenCalledWith("scrapers", "default");
  });
});
