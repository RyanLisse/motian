import { afterEach, describe, expect, it, vi } from "vitest";

import {
  collectMipublicVacatureUrls,
  parseMipublicSitemap,
} from "../packages/scrapers/src/mipublic";

function buildUrlset(urls: Array<{ loc: string; lastmod?: string }>): string {
  const entries = urls
    .map(
      ({ loc, lastmod }) =>
        `<url><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</url>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</urlset>`;
}

function buildSitemapIndex(children: Array<{ loc: string; lastmod?: string }>): string {
  const entries = children
    .map(
      ({ loc, lastmod }) =>
        `<sitemap><loc>${loc}</loc>${lastmod ? `<lastmod>${lastmod}</lastmod>` : ""}</sitemap>`,
    )
    .join("");
  return `<?xml version="1.0" encoding="UTF-8"?><sitemapindex xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">${entries}</sitemapindex>`;
}

function todayIso(): string {
  return new Date().toISOString();
}

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

describe("parseMipublicSitemap", () => {
  it("detects a sitemap index and returns its children", () => {
    const xml = buildSitemapIndex([
      { loc: "https://mipublic.nl/vacature-sitemap.xml", lastmod: "2025-08-20T19:07:17+00:00" },
      { loc: "https://mipublic.nl/vacature-sitemap19.xml", lastmod: "2025-03-01T00:00:00+00:00" },
    ]);

    const parsed = parseMipublicSitemap(xml);

    expect(parsed.kind).toBe("index");
    if (parsed.kind !== "index") return;
    expect(parsed.children).toHaveLength(2);
    expect(parsed.children[0]).toMatchObject({
      url: "https://mipublic.nl/vacature-sitemap.xml",
    });
    expect(parsed.children[0].lastmod).toBeInstanceOf(Date);
  });

  it("filters urlset entries by the 90-day lastmod cutoff and vacancy path", () => {
    const xml = buildUrlset([
      { loc: "https://mipublic.nl/vacature/recent-job/", lastmod: todayIso() },
      { loc: "https://mipublic.nl/vacature/stale-job/", lastmod: "2022-01-01T00:00:00+00:00" },
      { loc: "https://mipublic.nl/over-ons/", lastmod: todayIso() },
    ]);

    const parsed = parseMipublicSitemap(xml);

    expect(parsed.kind).toBe("urlset");
    if (parsed.kind !== "urlset") return;
    expect(parsed.urls).toEqual(["https://mipublic.nl/vacature/recent-job/"]);
  });
});

describe("collectMipublicVacatureUrls", () => {
  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("walks a sitemap index and aggregates ≥100 vacancy URLs across children", async () => {
    const indexUrl = "https://mipublic.nl/sitemap_index.xml";
    const today = todayIso();

    // Recent sub-sitemap gets the vast majority of URLs — simulates Yoast's
    // rolling active sitemap on mipublic.nl.
    const freshChild = "https://mipublic.nl/vacature-sitemap.xml";
    const staleChild = "https://mipublic.nl/vacature-sitemap2.xml";

    const indexXml = buildSitemapIndex([
      { loc: freshChild, lastmod: today },
      { loc: staleChild, lastmod: "2023-11-23T14:44:27+00:00" },
    ]);

    const freshUrls = Array.from({ length: 120 }, (_, i) => ({
      loc: `https://mipublic.nl/vacature/fresh-job-${i + 1}/`,
      lastmod: today,
    }));
    const staleUrls = Array.from({ length: 50 }, (_, i) => ({
      loc: `https://mipublic.nl/vacature/stale-job-${i + 1}/`,
      lastmod: "2022-01-01T00:00:00+00:00",
    }));

    const fetcher = vi.fn(async (url: string) => {
      if (url === freshChild) {
        return { url, status: 200, html: buildUrlset(freshUrls) };
      }
      if (url === staleChild) {
        return { url, status: 200, html: buildUrlset(staleUrls) };
      }
      throw new Error(`Unexpected sub-sitemap fetch: ${url}`);
    });

    const result = await collectMipublicVacatureUrls(indexXml, indexUrl, fetcher);

    expect(result.urls.length).toBeGreaterThanOrEqual(100);
    expect(result.urls).toContain("https://mipublic.nl/vacature/fresh-job-1/");
    expect(result.errors).toEqual([]);
    expect(fetcher).toHaveBeenCalledTimes(2);
  });

  it("surfaces HTTP errors from sub-sitemaps without collapsing the whole collection", async () => {
    const indexXml = buildSitemapIndex([
      { loc: "https://mipublic.nl/vacature-sitemap.xml", lastmod: todayIso() },
      { loc: "https://mipublic.nl/vacature-sitemap-broken.xml", lastmod: todayIso() },
    ]);

    const fetcher = vi.fn(async (url: string) => {
      if (url === "https://mipublic.nl/vacature-sitemap.xml") {
        return {
          url,
          status: 200,
          html: buildUrlset([
            { loc: "https://mipublic.nl/vacature/werkende-job/", lastmod: todayIso() },
          ]),
        };
      }
      return { url, status: 502, html: "Bad Gateway" };
    });

    const result = await collectMipublicVacatureUrls(
      indexXml,
      "https://mipublic.nl/sitemap_index.xml",
      fetcher,
    );

    expect(result.urls).toEqual(["https://mipublic.nl/vacature/werkende-job/"]);
    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("HTTP 502");
  });
});

describe("mipublicAdapter.scrape", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("falls back to /sitemap_index.xml when the flat /vacature-sitemap.xml is stale (RJC-213)", async () => {
    const primarySitemapUrl = "https://mipublic.nl/vacature-sitemap.xml";
    const indexUrl = "https://mipublic.nl/sitemap_index.xml";
    const freshChildUrl = "https://mipublic.nl/vacature-sitemap19.xml";

    // Primary sitemap has only stale entries → yields 0 URLs after the 90-day cutoff.
    const staleUrlsetXml = buildUrlset([
      { loc: "https://mipublic.nl/vacature/stale/", lastmod: "2022-01-01T00:00:00+00:00" },
    ]);
    const indexXml = buildSitemapIndex([{ loc: freshChildUrl, lastmod: todayIso() }]);
    const freshUrlsetXml = buildUrlset([
      { loc: "https://mipublic.nl/vacature/verse-vacature/", lastmod: todayIso() },
    ]);

    const jobPosting = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Beleidsmedewerker",
      description: "<p>Verse MiPublic-vacature</p>",
      url: "https://mipublic.nl/vacature/verse-vacature/",
      identifier: { value: "mipublic-rjc213" },
      hiringOrganization: { name: "Gemeente Motian" },
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === primarySitemapUrl) return createHtmlResponse({ url, html: staleUrlsetXml });
      if (url === indexUrl) return createHtmlResponse({ url, html: indexXml });
      if (url === freshChildUrl) return createHtmlResponse({ url, html: freshUrlsetXml });
      if (url === "https://mipublic.nl/vacature/verse-vacature/") {
        return createHtmlResponse({
          url,
          html: `<html><head><script type="application/ld+json">${JSON.stringify(jobPosting)}</script></head><body></body></html>`,
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { mipublicAdapter } = await import("../packages/scrapers/src/mipublic");
    const result = await mipublicAdapter.scrape({
      baseUrl: "https://mipublic.nl",
      parameters: {},
    });

    expect(result.listings).toHaveLength(1);
    expect(result.listings[0]).toMatchObject({
      title: "Beleidsmedewerker",
      externalId: "mipublic-rjc213",
    });
    // Primary sitemap was fetched, fallback index + one child sitemap were traversed,
    // and finally the detail page was fetched — four total network calls.
    expect(fetchMock).toHaveBeenCalledTimes(4);
  });

  it("continues the scrape when some detail pages lack JobPosting data", async () => {
    const primarySitemapUrl = "https://mipublic.nl/vacature-sitemap.xml";
    const jobUrls = [
      "https://mipublic.nl/vacature/job-with-jsonld/",
      "https://mipublic.nl/vacature/job-without-jsonld/",
      "https://mipublic.nl/vacature/job-archived/",
    ];

    const urlsetXml = buildUrlset(jobUrls.map((loc) => ({ loc, lastmod: todayIso() })));

    const jobPosting = {
      "@context": "https://schema.org",
      "@type": "JobPosting",
      title: "Senior Adviseur",
      description: "<p>Motian MiPublic-vacature</p>",
      url: jobUrls[0],
      identifier: { value: "mipublic-001" },
      hiringOrganization: { name: "Gemeente Motian" },
    };

    const fetchMock = vi.fn(async (input: RequestInfo | URL) => {
      const url = String(input);
      if (url === primarySitemapUrl) return createHtmlResponse({ url, html: urlsetXml });
      if (url === jobUrls[0]) {
        return createHtmlResponse({
          url,
          html: `<html><head><script type="application/ld+json">${JSON.stringify(jobPosting)}</script></head><body><h1>Senior Adviseur</h1></body></html>`,
        });
      }
      if (url === jobUrls[1]) {
        // No JSON-LD, but a usable <h1> for the fallback parser — scrape should continue.
        return createHtmlResponse({
          url,
          html: "<html><head><title>Docent Wiskunde - MiPublic</title></head><body><h1>Docent Wiskunde</h1></body></html>",
        });
      }
      if (url === jobUrls[2]) {
        // Page exists but has no JobPosting and no meaningful title — counted as skipped.
        return createHtmlResponse({
          url,
          html: "<html><head><title>MiPublic</title></head><body>Deze vacature is niet meer beschikbaar.</body></html>",
        });
      }
      throw new Error(`Unexpected fetch: ${url}`);
    });
    vi.stubGlobal("fetch", fetchMock);

    const { mipublicAdapter } = await import("../packages/scrapers/src/mipublic");

    const result = await mipublicAdapter.scrape({
      baseUrl: "https://mipublic.nl",
      parameters: {},
    });

    expect(result.listings.length).toBeGreaterThanOrEqual(1);
    expect(result.listings.some((listing) => listing.title === "Senior Adviseur")).toBe(true);
    expect(result.listings.some((listing) => listing.title === "Docent Wiskunde")).toBe(true);
    // Missing-JSON-LD page is summarised into a single line, not a per-URL failure cascade.
    expect(result.errors?.some((error) => /MiPublic detailpagina/.test(error))).toBe(true);
    expect(result.errors?.every((error) => !/geen parseerbare vacature-URLs/.test(error))).toBe(
      true,
    );
  });
});
