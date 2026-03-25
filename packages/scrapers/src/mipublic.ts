import type {
  PlatformAdapter,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
  RawScrapedListing,
} from "./types";
import {
  detectPublicJobBoardBlocker,
  fetchPublicJobBoardPage,
  scrapePublicJobBoard,
} from "./public-job-board";

const DEFAULT_MIPUBLIC_URL = "https://mipublic.nl/zzp-opdrachten-overheid/";

function isMipublicListingUrl(url: URL): boolean {
  return (
    url.hostname === "mipublic.nl" &&
    (/^\/vacature\//.test(url.pathname) || /^\/zzp-opdrachten/.test(url.pathname))
  );
}

function normalizeMipublicSourceUrl(baseUrl: string): string {
  return baseUrl.trim() || DEFAULT_MIPUBLIC_URL;
}

async function scrapeMipublicListings(
  config: PlatformRuntimeConfig,
): Promise<RawScrapedListing[]> {
  return scrapePublicJobBoard({
    displayName: "MiPublic",
    sourceUrl: normalizeMipublicSourceUrl(config.baseUrl),
    isAllowedListingUrl: isMipublicListingUrl,
  });
}

export const mipublicAdapter: PlatformAdapter = {
  async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
    const sourceUrl = normalizeMipublicSourceUrl(config.baseUrl);

    let page;
    try {
      page = await fetchPublicJobBoardPage(sourceUrl);
    } catch (error) {
      return {
        ok: false,
        status: "failed",
        message: error instanceof Error ? error.message : String(error),
      };
    }

    let parsedUrl: URL;
    try {
      parsedUrl = new URL(page.url);
    } catch {
      return {
        ok: false,
        status: "failed",
        message: "MiPublic gaf een ongeldige redirect-URL terug.",
      };
    }

    if (!isMipublicListingUrl(parsedUrl)) {
      return {
        ok: false,
        status: "failed",
        message: "MiPublic bron-URL moet op mipublic.nl blijven.",
        blockerKind: "source_url_redirect",
        evidence: {
          finalUrl: page.url,
          requestedUrl: page.requestedUrl,
        },
      };
    }

    const blocker = detectPublicJobBoardBlocker(page, "MiPublic");
    if (blocker) {
      return {
        ok: false,
        status: "failed",
        message: blocker.message,
        blockerKind: blocker.blockerKind,
        evidence: blocker.evidence,
      };
    }

    return {
      ok: true,
      status: "validated",
      message: "MiPublic bron-URL is geldig en klaar voor import.",
      evidence: {
        finalUrl: page.url,
        requestedUrl: page.requestedUrl,
      },
    };
  },

  async scrape(config: PlatformRuntimeConfig): Promise<PlatformScrapeResult> {
    try {
      return {
        listings: await scrapeMipublicListings(config),
      };
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
    const result = await mipublicAdapter.scrape(config);
    const listings = result.listings.slice(0, options?.limit ?? result.listings.length);

    return {
      status: listings.length > 0 ? "success" : "failed",
      jobsFound: listings.length,
      listings,
      errors: result.errors,
      blockerKind: result.blockerKind,
      evidence: result.evidence,
    };
  },
};
