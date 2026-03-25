import type {
  PlatformAdapter,
  PlatformBlockerKind,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
  RawScrapedListing,
} from "./types";
import {
  decodeText,
  firstMatch,
  toAbsoluteUrl,
  sanitizeHours,
  parsePositiveInteger,
  readString,
} from "./lib/utils";

export type NationaleVacaturebankBlockerDetection = {
  blockerKind: PlatformBlockerKind | null;
  matchedSignals: string[];
};

type UrlFetchResult = {
  url: string;
  html: string;
  status: number;
};

type BrowserBootstrapSession = {
  cookieHeader?: string;
  evidence?: Record<string, unknown>;
};

type SessionBootstrapResult = {
  cookieHeader?: string;
  evidence?: Record<string, unknown>;
  firstResponse: UrlFetchResult;
};

const NVB_ORIGIN = "https://www.nationalevacaturebank.nl";
const NVB_FETCH_TIMEOUT_MS = 20_000;
const NVB_DEFAULT_USER_AGENT = "Mozilla/5.0 (compatible; MotianBot/1.0)";

const NVB_PROVINCES = [
  "drenthe",
  "flevoland",
  "friesland",
  "gelderland",
  "groningen",
  "limburg",
  "noord-brabant",
  "noord-holland",
  "overijssel",
  "utrecht",
  "zeeland",
  "zuid-holland",
] as const;

type NextDataParseResult = {
  listings: RawScrapedListing[];
  totalPages: number;
};

/**
 * Extract structured job data from Next.js __NEXT_DATA__ JSON blob.
 * Returns listings + total page count. Falls back to empty if not found.
 */
export function parseNextDataJobs(html: string): NextDataParseResult | null {
  const match = html.match(/<script id="__NEXT_DATA__" type="application\/json">([\s\S]*?)<\/script>/);
  if (!match) return null;

  let data: any;
  try {
    data = JSON.parse(match[1]);
  } catch {
    return null;
  }

  const pageProps = data?.props?.pageProps;
  if (!pageProps) return null;

  const matchedJobs: any[] = pageProps?.jobs?.matchedJobs ?? pageProps?.matchedJobs ?? [];
  // pages lives at pageProps.pages (top-level, not nested under jobs)
  const totalPages: number = pageProps?.pages ?? 1;

  if (matchedJobs.length === 0) return null;

  const listings: RawScrapedListing[] = matchedJobs.map((job: any) => {
    const salary = job.salary ?? {};
    const company = typeof job.company === "object" ? job.company : { name: job.company };
    const workLocation = job.workLocation ?? {};

    // workLocation.displayName is the primary city field
    const locationStr =
      typeof workLocation === "string"
        ? workLocation
        : workLocation.displayName || undefined;

    // workingHours is {min, max} object
    const hoursRaw = job.workingHours;
    let hoursPerWeek: number | undefined;
    let minHoursPerWeek: number | undefined;
    if (hoursRaw && typeof hoursRaw === "object") {
      if (typeof hoursRaw.max === "number") hoursPerWeek = sanitizeHours(hoursRaw.max);
      if (typeof hoursRaw.min === "number") minHoursPerWeek = sanitizeHours(hoursRaw.min);
    } else if (typeof hoursRaw === "number") {
      hoursPerWeek = sanitizeHours(hoursRaw);
    }

    // url is already a path like /vacature/{uuid}/slug
    const jobUrl = job.url;
    const externalUrl = jobUrl
      ? toAbsoluteUrl(jobUrl, NVB_ORIGIN)
      : undefined;

    return compactListingFields({
      externalId: String(job.id ?? ""),
      title: decodeText(job.title),
      company: decodeText(company?.name),
      location: decodeText(locationStr),
      description: ensureDescription(job.fullDescription, job.title ?? ""),
      rateMin: typeof salary.min === "number" ? salary.min : undefined,
      rateMax: typeof salary.max === "number" ? salary.max : undefined,
      hoursPerWeek,
      minHoursPerWeek,
      educationLevel: typeof job.educationLevel === "string" ? job.educationLevel : undefined,
      externalUrl,
      sourceUrl: externalUrl,
      requirements: Array.isArray(job.requirements)
        ? job.requirements
        : typeof job.requirements === "string" && job.requirements.length > 0
          ? [job.requirements]
          : undefined,
      contractType: mapContractType(String(job.contractType ?? "")),
      // functionGroups is already string[]
      categories: Array.isArray(job.functionGroups) ? job.functionGroups : undefined,
      companyLogoUrl: job.logo ?? company?.logo,
    });
  });

  return { listings, totalPages };
}

