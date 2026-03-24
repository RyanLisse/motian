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
const DEFAULT_REQUEST_HEADERS = {
  Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8",
  "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
  "Cache-Control": "no-cache",
  Pragma: "no-cache",
  "Sec-Fetch-Dest": "document",
  "Sec-Fetch-Mode": "navigate",
  "Sec-Fetch-Site": "same-origin",
  "Upgrade-Insecure-Requests": "1",
  "Accept-Encoding": "gzip, deflate, br",
  "User-Agent":
    "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/131.0.0.0 Safari/537.36",
};
const RETRYABLE_FETCH_STATUSES = new Set([403, 429]);
const FETCH_RETRY_ATTEMPTS = 4;
const FETCH_RETRY_DELAY_MS = 2000;
const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

type WerkzoekenSession = {
  cookieHeader?: string;
  referer: string;
};

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

function extractWerkzoekenCookieHeader(response: Response): string | undefined {
  const headers = response.headers as Headers & { getSetCookie?: () => string[] };
  const setCookies =
    headers.getSetCookie?.() ??
    (response.headers.get("set-cookie") ? [response.headers.get("set-cookie") as string] : []);

  const cookies = setCookies
    .map((value) => value.split(";", 1)[0]?.trim())
    .filter((value): value is string => Boolean(value));

  return cookies.length > 0 ? cookies.join("; ") : undefined;
}

async function fetchWerkzoekenResponse(
  url: string,
  options?: Partial<WerkzoekenSession>,
): Promise<Response> {
  const headers = new Headers(DEFAULT_REQUEST_HEADERS);
  headers.set("Referer", options?.referer ?? DEFAULT_WERKZOEKEN_ORIGIN);

  if (options?.cookieHeader) {
    headers.set("Cookie", options.cookieHeader);
  }

  return fetch(url, {
    headers,
    signal: AbortSignal.timeout(WERKZOEKEN_FETCH_TIMEOUT_MS),
  });
}

async function bootstrapWerkzoekenSession(
  baseUrl: string,
  sourcePath: string,
): Promise<WerkzoekenSession> {
  const sourceUrl = resolveWerkzoekenSourceUrl(baseUrl, sourcePath);
  const response = await fetchWerkzoekenResponse(sourceUrl.toString());

  if (response.ok) {
    return {
      cookieHeader: extractWerkzoekenCookieHeader(response),
      referer: sourceUrl.toString(),
    };
  }

  // If bootstrap gets 403, fall back to Firecrawl — session cookies won't be available
  // but pagination will still work via Firecrawl proxy for subsequent pages
  if (RETRYABLE_FETCH_STATUSES.has(response.status) && process.env.FIRECRAWL_API_KEY) {
    return { referer: sourceUrl.toString() };
  }

  throw new Error(`Werkzoeken session bootstrap mislukt voor ${sourceUrl}: ${response.status}`);
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
  const company = stripHtml(
    decodeText(
      firstMatch(/<div class="company-name">([\s\S]*?)<\/div>/, html) ??
        firstMatch(/\|\s*([^|]+)\s*op Werkzoeken\.nl/, html),
    ),
  );
  const location = stripHtml(
    decodeText(
      firstMatch(
        /<div class="job-overview">[\s\S]*?<div>([\s\S]*?)<\/div>/,
        html,
      ),
    ),
  );
  const rawDescription = stripHtml(
    decodeText(
      firstMatch(
        /<section class="job-description">([\s\S]*?)<\/section>/,
        html,
      ),
    ),
  );

  return {
    externalUrl,
    title: title?.slice(0, 500),
    company: company?.slice(0, 300),
    location,
    description: ensureMinLength(rawDescription?.slice(0, 8000), stripHtml(title) || "Werkzoeken vacature"),
  };
}

async function fetchViaBrowserbase(url: string): Promise<string> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) {
    throw new Error("BROWSERBASE_API_KEY/PROJECT_ID niet geconfigureerd");
  }

  // Dynamic import to avoid bundling puppeteer-core when not used
  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.connect({
    browserWSEndpoint: `wss://connect.browserbase.com?apiKey=${apiKey}&projectId=${projectId}`,
  });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });

    // Werkzoeken uses Cloudflare protection ("Just a moment...").
    // Wait for the challenge to resolve by polling for vacancy content.
    const maxWaitMs = 20_000;
    const pollIntervalMs = 2_000;
    const startTime = Date.now();

    while (Date.now() - startTime < maxWaitMs) {
      const title = await page.title();
      if (!title.includes("Just a moment") && !title.includes("Checking")) {
        // Cloudflare challenge resolved — wait briefly for DOM to hydrate
        await new Promise((resolve) => setTimeout(resolve, 2_000));
        break;
      }
      await new Promise((resolve) => setTimeout(resolve, pollIntervalMs));
    }

    return await page.content();
  } finally {
    await browser.close();
  }
}

