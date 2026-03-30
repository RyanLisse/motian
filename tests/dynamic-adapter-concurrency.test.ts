import { beforeEach, describe, expect, it, vi } from "vitest";
import { dynamicAdapter } from "../packages/scrapers/src/dynamic-adapter";

describe("dynamic adapter detail fetch concurrency", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllEnvs();
  });

  it("processes detail pages in bounded batches instead of firing every request at once", async () => {
    vi.stubEnv("FIRECRAWL_API_KEY", "");

    let inFlightDetailRequests = 0;
    let maxInFlightDetailRequests = 0;
    const detailDelayMs = 10;

    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "https://example.com/jobs") {
          return {
            ok: true,
            text: async () =>
              Array.from({ length: 5 }, (_, index) => {
                const jobNumber = index + 1;
                return `<div class="job"><a href="/jobs/${jobNumber}">Job ${jobNumber}</a></div>`;
              }).join(""),
          };
        }

        inFlightDetailRequests += 1;
        maxInFlightDetailRequests = Math.max(maxInFlightDetailRequests, inFlightDetailRequests);

        await new Promise((resolve) => setTimeout(resolve, detailDelayMs));
        inFlightDetailRequests -= 1;

        const jobNumber = url.split("/").pop();
        return {
          ok: true,
          text: async () => `<article><h1>Job ${jobNumber}</h1></article>`,
        };
      }),
    );

    const result = await dynamicAdapter.testImport(
      {
        slug: "example-board",
        baseUrl: "https://example.com/jobs",
        auth: {},
        parameters: {
          scrapingStrategy: {
            listSelector: ".job",
            linkSelector: "a",
            paginationType: "none",
            maxPages: 1,
            fieldMapping: {
              title: "h1",
            },
            needsDetailPage: true,
          },
        },
      },
      { limit: 5 },
    );

    expect(result.status).toBe("success");
    expect(result.jobsFound).toBe(5);
    expect(maxInFlightDetailRequests).toBeLessThanOrEqual(4);
  });
});