function isNationaleVacaturebankHost(hostname: string): boolean {
  const normalized = hostname.toLowerCase();
  return (
    normalized === "nationalevacaturebank.nl" ||
    normalized === "www.nationalevacaturebank.nl" ||
    normalized.endsWith(".nationalevacaturebank.nl")
  );
}

function assertNationaleVacaturebankHost(url: URL): void {
  if (!isNationaleVacaturebankHost(url.hostname)) {
    throw new Error(
      `Nationale Vacaturebank bron-URL moet naar nationalevacaturebank.nl verwijzen, niet naar "${url.hostname}".`,
    );
  }
}

function parseNumberRange(value: string): { rateMin?: number; rateMax?: number } {
  const normalized = decodeText(value).replace(/[^\d,\-.]/g, " ");
  const matches = normalized.match(/\d[\d.]*/g) ?? [];
  const parsed = matches
    .map((part) => Number.parseInt(part.replace(/\./g, ""), 10))
    .filter((part) => Number.isFinite(part) && part > 0);

  if (parsed.length === 0) return {};
  if (parsed.length === 1) return { rateMax: parsed[0] };
  return {
    rateMin: parsed[0],
    rateMax: parsed[1],
  };
}

function ensureDescription(value: string | undefined, title: string): string | undefined {
  const description = decodeText(value);
  if (description.length >= 10) return description;
  return title.length > 0 ? `${title} via Nationale Vacaturebank` : undefined;
}

function compactListingFields(
  detail: Partial<RawScrapedListing>,
): Partial<RawScrapedListing> {
  return Object.fromEntries(
    Object.entries(detail).filter(([, value]) => {
      if (value === undefined || value === null) {
        return false;
      }

      if (typeof value === "string") {
        return value.trim().length > 0;
      }

      return true;
    }),
  );
}

export function detectNationaleVacaturebankBlocker(
  input: UrlFetchResult,
): NationaleVacaturebankBlockerDetection {
  const matchedSignals: string[] = [];
  const url = new URL(input.url);
  const html = input.html.toLowerCase();

  if (url.host === "myprivacy.dpgmedia.nl") {
    matchedSignals.push("host:myprivacy.dpgmedia.nl");
  }

  if (url.pathname.includes("consent")) {
    matchedSignals.push("path:/consent");
  }

  if (html.includes("dpg media privacy gate")) {
    matchedSignals.push("marker:dpg_media_privacy_gate");
  }

  if (html.includes("privacygate-confirm")) {
    matchedSignals.push("marker:privacygate_confirm");
  }

  if (
    matchedSignals.some((signal) =>
      [
        "host:myprivacy.dpgmedia.nl",
        "marker:dpg_media_privacy_gate",
        "marker:privacygate_confirm",
      ].includes(signal),
    )
  ) {
    return {
      blockerKind: "consent_required",
      matchedSignals,
    };
  }

  return {
    blockerKind: null,
    matchedSignals,
  };
}

export function buildNationaleVacaturebankPageUrl(
  baseUrl: string,
  sourcePath: string,
  page: number,
): string {
  const url = new URL(sourcePath, baseUrl);
  assertNationaleVacaturebankHost(url);
  if (page > 1) {
    url.searchParams.set("page", String(page));
  }
  return url.toString();
}

