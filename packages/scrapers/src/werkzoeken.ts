import type {
  PlatformAdapter,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
  RawScrapedListing,
} from "./types";
import { stripHtml } from "./strip-html";

const WERKZOEKEN_FETCH_TIMEOUT_MS = 20_000;

function decodeText(value: string | undefined): string {
  return stripHtml(
    value
      ?.replace(/&euro;/gi, "EUR")
      .replace(/&nbsp;/gi, " ")
      .replace(/&amp;/g, "&"),
  ).replace(/\s+/g, " ");
}

function firstMatch(html: string, pattern: RegExp): string | undefined {
  return pattern.exec(html)?.[1];
}

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

function toAbsoluteUrl(url: string): string {
  return url.startsWith("http") ? url : `https://www.werkzoeken.nl${url}`;
}

export function buildWerkzoekenListPageUrl(
  baseUrl: string,
  sourcePath: string,
  page: number,
): string {
  const url = new URL(sourcePath, baseUrl);
  if (page > 1) {
    url.searchParams.set("pagina", String(page));
  }
  return url.toString();
}

export function parseWerkzoekenListingCards(html: string): RawScrapedListing[] {
  const listings: RawScrapedListing[] = [];
  const linkRegex = /<a\b([\s\S]*?)class="vacancy vac[\s\S]*?href="([^"]+)"[\s\S]*?<h3>([\s\S]*?)<\/h3>[\s\S]*?<\/a>/g;

  let match = linkRegex.exec(html);
  while (match !== null) {
    const rawAttributes = match[1];
    const externalUrl = toAbsoluteUrl(match[2]);
    const title = decodeText(match[3]);
    const externalId = firstMatch(rawAttributes, /data-vacancyid="([^"]+)"/);
    const company = decodeText(firstMatch(rawAttributes, /data-business="([^"]+)"/));
    const location = decodeText(firstMatch(rawAttributes, /data-location-label="([^"]+)"/));
    const contractLabel = decodeText(firstMatch(rawAttributes, /data-contract-type="([^"]+)"/));
    const educationLevel = decodeText(firstMatch(rawAttributes, /data-education="([^"]+)"/));
    const hoursLabel = decodeText(firstMatch(rawAttributes, /data-hours="([^"]+)"/));
    const ageLabel = decodeText(firstMatch(rawAttributes, /data-age="([^"]+)"/));
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
        rateMin: parseSalaryValue(firstMatch(rawAttributes, /data-salary-minimal="([^"]+)"/)),
        rateMax: parseSalaryValue(firstMatch(rawAttributes, /data-salary-maximum="([^"]+)"/)),
        minHoursPerWeek: min,
        hoursPerWeek: max,
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
  const title =
    decodeText(firstMatch(html, /<h1[^>]*>([\s\S]*?)<\/h1>/)) ||
    decodeText(firstMatch(html, /<meta property="og:title" content="([^"]+)"/));
  const company = decodeText(
    firstMatch(html, /<div class="company-name">([\s\S]*?)<\/div>/) ??
      firstMatch(html, /\|\s*([^|]+)\s*op Werkzoeken\.nl/),
  );
  const location = decodeText(
    firstMatch(
      html,
      /<div class="job-overview">[\s\S]*?<div>([\s\S]*?)<\/div>/,
    ),
  );
  const description = decodeText(
    firstMatch(
      html,
      /<section class="job-description">([\s\S]*?)<\/section>/,
    ),
  );

  return {
    externalUrl,
    title,
    company,
    location,
    description:
      description.length >= 10 ? description : `${title || "Werkzoeken vacature"} via Werkzoeken.nl`,
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
  const maxPages = Math.max(1, Number(config.parameters.maxPages ?? 3));
  const detailConcurrency = Math.max(1, Number(config.parameters.detailConcurrency ?? 4));
  const listings: RawScrapedListing[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const url = buildWerkzoekenListPageUrl(config.baseUrl, sourcePath, page);
    const html = await fetchHtml(url);
    const parsed = parseWerkzoekenListingCards(html);
    if (parsed.length === 0) {
      if (page > 1) {
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

    listings.push(...parsed);
    if (options?.smoke || (options?.limit && listings.length >= options.limit)) {
      break;
    }
  }

  const unique = [...new Map(listings.map((listing) => [listing.externalId, listing])).values()];
  const enriched = await enrichWerkzoekenListings(
    unique,
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
    const listings = parseWerkzoekenListingCards(html);

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
