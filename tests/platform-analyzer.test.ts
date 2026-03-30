import { beforeEach, describe, expect, it, vi } from "vitest";

const { tracedGenerateText } = vi.hoisted(() => ({
  tracedGenerateText: vi.fn(),
}));

vi.mock("../src/lib/ai-models", () => ({
  geminiFlash: "gemini-flash-model",
  tracedGenerateText,
}));

import { analyzePlatform } from "../src/services/platform-analyzer";

describe("analyzePlatform", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("keeps the analyzed list path in defaultBaseUrl so dedup and runtime config agree", async () => {
    tracedGenerateText.mockResolvedValue({
      output: {
        slug: "example-board",
        displayName: "Example Board",
        description: "Voorbeeld platform",
        adapterKind: "http_html_list_detail",
        authMode: "none",
        capabilities: [],
        scrapingStrategy: {
          listSelector: ".job",
          linkSelector: "a",
          paginationType: "none",
          maxPages: 3,
          fieldMapping: {
            title: ".title",
          },
          needsDetailPage: false,
        },
      },
    });

    const fetchMock = vi.fn().mockResolvedValueOnce({
      ok: true,
      json: async () => ({
        success: true,
        data: { html: "<div class='job'>Vacature</div>", markdown: "" },
      }),
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzePlatform("https://example.com/jobs/");

    expect(result.defaultBaseUrl).toBe("https://example.com/jobs");
  });
});