export function parseNationaleVacaturebankListings(html: string): RawScrapedListing[] {
  const listings: RawScrapedListing[] = [];
  const cardRegex = /<li>\s*<a\b([^>]*)>([\s\S]*?)<\/a>\s*<\/li>/g;

  let match = cardRegex.exec(html);
  while (match !== null) {
    const attributes = match[1];
    const body = match[2];

    if (!attributes.includes('class="nvb_searchResult__')) {
      match = cardRegex.exec(html);
      continue;
    }

    const href = firstMatch(/href="([^"]+)"/, attributes);
    const externalId = firstMatch(/data-analytics-label="([^"]+)"/, attributes);

    if (!href || !externalId) {
      match = cardRegex.exec(html);
      continue;
    }

    const rawTitle = firstMatch(/<h2>([\s\S]*?)<\/h2>/, body);
    const rawCompany = firstMatch(/<strong class="nvb_companyName__[^"]*">([\s\S]*?)<\/strong>/, body);
    const rawLocation = firstMatch(/<strong class="nvb_companyName__[^"]*">[\s\S]*?<\/strong>\s*<span>([\s\S]*?)<\/span>/, body);
    const rawAttributes =
      firstMatch(/<div class="nvb_attributes__IP60d">([\s\S]*?)<\/div>/, body) ?? "";
    const attributeMatches = [
      ...rawAttributes.matchAll(/<div class="nvb_attribute__[^"]*">([\s\S]*?)<\/div>/g),
    ].map((attribute) => decodeText(attribute[1]));
    const rateAttribute = attributeMatches.find(
      (attribute) => attribute.includes("EUR") || attribute.includes("€"),
    );
    const { rateMin, rateMax } = rateAttribute ? parseNumberRange(rateAttribute) : {};

    listings.push({
      externalId,
      externalUrl: toAbsoluteUrl(href, NVB_ORIGIN),
      title: decodeText(rawTitle),
      company: decodeText(rawCompany),
      location: decodeText(rawLocation),
      rateMin,
      rateMax,
      hoursPerWeek: extractHourMax(attributeMatches),
      minHoursPerWeek: extractHourMin(attributeMatches),
      educationLevel: attributeMatches.find((attribute) =>
        ["MBO", "HBO", "WO", "VMBO", "HAVO"].some((level) => attribute.includes(level)),
      ),
      companyLogoUrl: firstMatch(
        /<img class="" src="([^"]+)" alt="[^"]*">/,
        match[0],
      ) ?? "",
      sourceUrl: toAbsoluteUrl(href, NVB_ORIGIN),
      categories: extractCategoriesFromPage(html),
    });
    match = cardRegex.exec(html);
  }

  return listings;
}

function extractHourMin(attributes: string[]): number | undefined {
  for (const attribute of attributes) {
    const hours = attribute.match(/(\d+)\s*-\s*(\d+)\s*uur/i);
    if (hours) return sanitizeHours(Number.parseInt(hours[1], 10));
  }
  return undefined;
}

function extractHourMax(attributes: string[]): number | undefined {
  for (const attribute of attributes) {
    const hours = attribute.match(/(\d+)\s*-\s*(\d+)\s*uur/i);
    if (hours) return sanitizeHours(Number.parseInt(hours[2], 10));
    const single = attribute.match(/(\d+)\s*uur/i);
    if (single) return sanitizeHours(Number.parseInt(single[1], 10));
  }
  return undefined;
}

function extractCategoriesFromPage(html: string): string[] {
  return [...html.matchAll(/href="\/vacatures\/branche\/[^"]+"[^>]*>([^<]+)<\/a>/g)]
    .map((match) => decodeText(match[1]))
    .filter(Boolean)
    .slice(0, 3);
}

export function parseNationaleVacaturebankDetailPage(html: string): Partial<RawScrapedListing> {
  const title = decodeText(
    firstMatch(/<div class="nvb_info__0vhLJ">\s*<h2>([\s\S]*?)<\/h2>/, html),
  );
  const company = decodeText(
    firstMatch(/<div class="nvb_company__[^"]*">\s*<a [^>]*>([\s\S]*?)<\/a>/, html),
  );
  const location = decodeText(
    firstMatch(
      /<div class="nvb_company__[^"]*">\s*<a [^>]*>[\s\S]*?<\/a>\s*<a [^>]*>([\s\S]*?)<\/a>/,
      html,
    ),
  );
  const descriptionHtml = firstMatch(
    /<h3 class="nvb_subHeading__[^"]*">Functieomschrijving<\/h3>[\s\S]*?<div class="nvb_text__[^"]*">([\s\S]*?)<\/div>/,
    html,
  );

  return {
    title,
    company,
    location,
    description: ensureDescription(descriptionHtml, title),
    contractType: mapContractType(
      decodeText(
        firstMatch(
          /<span>dienstverband<\/span><strong>([\s\S]*?)<\/strong>/,
          html,
        ),
      ),
    ),
    educationLevel: decodeText(
      firstMatch(
        /<span>opleidingsniveau<\/span><strong>([\s\S]*?)<\/strong>/,
        html,
      ),
    ),
  };
}