async function fetchViaFirecrawl(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY niet geconfigureerd — kan niet terugvallen op Firecrawl");
  }

  const response = await fetch(FIRECRAWL_API_URL, {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ url, formats: ["html"], waitFor: 2000 }),
    signal: AbortSignal.timeout(30_000),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl fallback mislukt voor ${url}: ${response.status}`);
  }

  const body = (await response.json()) as { success?: boolean; data?: { html?: string } };
  if (!body.success || !body.data?.html) {
    throw new Error(`Firecrawl retourneerde geen HTML voor ${url}`);
  }

  return body.data.html;
}

async function fetchHtml(url: string, session?: Partial<WerkzoekenSession>): Promise<string> {
  // If Firecrawl is available, try direct fetch once then fallback immediately
  // (avoids wasting 8s on retries that will fail on cloud IPs)
  const maxAttempts = process.env.FIRECRAWL_API_KEY ? 1 : FETCH_RETRY_ATTEMPTS;
  let lastStatus = 0;

  for (let attempt = 1; attempt <= maxAttempts; attempt += 1) {
    const response = await fetchWerkzoekenResponse(url, session);

    if (response.ok) {
      return response.text();
    }

    lastStatus = response.status;
    const shouldRetry =
      RETRYABLE_FETCH_STATUSES.has(response.status) && attempt < maxAttempts;
    if (!shouldRetry) {
      break;
    }

    await new Promise((resolve) => setTimeout(resolve, FETCH_RETRY_DELAY_MS * attempt));
  }

  // Fallback chain: Browserbase (real Chrome, residential IP) → Firecrawl (JS rendering proxy)
  if (RETRYABLE_FETCH_STATUSES.has(lastStatus)) {
    if (process.env.BROWSERBASE_API_KEY) {
      return fetchViaBrowserbase(url);
    }
    if (process.env.FIRECRAWL_API_KEY) {
      return fetchViaFirecrawl(url);
    }
  }

  throw new Error(`Werkzoeken fetch mislukt voor ${url}: ${lastStatus}`);
}

async function enrichWerkzoekenListings(
  listings: RawScrapedListing[],
  detailConcurrency: number,
  session?: Partial<WerkzoekenSession>,
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
          const detailHtml = await fetchHtml(externalUrl, session);
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
  const session = await bootstrapWerkzoekenSession(config.baseUrl, sourcePath);

  // pnr= returns cumulative results (pnr=10 -> 500 results).
  // We use sliding window (fetch pnr=10, 20, 30...) to minimize redundant bandwidth.
  const seenIds = new Set<string>();
  const listings: RawScrapedListing[] = [];

  for (let page = pnrStep; page <= maxPages + pnrStep - 1; page += pnrStep) {
    const url = buildWerkzoekenListPageUrl(config.baseUrl, sourcePath, page);
    const html = await fetchHtml(url, session);
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

      // Content-validation fallback: the site may return HTTP 200 with a captcha/cookie-wall
      // instead of vacancy cards. Retry via Browserbase (real Chrome) before giving up.
      if (process.env.BROWSERBASE_API_KEY) {
        try {
          const browserbaseHtml = await fetchViaBrowserbase(url);
          const retryParsed = parseWerkzoekenListingCards(browserbaseHtml, config.baseUrl);
          const retryNew = retryParsed.filter((l) => {
            const id = String(l.externalId ?? "");
            if (!id || seenIds.has(id)) return false;
            seenIds.add(id);
            return true;
          });
          if (retryNew.length > 0) {
            // Browserbase succeeded — switch to Browserbase for remaining pages
            listings.push(...retryNew);
            session.cookieHeader = undefined; // Clear direct-fetch session
            // Continue the loop with Browserbase-fetched pages
            for (
              let bbPage = page + pnrStep;
              bbPage <= maxPages + pnrStep - 1;
              bbPage += pnrStep
            ) {
              const bbUrl = buildWerkzoekenListPageUrl(config.baseUrl, sourcePath, bbPage);
              const bbHtml = await fetchViaBrowserbase(bbUrl);
              const bbParsed = parseWerkzoekenListingCards(bbHtml, config.baseUrl);
              const bbNew = bbParsed.filter((l) => {
                const id = String(l.externalId ?? "");
                if (!id || seenIds.has(id)) return false;
                seenIds.add(id);
                return true;
              });
              if (bbNew.length === 0) break;
              listings.push(...bbNew);
              if (options?.smoke || (options?.limit && listings.length >= options.limit)) break;
              await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
            }
            break; // Exit the main loop — we've handled remaining pages via Browserbase
          }
        } catch {
          // Browserbase also failed — fall through to error
        }
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

    // Throttle between pages to avoid rate limiting
    if (page + pnrStep <= maxPages + pnrStep - 1) {
      await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 2000));
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
    session,
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
    const session = await bootstrapWerkzoekenSession(config.baseUrl, sourcePath);
    const html = await fetchHtml(url, session);
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
