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

  it("registers MiPublic and scrapes vacature detail pages from the sitemap", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "https://mipublic.nl/vacature-sitemap.xml") {
          return createHtmlResponse({
            url,
            html: `<?xml version="1.0" encoding="UTF-8"?>
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url>
                  <loc>https://mipublic.nl/vacature/online-communicatie-adviseur/</loc>
                </url>
                <url>
                  <loc>https://mipublic.nl/vacature/beleidsadviseur-wonen/</loc>
                </url>
              </urlset>`,
            headers: { "content-type": "application/xml" },
          });
        }

        if (url === "https://mipublic.nl/vacature/online-communicatie-adviseur/") {
          return createHtmlResponse({
            url,
            html: `<html><head><script type="application/ld+json">${JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "JobPosting",
                title: "Online Communicatie Adviseur (zzp - freelance - interim)",
                description: "<p>Adviseer over digitale toegankelijkheid.</p>",
                url,
                identifier: { value: "mipublic-123" },
                hiringOrganization: { name: "Gemeente Maassluis" },
                jobLocation: {
                  address: {
                    addressLocality: "Gemeente Maassluis",
                    addressRegion: "Zuid-Holland",
                    addressCountry: "NL",
                  },
                },
                baseSalary: {
                  value: {
                    value: "95",
                    unitText: "HOUR",
                  },
                  currency: "EUR",
                },
                validThrough: "2026-07-31T23:59:59+02:00",
                employmentType: ["FULL_TIME"],
              },
            ])}</script></head><body></body></html>`,
          });
        }

        if (url === "https://mipublic.nl/vacature/beleidsadviseur-wonen/") {
          return createHtmlResponse({
            url,
            html: `<html><head><script type="application/ld+json">${JSON.stringify([
              {
                "@context": "https://schema.org",
                "@type": "JobPosting",
                title: "Beleidsadviseur Wonen",
                description: "<p>Bouw mee aan woonbeleid.</p>",
                url,
                identifier: { value: "mipublic-456" },
                hiringOrganization: { name: "Gemeente Delft" },
                jobLocation: {
                  address: {
                    addressLocality: "Delft",
                    addressRegion: "Zuid-Holland",
                    addressCountry: "NL",
                  },
                },
                employmentType: ["FULL_TIME"],
              },
            ])}</script></head><body></body></html>`,
          });
        }

        throw new Error(`Unexpected fetch for ${url}`);
      }),
    );

    const adapter = getPlatformAdapter("mipublic");

    expect(adapter).toBeDefined();
    if (!adapter) {
      throw new Error("MiPublic adapter should be registered");
    }

    const result = await adapter.scrape({
      slug: "mipublic",
      baseUrl: "https://mipublic.nl",
      parameters: {},
      auth: {},
    });

    expect(result.listings).toHaveLength(2);
    expect(result.listings).toEqual([
      expect.objectContaining({
        title: "Online Communicatie Adviseur (zzp - freelance - interim)",
        company: "Gemeente Maassluis",
        externalId: "mipublic-123",
        externalUrl: "https://mipublic.nl/vacature/online-communicatie-adviseur/",
        location: "Gemeente Maassluis - Zuid-Holland",
        province: "Zuid-Holland",
        countryCode: "NL",
        rateMin: 95,
        rateMax: 95,
      }),
      expect.objectContaining({
        title: "Beleidsadviseur Wonen",
        company: "Gemeente Delft",
        externalId: "mipublic-456",
        externalUrl: "https://mipublic.nl/vacature/beleidsadviseur-wonen/",
        location: "Delft - Zuid-Holland",
      }),
    ]);
  });

  it("falls back to HTML title extraction when MiPublic pages lack JSON-LD", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "https://mipublic.nl/vacature-sitemap.xml") {
          return createHtmlResponse({
            url,
            html: `<?xml version="1.0" encoding="UTF-8"?>
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url>
                  <loc>https://mipublic.nl/vacature/java-script-specialist/</loc>
                </url>
              </urlset>`,
            headers: { "content-type": "application/xml" },
          });
        }

        if (url === "https://mipublic.nl/vacature/java-script-specialist/") {
          return createHtmlResponse({
            url,
            html: `<html>
              <head><title>Java script specialist - MiPublic</title></head>
              <body>
                <h1>Java script specialist</h1>
                <p>NFI (Netherlands Forensic Institute)</p>
                <p>Zuid-Holland</p>
              </body>
            </html>`,
          });
        }

        throw new Error(`Unexpected fetch for ${url}`);
      }),
    );

    const adapter = getPlatformAdapter("mipublic");
    expect(adapter).toBeDefined();

    const result = await adapter?.scrape({
      slug: "mipublic",
      baseUrl: "https://mipublic.nl",
      parameters: {},
      auth: {},
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({
      title: "Java script specialist",
      externalId: "java-script-specialist",
      externalUrl: "https://mipublic.nl/vacature/java-script-specialist/",
    });
    expect(result.errors).toBeUndefined();
  });

  it("does not import 404 pages as fallback vacancies", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "https://mipublic.nl/vacature-sitemap.xml") {
          return createHtmlResponse({
            url,
            html: `<?xml version="1.0" encoding="UTF-8"?>
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url>
                  <loc>https://mipublic.nl/vacature/verwijderd/</loc>
                </url>
              </urlset>`,
            headers: { "content-type": "application/xml" },
          });
        }

        if (url === "https://mipublic.nl/vacature/verwijderd/") {
          return createHtmlResponse({
            url,
            status: 404,
            html: `<html><head><title>Pagina niet gevonden - MiPublic</title></head>
              <body><h1>Pagina niet gevonden</h1></body></html>`,
          });
        }

        throw new Error(`Unexpected fetch for ${url}`);
      }),
    );

    const adapter = getPlatformAdapter("mipublic");
    const result = await adapter?.scrape({
      slug: "mipublic",
      baseUrl: "https://mipublic.nl",
      parameters: {},
      auth: {},
    });

    expect(result.listings).toHaveLength(0);
    expect(result.errors).toBeDefined();
  });

  it("preserves hyphenated titles in title-only fallback path", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "https://mipublic.nl/vacature-sitemap.xml") {
          return createHtmlResponse({
            url,
            html: `<?xml version="1.0" encoding="UTF-8"?>
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url>
                  <loc>https://mipublic.nl/vacature/front-end-developer/</loc>
                </url>
              </urlset>`,
            headers: { "content-type": "application/xml" },
          });
        }

        if (url === "https://mipublic.nl/vacature/front-end-developer/") {
          return createHtmlResponse({
            url,
            html: `<html>
              <head><title>Front-end Developer - MiPublic</title></head>
              <body><p>Geen h1 op deze pagina</p></body>
            </html>`,
          });
        }

        throw new Error(`Unexpected fetch for ${url}`);
      }),
    );

    const adapter = getPlatformAdapter("mipublic");
    const result = await adapter?.scrape({
      slug: "mipublic",
      baseUrl: "https://mipublic.nl",
      parameters: {},
      auth: {},
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({
      title: "Front-end Developer",
      externalId: "front-end-developer",
    });
  });

  it("uses canonical URL after redirect for fallback listings", async () => {
    vi.stubGlobal(
      "fetch",
      vi.fn(async (input: RequestInfo | URL) => {
        const url = String(input);

        if (url === "https://mipublic.nl/vacature-sitemap.xml") {
          return createHtmlResponse({
            url,
            html: `<?xml version="1.0" encoding="UTF-8"?>
              <urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">
                <url>
                  <loc>https://mipublic.nl/vacature/old-slug/</loc>
                </url>
              </urlset>`,
            headers: { "content-type": "application/xml" },
          });
        }

        if (url === "https://mipublic.nl/vacature/old-slug/") {
          return createHtmlResponse({
            url: "https://mipublic.nl/vacature/canonical-slug/",
            html: `<html>
              <head><title>Projectleider - MiPublic</title></head>
              <body><h1>Projectleider</h1></body>
            </html>`,
          });
        }

        throw new Error(`Unexpected fetch for ${url}`);
      }),
    );

    const adapter = getPlatformAdapter("mipublic");
    const result = await adapter?.scrape({
      slug: "mipublic",
      baseUrl: "https://mipublic.nl",
      parameters: {},
      auth: {},
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({
      title: "Projectleider",
      externalId: "canonical-slug",
      externalUrl: "https://mipublic.nl/vacature/canonical-slug/",
    });
  });
});