function mapContractType(value: string): "freelance" | "interim" | "vast" | "opdracht" | undefined {
  const normalized = value.toLowerCase();
  if (normalized.includes("zzp") || normalized.includes("freelance")) return "freelance";
  if (normalized.includes("interim")) return "interim";
  if (normalized.includes("vast")) return "vast";
  if (normalized.includes("tijdelijk")) return "opdracht";
  return undefined;
}

async function fetchHtml(url: string, init?: RequestInit): Promise<UrlFetchResult> {
  const requestHeaders = new Headers(init?.headers);

  if (!requestHeaders.has("User-Agent")) {
    requestHeaders.set("User-Agent", NVB_DEFAULT_USER_AGENT);
  }

  const response = await fetch(url, {
    ...init,
    headers: requestHeaders,
    redirect: init?.redirect ?? "follow",
    signal: init?.signal ?? AbortSignal.timeout(NVB_FETCH_TIMEOUT_MS),
  });

  return {
    url: response.url || url,
    html: await response.text(),
    status: response.status,
  };
}

function buildCookieHeader(
  cookies: Array<{ name: string; value: string }>,
): string | undefined {
  if (cookies.length === 0) {
    return undefined;
  }

  return cookies.map((cookie) => `${cookie.name}=${cookie.value}`).join("; ");
}

async function bootstrapConsentSession(
  config: PlatformRuntimeConfig,
  pageUrl: string,
): Promise<BrowserBootstrapSession> {
  if (config.parameters.useBrowserBootstrap === false) {
    return {
      evidence: {
        mode: "browser_bootstrap_disabled",
        pageUrl,
      },
    };
  }

  let browser: any;

  try {
    const { chromium } = await import("playwright");
    browser = await chromium.launch({ headless: true });
    const context = await browser.newContext({
      userAgent: NVB_DEFAULT_USER_AGENT,
    });
    const page = await context.newPage();
    const actions: string[] = [];

    await page.goto(pageUrl, {
      waitUntil: "domcontentloaded",
      timeout: 45_000,
    });

    const initialHtml = await page.content();
    const initialBlocker = detectNationaleVacaturebankBlocker({
      url: page.url(),
      html: initialHtml,
      status: 200,
    });

    if (initialBlocker.blockerKind === "consent_required") {
      const instellingenButton = page.getByRole("button", { name: /instellen/i }).first();
      await instellingenButton.waitFor({ state: "visible", timeout: 10_000 });
      await instellingenButton.click();
      actions.push("instellen");

      const saveButton = page
        .getByRole("button", { name: /voorkeuren opslaan/i })
        .first();
      await saveButton.waitFor({ state: "visible", timeout: 10_000 });
      await saveButton.click();
      actions.push("voorkeuren_opslaan");

      await page.waitForURL((url: URL) => isNationaleVacaturebankHost(url.hostname), {
        timeout: 30_000,
      });
      await page.waitForLoadState("domcontentloaded");
    }

    const finalHtml = await page.content();
    const cookies = await context.cookies(pageUrl);
    const blocker = detectNationaleVacaturebankBlocker({
      url: page.url(),
      html: finalHtml,
      status: 200,
    });

    return {
      cookieHeader: buildCookieHeader(cookies),
      evidence: {
        mode: "playwright_local",
        pageUrl,
        finalUrl: page.url(),
        actions,
        cookieCount: cookies.length,
        blockerKind: blocker.blockerKind,
      },
    };
  } catch (error) {
    return {
      evidence: {
        mode: "playwright_local",
        pageUrl,
        error: error instanceof Error ? error.message : String(error),
      },
    };
  } finally {
    await browser?.close().catch(() => undefined);
  }
}

