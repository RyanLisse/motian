import { beforeEach, describe, expect, it, vi } from "vitest";

const { normalizeUrl, tracedGenerateText, validateExternalUrl } = vi.hoisted(() => ({
  normalizeUrl: vi.fn((url: string) => {
    const parsed = new URL(url);
    return parsed.origin + parsed.pathname.replace(/\/$/, "");
  }),
  tracedGenerateText: vi.fn(),
  validateExternalUrl: vi.fn(),
}));

vi.mock("../src/lib/ai-models", () => ({
  geminiFlash: "gemini-flash-model",
  tracedGenerateText,
}));

vi.mock("../src/services/scrapers", () => ({
  normalizeUrl,
  validateExternalUrl,
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
      text: async () => "<div class='job'>Vacature</div>",
      url: "https://example.com/jobs/",
    });

    vi.stubGlobal("fetch", fetchMock);

    const result = await analyzePlatform("https://example.com/jobs/");

    expect(result.defaultBaseUrl).toBe("https://example.com/jobs");
  });

  it("sanitizes inline event handlers before sending HTML to the model", async () => {
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
          fieldMapping: { title: ".title" },
          needsDetailPage: false,
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () =>
          `<div class="job" onclick='alert(1)' onload=runBadThing()><a href="/jobs/1">Vacature</a></div>`,
        url: "https://example.com/jobs",
      }),
    );

    await analyzePlatform("https://example.com/jobs");

    const prompt = tracedGenerateText.mock.calls[0]?.[0]?.prompt as string;
    expect(prompt).toContain('<div class="job"><a href="/jobs/1">Vacature</a></div>');
    expect(prompt).not.toContain("onclick=");
    expect(prompt).not.toContain("onload=");
  });

  it("re-validates the final direct-fetch URL after redirects", async () => {
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
          fieldMapping: { title: ".title" },
          needsDetailPage: false,
        },
      },
    });

    vi.stubGlobal(
      "fetch",
      vi.fn().mockResolvedValue({
        ok: true,
        text: async () => `<div class="job">Vacature</div>`,
        url: "https://redirected.example/internal/jobs",
      }),
    );

    await analyzePlatform("https://example.com/jobs");

    expect(validateExternalUrl).toHaveBeenCalledWith("https://redirected.example/internal/jobs");
  });
});
