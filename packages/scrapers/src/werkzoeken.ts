import type {
  PlatformAdapter,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
  RawScrapedListing,
} from "./types";
import {
  decodeText,
  firstMatch,
  parsePositiveInteger,
  toAbsoluteUrl,
  ensureMinLength,
  stripHtml,
  sanitizeHours,
} from "./lib/utils";

const WERKZOEKEN_FETCH_TIMEOUT_MS = 20_000;
const DEFAULT_WERKZOEKEN_ORIGIN = "https://www.werkzoeken.nl";

function parseSalaryValue(value: string | undefined): number | undefined {
  if (!value) return undefined;
  const raw = value.replace(/[^\d.,]/g, "").trim();
  if (!raw) return undefined;

  const normalized = raw.match(/^\d{1,3}(\.\d{3})+(,\d+)?$/)
    ? raw.replace(/\./g, "").replace(",", ".")
    : raw.includes(",")
      ? raw.replace(/\./g, "").replace(",", ".")
      : raw;
  const parsed = Number.parseFloat(normalized);
  if (!Number.isFinite(parsed) || parsed <= 0) return undefined;
  return Math.round(parsed);
}

function normalizeHours(value: string | undefined): { min?: number; max?: number } {
  if (!value) return {};
  const range = value.match(/(\d+)\s*-\s*(\d+)/);
  if (range) {
    return {
      min: Number.parseInt(range[1], 10),
      max: Number.parseInt(range[2], 10),
    };
  }
  if (/fulltime/i.test(value)) {
    return { max: 40 };
  }
  const single = value.match(/(\d+)/);
  if (single) {
    const hours = Number.parseInt(single[1], 10);
    return { max: hours };
  }
  return {};
}

function resolveWerkzoekenSourceUrl(baseUrl: string, sourcePath: string): URL {
  const normalizedBaseUrl = new URL(baseUrl);
  const sourceUrl = new URL(sourcePath, normalizedBaseUrl);

  if (sourceUrl.origin !== normalizedBaseUrl.origin) {
    throw new Error("Werkzoeken sourcePath moet op dezelfde host blijven als baseUrl");
  }

  return sourceUrl;
}

export function buildWerkzoekenListPageUrl(
  baseUrl: string,
  sourcePath: string,
  page: number,
): string {
  const url = resolveWerkzoekenSourceUrl(baseUrl, sourcePath);
  if (page > 1) {
    url.searchParams.set("pnr", String(page));
  }
  return url.toString();
}