async function initializeConsentAwareSession(
  config: PlatformRuntimeConfig,
  pageUrl: string,
): Promise<SessionBootstrapResult> {
  const initial = await fetchHtml(pageUrl);
  const blocker = detectNationaleVacaturebankBlocker(initial);

  if (blocker.blockerKind !== "consent_required") {
    return {
      firstResponse: initial,
    };
  }

  const session = await bootstrapConsentSession(config, pageUrl);
  if (!session.cookieHeader) {
    return {
      firstResponse: initial,
      evidence: session.evidence,
    };
  }

  const firstResponse = await fetchHtml(pageUrl, {
    headers: {
      Cookie: session.cookieHeader,
    },
  });

  return {
    cookieHeader: session.cookieHeader,
    evidence: session.evidence,
    firstResponse,
  };
}

async function fetchPageWithSession(
  url: string,
  cookieHeader?: string,
): Promise<UrlFetchResult> {
  if (!cookieHeader) {
    return fetchHtml(url);
  }

  return fetchHtml(url, {
    headers: {
      Cookie: cookieHeader,
    },
  });
}

async function enrichNationaleVacaturebankListings(
  listings: RawScrapedListing[],
  config: PlatformRuntimeConfig,
  cookieHeader: string | undefined,
  detailLimit: number,
): Promise<{ listings: RawScrapedListing[]; errors: string[] }> {
  const errors: string[] = [];
  const results: RawScrapedListing[] = [];
  const detailConcurrency = parsePositiveInteger(config.parameters.detailConcurrency, 3);

  for (let index = 0; index < listings.length; index += detailConcurrency) {
    const batch = listings.slice(index, index + detailConcurrency);
    const enrichedBatch = await Promise.all(
      batch.map(async (listing, batchIndex) => {
        const globalIndex = index + batchIndex;
        if (globalIndex >= detailLimit) {
          return listing;
        }

        const externalUrl = String(listing.externalUrl ?? "");
        if (!externalUrl) {
          return listing;
        }

        try {
          const response = await fetchPageWithSession(externalUrl, cookieHeader);
          const blocker = detectNationaleVacaturebankBlocker(response);

          if (blocker.blockerKind) {
            errors.push(
              `NVB detailpagina geblokkeerd voor ${externalUrl}: ${blocker.blockerKind}`,
            );
            return listing;
          }

          return {
            ...listing,
            ...compactListingFields(parseNationaleVacaturebankDetailPage(response.html)),
          };
        } catch (error) {
          errors.push(
            `NVB detail fetch mislukt voor ${externalUrl}: ${
              error instanceof Error ? error.message : String(error)
            }`,
          );
          return listing;
        }
      }),
    );

    results.push(...enrichedBatch);
  }

  return { listings: results, errors };
}

/** Default vakgebied paths to scrape when sourcePaths is not configured */
const DEFAULT_SOURCE_PATHS = [
  "/vacatures/vakgebied/automatisering-internet",
  "/vacatures/vakgebied/techniek",
  "/vacatures/vakgebied/financieel",
  "/vacatures/vakgebied/bestuur-beleid",
  "/vacatures/vakgebied/juridisch",
  "/vacatures/vakgebied/consultancy",
  "/vacatures/vakgebied/management",
];

/**
 * Scrape a single URL path for up to maxPages, using __NEXT_DATA__ extraction
 * with fallback to HTML parsing. Returns de-duplicated listings.
 */
