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

const DEFAULT_MONSTERBOARD_URL = "https://www.monsterboard.nl/vacatures/";

function isMonsterboardListingUrl(url: URL): boolean {
  return (
    url.hostname === "www.monsterboard.nl" &&
    (/^\/vacatures\//.test(url.pathname) || /^\/job-openings\//.test(url.pathname))
  );
}

function normalizeMonsterboardSourceUrl(baseUrl: string): string {
  return baseUrl.trim() || DEFAULT_MONSTERBOARD_URL;
}

async function scrapeMonsterboardListings(
  config: PlatformRuntimeConfig,
): Promise<RawScrapedListing[]> {
  return scrapePublicJobBoard({
    displayName: "Monsterboard",
    sourceUrl: normalizeMonsterboardSourceUrl(config.baseUrl),
    isAllowedListingUrl: isMonsterboardListingUrl,
  });
}

export const monsterboardAdapter: PlatformAdapter = {
  async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
    const sourceUrl = normalizeMonsterboardSourceUrl(config.baseUrl);

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
        message: "Monsterboard gaf een ongeldige redirect-URL terug.",
      };
    }

    if (!isMonsterboardListingUrl(parsedUrl)) {
      return {
        ok: false,
        status: "failed",
        message: "Monsterboard bron-URL moet op www.monsterboard.nl blijven.",
        blockerKind: "source_url_redirect",
        evidence: {
          finalUrl: page.url,
          requestedUrl: page.requestedUrl,
        },
      };
    }

    const blocker = detectPublicJobBoardBlocker(page, "Monsterboard");
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
      message: "Monsterboard bron-URL is geldig en klaar voor import.",
      evidence: {
        finalUrl: page.url,
        requestedUrl: page.requestedUrl,
      },
    };
  },

  async scrape(config: PlatformRuntimeConfig): Promise<PlatformScrapeResult> {
    try {
      return {
        listings: await scrapeMonsterboardListings(config),
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
    const result = await monsterboardAdapter.scrape(config);
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
