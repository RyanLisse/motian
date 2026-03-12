import { afterEach, describe, expect, it, vi } from "vitest";
import { getPlatformAdapter } from "../packages/scrapers/src/platform-registry";

function createHtmlResponse(options: {
  html: string;
  status?: number;
  url: string;
  headers?: Record<string, string>;
}): Response {
  return {
    status: options.status ?? 200,
    url: options.url,
    headers: new Headers(options.headers),
    text: async () => options.html,
  } as Response;
}

describe("public job board adapters", () => {
  afterEach(() => {
    vi.restoreAllMocks();
    vi.unstubAllGlobals();
  });

  it("ignores off-domain detail links when scraping public job boards", async () => {
    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);

      if (url === "https://www.monsterboard.nl/vacatures/it") {
        return createHtmlResponse({
          url,
          html: `
            <html>
              <body>
                <a href="https://www.monsterboard.nl.evil.test/job-openings/evil">evil</a>
                <a href="https://www.monsterboard.nl/job-openings/senior-engineer">safe</a>
              </body>
            </html>
          `,
        });
      }

      if (url === "https://www.monsterboard.nl/job-openings/senior-engineer") {
        return createHtmlResponse({
          url,
          html: `<html><head><script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "JobPosting",
            title: "Senior Engineer",
            description: "<p>Bouw recruitmentsoftware.</p>",
            url,
            identifier: { value: "monster-123" },
            hiringOrganization: { name: "Motian" },
          })}</script></head><body></body></html>`,
        });
      }

      throw new Error(`Unexpected fetch for ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { scrapePublicJobBoard } = await import("../packages/scrapers/src/public-job-board");
    const results = await scrapePublicJobBoard({
      displayName: "Monsterboard",
      sourceUrl: "https://www.monsterboard.nl/vacatures/it",
      isAllowedListingUrl: (url: URL) =>
        url.hostname === "www.monsterboard.nl" &&
        (/^\/vacatures\//.test(url.pathname) || /^\/job-openings\//.test(url.pathname)),
    });

    expect(results).toHaveLength(1);
    expect(results[0]).toMatchObject({
      title: "Senior Engineer",
      company: "Motian",
      externalId: "monster-123",
      externalUrl: "https://www.monsterboard.nl/job-openings/senior-engineer",
    });
    expect(fetchMock).toHaveBeenCalledTimes(2);
    expect(fetchMock).not.toHaveBeenCalledWith(
      "https://www.monsterboard.nl.evil.test/job-openings/evil",
      expect.anything(),
    );
  });

  it("registers Monsterboard and maps JobPosting JSON-LD listings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        return createHtmlResponse({
          url,
          html: `<html><head><script type="application/ld+json">${JSON.stringify({
            "@context": "https://schema.org",
            "@type": "JobPosting",
            title: "Senior Engineer",
            description: "<p>Bouw recruitmentsoftware.</p>",
            url,
            identifier: { value: "monster-123" },
            hiringOrganization: { name: "Motian" },
            jobLocation: {
              address: {
                addressLocality: "Amsterdam",
                addressRegion: "Noord-Holland",
                addressCountry: "NL",
                postalCode: "1011AA",
              },
            },
          })}</script></head><body></body></html>`,
        });
      }),
    );

    const adapter = getPlatformAdapter("monsterboard");

    expect(adapter).toBeDefined();
    if (!adapter) {
      throw new Error("Monsterboard adapter should be registered");
    }

    const result = await adapter.scrape({
      slug: "monsterboard",
      baseUrl: "https://www.monsterboard.nl/job-openings/senior-engineer",
      parameters: {},
      auth: {},
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({
      title: "Senior Engineer",
      company: "Motian",
      externalId: "monster-123",
      externalUrl: "https://www.monsterboard.nl/job-openings/senior-engineer",
      location: "Amsterdam - Noord-Holland",
      province: "Noord-Holland",
      postcode: "1011AA",
      countryCode: "NL",
    });
  });
});