async function scrapePath(
  basePath: string,
  config: PlatformRuntimeConfig,
  maxPages: number,
  cookieHeader: string | undefined,
  useNextData: boolean,
  firstResponse?: UrlFetchResult,
): Promise<{ listings: RawScrapedListing[]; errors: string[] }> {
  const listings: RawScrapedListing[] = [];
  const errors: string[] = [];

  for (let page = 1; page <= maxPages; page += 1) {
    const pageUrl = buildNationaleVacaturebankPageUrl(config.baseUrl, basePath, page);
    const response =
      page === 1 && firstResponse
        ? firstResponse
        : await fetchPageWithSession(pageUrl, cookieHeader);
    const blocker = detectNationaleVacaturebankBlocker(response);

    if (blocker.blockerKind) {
      errors.push(`NVB consent gate blokkeert ${basePath} pagina ${page}`);
      break;
    }

    let parsed: RawScrapedListing[] = [];
    if (useNextData) {
      const nextData = parseNextDataJobs(response.html);
      if (nextData) {
        parsed = nextData.listings;
        // Use actual page count from __NEXT_DATA__ to cap pagination
        if (page >= nextData.totalPages) {
          listings.push(...parsed);
          break;
        }
      }
    }

    // Fallback to HTML parsing if __NEXT_DATA__ yielded nothing
    if (parsed.length === 0) {
      parsed = parseNationaleVacaturebankListings(response.html);
    }

    if (parsed.length === 0) {
      // Empty first page is expected for sparse province/category combos (e.g. management in Zeeland).
      // Only treat it as an error if this is the sole sourcePath (not province sharding).
      break;
    }

    listings.push(...parsed);
  }

  return { listings, errors };
}

async function scrapeNationaleVacaturebankInternal(
  config: PlatformRuntimeConfig,
  options?: { limit?: number; smoke?: boolean },
): Promise<PlatformScrapeResult> {
  // Support both single sourcePath and multiple sourcePaths
  const sourcePaths: string[] = Array.isArray(config.parameters.sourcePaths)
    ? (config.parameters.sourcePaths as string[])
    : config.parameters.sourcePath
      ? [String(config.parameters.sourcePath)]
      : DEFAULT_SOURCE_PATHS;

  const maxPages = parsePositiveInteger(config.parameters.maxPages, 10);
  const detailLimit = parsePositiveInteger(config.parameters.detailLimit, 50);
  const useNextData = config.parameters.useNextData !== false;
  const useProvinceSharding = config.parameters.useProvinceSharding === true;
  const provinceConcurrency = parsePositiveInteger(config.parameters.provinceConcurrency, 3);
  const limit = options?.limit ? Math.max(1, options.limit) : Number.POSITIVE_INFINITY;
  const seenIds = new Map<string, RawScrapedListing>();
  const errors: string[] = [];
  let evidence: Record<string, unknown> | undefined;
  let sessionCookieHeader: string | undefined;

  for (const sourcePath of sourcePaths) {
    if (seenIds.size >= limit) break;
    if (options?.smoke && seenIds.size > 0) break;

    const initialPageUrl = buildNationaleVacaturebankPageUrl(config.baseUrl, sourcePath, 1);

    // Reuse session from first branch, bootstrap only once
    let session: SessionBootstrapResult;
    if (sessionCookieHeader) {
      session = {
        cookieHeader: sessionCookieHeader,
        firstResponse: await fetchPageWithSession(initialPageUrl, sessionCookieHeader),
      };
    } else {
      session = await initializeConsentAwareSession(config, initialPageUrl);
      sessionCookieHeader = session.cookieHeader;
      if (session.evidence) {
        evidence = { bootstrap: session.evidence };
      }
    }

    // Scrape the main path
    const mainResult = await scrapePath(
      sourcePath,
      config,
      maxPages,
      session.cookieHeader,
      useNextData,
      session.firstResponse,
    );
    for (const listing of mainResult.listings) {
      const id = String(listing.externalId ?? "");
      if (id && !seenIds.has(id)) seenIds.set(id, listing);
    }
    errors.push(...mainResult.errors);

    evidence = {
      ...(evidence ?? {}),
      lastFetchedPath: sourcePath,
      uniqueListings: seenIds.size,
    };

    // Province sharding: scrape each province sub-path concurrently
    if (useProvinceSharding && !options?.smoke) {
      const provinceSubPaths = NVB_PROVINCES.map(
        (province) => `${sourcePath}/in-provincie-${province}`,
      );

      // Process provinces in batches of provinceConcurrency
      for (let i = 0; i < provinceSubPaths.length; i += provinceConcurrency) {
        if (seenIds.size >= limit) break;

        const batch = provinceSubPaths.slice(i, i + provinceConcurrency);
        const results = await Promise.allSettled(
          batch.map((subPath) =>
            scrapePath(subPath, config, maxPages, session.cookieHeader, useNextData),
          ),
        );

        for (const result of results) {
          if (result.status === "fulfilled") {
            for (const listing of result.value.listings) {
              const id = String(listing.externalId ?? "");
              if (id && !seenIds.has(id)) seenIds.set(id, listing);
            }
            errors.push(...result.value.errors);
          } else {
            errors.push(`NVB provincie scrape mislukt: ${result.reason}`);
          }
        }

        evidence = {
          ...(evidence ?? {}),
          provinceBatch: `${Math.min(i + provinceConcurrency, provinceSubPaths.length)}/${provinceSubPaths.length}`,
          uniqueListings: seenIds.size,
        };
      }
    }
  }

  const uniqueListings = Array.from(seenIds.values()).slice(0, limit);

  // When __NEXT_DATA__ provides fullDescription, skip detail enrichment
  const needsEnrichment = uniqueListings.some(
    (l) => !l.description || String(l.description).length < 20,
  );
  let finalListings: RawScrapedListing[];

  if (needsEnrichment) {
    const enriched = await enrichNationaleVacaturebankListings(
      uniqueListings,
      config,
      sessionCookieHeader,
      Math.min(detailLimit, uniqueListings.length),
    );
    errors.push(...enriched.errors);
    finalListings = enriched.listings;
  } else {
    finalListings = uniqueListings;
  }

  return {
    listings: finalListings,
    errors,
    evidence: {
      ...(evidence ?? {}),
      sourcePaths,
      useNextData,
      useProvinceSharding,
      totalUnique: finalListings.length,
      detailEnrichmentSkipped: !needsEnrichment,
    },
  };
}

