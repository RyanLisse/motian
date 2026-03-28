import { stripHtml } from "./lib/utils";
import {
  fetchPublicJobBoardPage,
  parsePublicJobBoardJobPostings,
} from "./public-job-board";
import type {
  PlatformAdapter,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
  RawScrapedListing,
} from "./types";

const DEFAULT_MIPUBLIC_ORIGIN = "https://mipublic.nl";
const DEFAULT_SITEMAP_PATH = "/vacature-sitemap.xml";
const DEFAULT_DETAIL_CONCURRENCY = 4;
const MAX_DETAIL_CONCURRENCY = 8;

type MipublicOptions = {
  detailConcurrency: number;
  maxListings?: number;
  sitemapUrl: string;
};

function normalizeMipublicOrigin(baseUrl: string): string {
  const value = baseUrl.trim() || DEFAULT_MIPUBLIC_ORIGIN;
  const url = new URL(value);

  if (url.hostname !== "mipublic.nl") {
    throw new Error("MiPublic bron-URL moet op mipublic.nl blijven.");
  }

  return url.origin;
}

function resolveMipublicOptions(config: PlatformRuntimeConfig): MipublicOptions {
  const parameters = config.parameters ?? {};
  const normalizedOrigin = normalizeMipublicOrigin(config.baseUrl);
  const sitemapPath =
    typeof parameters.sitemapPath === "string" && parameters.sitemapPath.trim().length > 0
      ? parameters.sitemapPath.trim()
      : DEFAULT_SITEMAP_PATH;
  const rawConcurrency =
    typeof parameters.detailConcurrency === "number"
      ? parameters.detailConcurrency
      : DEFAULT_DETAIL_CONCURRENCY;
  const detailConcurrency = Math.max(1, Math.min(MAX_DETAIL_CONCURRENCY, Math.trunc(rawConcurrency)));
  const maxListings =
    typeof parameters.maxListings === "number" && parameters.maxListings > 0
      ? Math.trunc(parameters.maxListings)
      : undefined;
  const sitemapUrl = new URL(sitemapPath, normalizedOrigin).toString();

  if (!sitemapUrl.startsWith(`${normalizedOrigin}/`)) {
    throw new Error("MiPublic sitemapPath moet op dezelfde host blijven.");
  }

  return {
    detailConcurrency,
    maxListings,
    sitemapUrl,
  };
}

function extractSitemapUrls(xml: string): string[] {
  const urls = new Set<string>();

  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const value = match[1]?.trim();
    if (!value) continue;

    try {
      const parsed = new URL(value);
      if (parsed.hostname === "mipublic.nl" && /^\/vacature\/[^/]+\/?$/.test(parsed.pathname)) {
        urls.add(parsed.toString());
      }
    } catch {
      continue;
    }
  }

  return [...urls];
}

async function mapWithConcurrency<TInput, TOutput>(
  items: TInput[],
  concurrency: number,
  mapper: (item: TInput) => Promise<TOutput>,
): Promise<TOutput[]> {
  if (items.length === 0) {
    return [];
  }

  const results: TOutput[] = new Array(items.length);
  let nextIndex = 0;

  async function worker() {
    while (nextIndex < items.length) {
      const currentIndex = nextIndex;
      nextIndex += 1;
      results[currentIndex] = await mapper(items[currentIndex]);
    }
  }

  await Promise.all(
    Array.from({ length: Math.min(concurrency, items.length) }, () => worker()),
  );

  return results;
}

/**
 * Fallback parser for MiPublic detail pages that lack JSON-LD JobPosting data.
 * Extracts a minimal listing from <title> or <h1> tags so the vacancy is not
 * silently dropped.
 */