export function parseWerkzoekenListingCards(
  html: string,
  baseUrl = DEFAULT_WERKZOEKEN_ORIGIN,
): RawScrapedListing[] {
  const listings: RawScrapedListing[] = [];
  const linkRegex = /<a\b([\s\S]*?)class="vacancy vac[\s\S]*?href="([^"]+)"[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/g;

  let match = linkRegex.exec(html);
  while (match !== null) {
    const rawAttributes = match[1];
    const externalUrl = toAbsoluteUrl(match[2], baseUrl);
    const title = stripHtml(decodeText(match[3])).replace(/\s+/g, " ").trim();
    const externalId = firstMatch(/data-vacancyid="([^"]+)"/, rawAttributes);
    const company = stripHtml(decodeText(firstMatch(/data-business="([^"]+)"/, rawAttributes)));
    const location = decodeText(firstMatch(/data-location-label="([^"]+)"/, rawAttributes));
    const contractLabel = decodeText(firstMatch(/data-contract-type="([^"]+)"/, rawAttributes));
    const educationLevel = decodeText(firstMatch(/data-education="([^"]+)"/, rawAttributes));
    const hoursLabel = decodeText(firstMatch(/data-hours="([^"]+)"/, rawAttributes));
    const ageLabel = decodeText(firstMatch(/data-age="([^"]+)"/, rawAttributes));
    const { min, max } = normalizeHours(hoursLabel);

    if (externalId) {
      listings.push({
        externalId,
        externalUrl,
        title,
        company,
        location,
        contractLabel,
        educationLevel,
        rateMin: parseSalaryValue(firstMatch(/data-salary-minimal="([^"]+)"/, rawAttributes)),
        rateMax: parseSalaryValue(firstMatch(/data-salary-maximum="([^"]+)"/, rawAttributes)),
        minHoursPerWeek: sanitizeHours(min),
        hoursPerWeek: sanitizeHours(max),
        description: `${title} bij ${company}`.trim(),
        sourceUrl: externalUrl,
        sourcePlatform: "Werkzoeken.nl",
        conditions: [hoursLabel, educationLevel, contractLabel, ageLabel].filter(Boolean),
      });
    }

    match = linkRegex.exec(html);
  }

  return listings;
}

export function parseWerkzoekenDetailPage(
  html: string,
  externalUrl: string,
): Partial<RawScrapedListing> {
  const title = stripHtml(
    decodeText(firstMatch(/<h1[^>]*>([\s\S]*?)<\/h1>/, html)) ||
      decodeText(firstMatch(/<meta property="og:title" content="([^"]+)"/, html)),
  );
  const company = decodeText(
    firstMatch(/<div class="company-name">([\s\S]*?)<\/div>/, html) ??
      firstMatch(/\|\s*([^|]+)\s*op Werkzoeken\.nl/, html),
  );
  const location = decodeText(
    firstMatch(
      /<div class="job-overview">[\s\S]*?<div>([\s\S]*?)<\/div>/,
      html,
    ),
  );
  const description = decodeText(
    firstMatch(
      /<section class="job-description">([\s\S]*?)<\/section>/,
      html,
    ),
  );

  return {
    externalUrl,
    title,
    company,
    location,
    description: ensureMinLength(description, stripHtml(title) || "Werkzoeken vacature"),
  };
}

async function fetchHtml(url: string): Promise<string> {
  const response = await fetch(url, {
    headers: {
      "User-Agent": "Mozilla/5.0 (compatible; MotianBot/1.0)",
    },
    signal: AbortSignal.timeout(WERKZOEKEN_FETCH_TIMEOUT_MS),
  });

  if (!response.ok) {
    throw new Error(`Werkzoeken fetch mislukt voor ${url}: ${response.status}`);
  }

  return response.text();
}

async function enrichWerkzoekenListings(
  listings: RawScrapedListing[],
  detailConcurrency: number,
  limit?: number,
): Promise<RawScrapedListing[]> {
  const bounded = listings.slice(0, limit ?? listings.length);
  const results: RawScrapedListing[] = [];

  for (let index = 0; index < bounded.length; index += detailConcurrency) {
    const batch = bounded.slice(index, index + detailConcurrency);
    const enriched = await Promise.all(
      batch.map(async (listing) => {
        const externalUrl = String(listing.externalUrl ?? "");
        try {
          const detailHtml = await fetchHtml(externalUrl);
          return {
            ...listing,
            ...parseWerkzoekenDetailPage(detailHtml, externalUrl),
          };
        } catch {
          return listing;
        }
      }),
    );
    results.push(...enriched);
  }

  return results;
}

async function scrapeWerkzoekenInternal(
  config: PlatformRuntimeConfig,
  options?: { limit?: number; smoke?: boolean },
): Promise<PlatformScrapeResult> {
  const sourcePath = String(config.parameters.sourcePath ?? "/vacatures-voor/techniek/");
  const maxPages = parsePositiveInteger(config.parameters.maxPages, 3);
  const pnrStep = parsePositiveInteger(config.parameters.pnrStep, 10);
  const detailConcurrency = parsePositiveInteger(config.parameters.detailConcurrency, 4);
  const skipDetail = Boolean(config.parameters.skipDetailEnrichment);

  // pnr= returns cumulative results (pnr=10 -> 500 results).
  // We use sliding window (fetch pnr=10, 20, 30...) to minimize redundant bandwidth.
  const seenIds = new Set<string>();
  const listings: RawScrapedListing[] = [];

  for (let page = pnrStep; page <= maxPages + pnrStep - 1; page += pnrStep) {
    const url = buildWerkzoekenListPageUrl(config.baseUrl, sourcePath, page);
    const html = await fetchHtml(url);
    const parsed = parseWerkzoekenListingCards(html, config.baseUrl);

    // Filter out listings already seen from previous cumulative pages
    const newListings = parsed.filter((l) => {
      const id = String(l.externalId ?? "");
      if (!id || seenIds.has(id)) return false;
      seenIds.add(id);
      return true;
    });

    if (newListings.length === 0) {
      if (page > pnrStep) {
        break;
      }

      return {
        listings,
        errors: ["Geen Werkzoeken vacaturekaarten gevonden op de resultatenpagina"],
        blockerKind: "unexpected_markup",
        evidence: {
          pageUrl: url,
        },
      };
    }

    listings.push(...newListings);
    if (options?.smoke || (options?.limit && listings.length >= options.limit)) {
      break;
    }
  }

  // Skip detail enrichment for bulk scrapes (listing cards already have title, company, salary, etc.)
  if (skipDetail) {
    return {
      listings,
      evidence: {
        sourcePath,
        fetchedListings: listings.length,
        detailEnrichment: "skipped",
      },
    };
  }

  const enriched = await enrichWerkzoekenListings(
    listings,
    detailConcurrency,
    options?.limit ?? (options?.smoke ? 3 : undefined),
  );

  return {
    listings: enriched,
    evidence: {
      sourcePath,
      fetchedListings: enriched.length,
    },
  };
}

export const werkzoekenAdapter: PlatformAdapter = {
  async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
    const sourcePath = String(config.parameters.sourcePath ?? "/vacatures-voor/techniek/");
    const url = buildWerkzoekenListPageUrl(config.baseUrl, sourcePath, 1);
    const html = await fetchHtml(url);
    const listings = parseWerkzoekenListingCards(html, config.baseUrl);

    if (listings.length === 0) {
      return {
        ok: false,
        status: "failed",
        blockerKind: "unexpected_markup",
        message: "Geen Werkzoeken vacaturekaarten gevonden op de opgegeven resultatenpagina.",
        evidence: {
          pageUrl: url,
        },
      };
    }

    return {
      ok: true,
      status: "validated",
      message: `Werkzoeken validatie succesvol: ${listings.length} vacaturekaarten gevonden.`,
      evidence: {
        pageUrl: url,
        detectedListings: listings.length,
      },
    };
  },

  async scrape(
    config: PlatformRuntimeConfig,
    options?: { limit?: number; smoke?: boolean },
  ): Promise<PlatformScrapeResult> {
    return scrapeWerkzoekenInternal(config, options);
  },

  async testImport(
    config: PlatformRuntimeConfig,
    options?: { limit?: number },
  ): Promise<PlatformTestImportResult> {
    const result = await scrapeWerkzoekenInternal(config, {
      limit: options?.limit ?? 3,
      smoke: true,
    });

    return {
      status:
        result.errors && result.errors.length > 0 && result.listings.length === 0
          ? "failed"
          : result.errors && result.errors.length > 0
            ? "partial"
            : "success",
      jobsFound: result.listings.length,
      listings: result.listings,
      errors: result.errors,
      blockerKind: result.blockerKind,
      evidence: result.evidence,
    };
  },
};