export const nationaleVacaturebankAdapter: PlatformAdapter = {
  async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
    const sourcePaths: string[] = Array.isArray(config.parameters.sourcePaths)
      ? (config.parameters.sourcePaths as string[])
      : config.parameters.sourcePath
        ? [String(config.parameters.sourcePath)]
        : DEFAULT_SOURCE_PATHS;
    const sourcePath = sourcePaths[0];
    const pageUrl = buildNationaleVacaturebankPageUrl(config.baseUrl, sourcePath, 1);
    const session = await initializeConsentAwareSession(config, pageUrl);
    const response = session.firstResponse;
    const blocker = detectNationaleVacaturebankBlocker(response);

    if (blocker.blockerKind) {
      return {
        ok: false,
        status: "failed",
        blockerKind: blocker.blockerKind,
        message:
          "NVB validatie herkende een consent blocker en kon geen toegankelijke sessie opbouwen.",
        evidence: {
          bootstrap: session.evidence ?? null,
          matchedSignals: blocker.matchedSignals,
          finalUrl: response.url,
        },
      };
    }

    const listings = parseNationaleVacaturebankListings(response.html);
    if (listings.length === 0) {
      return {
        ok: false,
        status: "failed",
        blockerKind: "unexpected_markup",
        message: "Geen herkenbare vacaturekaarten gevonden op de NVB resultatenpagina.",
        evidence: {
          finalUrl: response.url,
        },
      };
    }

    return {
      ok: true,
      status: "validated",
      message: session.cookieHeader
        ? `NVB validatie succesvol na browser bootstrap: ${listings.length} vacaturekaarten gedetecteerd.`
        : `NVB preflight succesvol: ${listings.length} vacaturekaarten gedetecteerd.`,
      evidence: {
        bootstrap: session.evidence ?? null,
        finalUrl: response.url,
        detectedListings: listings.length,
      },
    };
  },

  async scrape(
    config: PlatformRuntimeConfig,
    options?: { limit?: number; smoke?: boolean },
  ): Promise<PlatformScrapeResult> {
    return scrapeNationaleVacaturebankInternal(config, options);
  },

  async testImport(
    config: PlatformRuntimeConfig,
    options?: { limit?: number },
  ): Promise<PlatformTestImportResult> {
    const result = await scrapeNationaleVacaturebankInternal(config, {
      limit: options?.limit ?? 3,
      smoke: true,
    });

    return {
      status:
        result.blockerKind === "needs_implementation"
          ? "needs_implementation"
          : result.errors && result.errors.length > 0 && result.listings.length === 0
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