function parseMipublicHtmlFallback(html: string, canonicalUrl: string): RawScrapedListing | null {
  const titleTagMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i);
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);

  const rawTitle =
    (h1Match ? stripHtml(h1Match[1]).trim() : null) ??
    (titleTagMatch ? titleTagMatch[1].replace(/\s+[-–|]\s+MiPublic.*$/i, "").trim() : null);

  if (!rawTitle || rawTitle.length < 3) return null;

  const slug = new URL(canonicalUrl).pathname.replace(/^\/vacature\//, "").replace(/\/+$/, "");

  return {
    title: rawTitle,
    description: `${rawTitle} - vacature via MiPublic`,
    externalId: slug || canonicalUrl,
    externalUrl: canonicalUrl,
  };
}

async function scrapeMipublicListings(
  config: PlatformRuntimeConfig,
  options?: { limit?: number },
): Promise<PlatformScrapeResult> {
  const resolved = resolveMipublicOptions(config);
  const sitemapPage = await fetchPublicJobBoardPage(resolved.sitemapUrl);
  const limit = options?.limit ?? resolved.maxListings;
  const detailUrls = extractSitemapUrls(sitemapPage.html).slice(0, limit);

  if (detailUrls.length === 0) {
    return {
      listings: [],
      errors: ["MiPublic sitemap bevat geen parseerbare vacature-URLs."],
    };
  }

  const results = await mapWithConcurrency(detailUrls, resolved.detailConcurrency, async (detailUrl) => {
    try {
      const detailPage = await fetchPublicJobBoardPage(detailUrl);
      const listings = parsePublicJobBoardJobPostings(detailPage.html, detailPage.url);

      if (listings.length === 0) {
        const canFallback = detailPage.status < 400;
        const fallback = canFallback
          ? parseMipublicHtmlFallback(detailPage.html, detailPage.url)
          : null;
        if (fallback) {
          return { listings: [fallback] };
        }
        return {
          error: `MiPublic detailpagina bevat geen JobPosting-data: ${detailUrl}`,
          listings: [] as RawScrapedListing[],
        };
      }

      return { listings };
    } catch (error) {
      return {
        error: error instanceof Error ? error.message : String(error),
        listings: [] as RawScrapedListing[],
      };
    }
  });

  const listings = results.flatMap((entry) => entry.listings);
  const errors = results.flatMap((entry) => (entry.error ? [entry.error] : []));

  return {
    listings,
    errors: errors.length > 0 ? errors : undefined,
  };
}

export const mipublicAdapter: PlatformAdapter = {
  async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
    const resolved = resolveMipublicOptions(config);
    const sitemapPage = await fetchPublicJobBoardPage(resolved.sitemapUrl);
    const detailUrls = extractSitemapUrls(sitemapPage.html);

    if (detailUrls.length === 0) {
      return {
        ok: false,
        status: "failed",
        message: "MiPublic sitemap bevat geen parseerbare vacaturedetailpagina's.",
      };
    }

    return {
      ok: true,
      status: "validated",
      message: "MiPublic sitemap is geldig en bevat vacaturedetailpagina's.",
      evidence: {
        sitemapUrl: resolved.sitemapUrl,
        jobsFound: detailUrls.length,
        sampleUrl: detailUrls[0],
      },
    };
  },

  async scrape(
    config: PlatformRuntimeConfig,
    options?: { limit?: number; smoke?: boolean },
  ): Promise<PlatformScrapeResult> {
    try {
      return await scrapeMipublicListings(config, {
        limit: options?.smoke ? Math.min(options?.limit ?? 5, 5) : options?.limit,
      });
    } catch (error) {
      return {
        listings: [],
        errors: [error instanceof Error ? error.message : String(error)],
      };
    }
  },

  async testImport(
    config: PlatformRuntimeConfig,
    options?: { limit?: number },
  ): Promise<PlatformTestImportResult> {
    const result = await mipublicAdapter.scrape(config, {
      limit: options?.limit,
      smoke: true,
    });
    const listings = result.listings.slice(0, options?.limit ?? result.listings.length);

    return {
      status: listings.length > 0 ? "success" : "failed",
      jobsFound: listings.length,
      listings,
      errors: result.errors,
    };
  },
};
