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
const SITEMAP_INDEX_FALLBACK_PATH = "/sitemap_index.xml";
const DEFAULT_DETAIL_CONCURRENCY = 4;
const MAX_DETAIL_CONCURRENCY = 8;
const MAX_SITEMAP_CHILD_FETCHES = 30;
const SITEMAP_CHILD_FETCH_CONCURRENCY = 4;

type MipublicOptions = {
  detailConcurrency: number;
  maxListings?: number;
  sitemapUrl: string;
};

type MipublicCaptchaBlocker = {
  message: string;
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

const SITEMAP_MAX_AGE_DAYS = 90;

type SitemapChildRef = { url: string; lastmod?: Date };

type ParsedSitemap =
  | { kind: "index"; children: SitemapChildRef[] }
  | { kind: "urlset"; urls: string[] };

function isVacatureDetailUrl(url: URL): boolean {
  return url.hostname === "mipublic.nl" && /^\/vacature\/[^/]+\/?$/.test(url.pathname);
}

function parseLastmod(block: string): Date | undefined {
  const match = block.match(/<lastmod>([^<]+)<\/lastmod>/i);
  if (!match) return undefined;
  const parsed = new Date(match[1].trim());
  return Number.isNaN(parsed.getTime()) ? undefined : parsed;
}

/**
 * Parse sitemap XML into either a sitemap index (list of child sitemaps) or a
 * urlset (list of vacancy URLs). Both shapes are emitted by Yoast SEO on
 * mipublic.nl — `/sitemap_index.xml` is the index, each `vacature-sitemap*.xml`
 * is a urlset. Keeping this as a pure function keeps it trivially testable.
 */
export function parseMipublicSitemap(xml: string): ParsedSitemap {
  const isIndex = /<sitemapindex\b/i.test(xml);

  if (isIndex) {
    const children: SitemapChildRef[] = [];
    const blocks = xml.match(/<sitemap\b[^>]*>[\s\S]*?<\/sitemap>/gi) ?? [];
    for (const block of blocks) {
      const locMatch = block.match(/<loc>([^<]+)<\/loc>/i);
      if (!locMatch) continue;
      const value = locMatch[1]?.trim();
      if (!value) continue;
      try {
        const parsed = new URL(value);
        if (parsed.hostname !== "mipublic.nl") continue;
        children.push({ url: parsed.toString(), lastmod: parseLastmod(block) });
      } catch {
        continue;
      }
    }
    return { kind: "index", children };
  }

  const urls = new Set<string>();
  const cutoff = new Date();
  cutoff.setDate(cutoff.getDate() - SITEMAP_MAX_AGE_DAYS);

  const urlBlocks = xml.match(/<url\b[^>]*>[\s\S]*?<\/url>/gi) ?? [];
  if (urlBlocks.length > 0) {
    for (const block of urlBlocks) {
      const locMatch = block.match(/<loc>([^<]+)<\/loc>/i);
      if (!locMatch) continue;
      const value = locMatch[1]?.trim();
      if (!value) continue;

      const lastmod = parseLastmod(block);
      if (lastmod && lastmod < cutoff) continue;

      try {
        const parsed = new URL(value);
        if (isVacatureDetailUrl(parsed)) urls.add(parsed.toString());
      } catch {
        continue;
      }
    }
    return { kind: "urlset", urls: [...urls] };
  }

  // Fallback for simpler sitemaps that omit <url> wrappers. Only applies when
  // the document genuinely has no <url> blocks — otherwise stale entries that
  // were correctly filtered above would sneak back in.
  for (const match of xml.matchAll(/<loc>([^<]+)<\/loc>/gi)) {
    const value = match[1]?.trim();
    if (!value) continue;
    try {
      const parsed = new URL(value);
      if (isVacatureDetailUrl(parsed)) urls.add(parsed.toString());
    } catch {
      continue;
    }
  }

  return { kind: "urlset", urls: [...urls] };
}

type SitemapFetcher = (url: string) => Promise<{ html: string; status: number; url: string }>;

/**
 * Fetch a sitemap (or sitemap index) and recursively collect all vacancy URLs.
 * Child sitemaps are fetched newest-first and capped by MAX_SITEMAP_CHILD_FETCHES
 * so a future Yoast rollout (20+ sub-sitemaps) cannot explode the request count.
 */
export async function collectMipublicVacatureUrls(
  initialXml: string,
  initialUrl: string,
  fetcher: SitemapFetcher,
): Promise<{ urls: string[]; errors: string[] }> {
  const parsed = parseMipublicSitemap(initialXml);
  if (parsed.kind === "urlset") {
    return { urls: parsed.urls, errors: [] };
  }

  const errors: string[] = [];
  const aggregated = new Set<string>();

  const ordered = [...parsed.children].sort((a, b) => {
    const aTime = a.lastmod?.getTime() ?? 0;
    const bTime = b.lastmod?.getTime() ?? 0;
    return bTime - aTime;
  });
  const selected = ordered.slice(0, MAX_SITEMAP_CHILD_FETCHES);

  let nextIndex = 0;
  async function worker() {
    while (nextIndex < selected.length) {
      const current = nextIndex;
      nextIndex += 1;
      const child = selected[current];
      if (child.url === initialUrl) continue;
      try {
        const page = await fetcher(child.url);
        if (page.status >= 400) {
          errors.push(`MiPublic sub-sitemap ${child.url} gaf HTTP ${page.status} terug.`);
          continue;
        }
        const childParsed = parseMipublicSitemap(page.html);
        if (childParsed.kind === "urlset") {
          for (const url of childParsed.urls) aggregated.add(url);
        } else {
          errors.push(`MiPublic sub-sitemap ${child.url} is onverwacht opnieuw een sitemap-index.`);
        }
      } catch (error) {
        errors.push(
          `MiPublic sub-sitemap ${child.url} kon niet worden opgehaald: ${error instanceof Error ? error.message : String(error)}`,
        );
      }
    }
  }

  await Promise.all(
    Array.from(
      { length: Math.min(SITEMAP_CHILD_FETCH_CONCURRENCY, selected.length) },
      () => worker(),
    ),
  );

  return { urls: [...aggregated], errors };
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
/** Signals in the HTML that indicate the vacancy page is expired/archived. */
const EXPIRED_PAGE_SIGNALS = [
  "niet meer beschikbaar",
  "niet meer actief",
  "vacature is verlopen",
  "vacature is gesloten",
  "pagina niet gevonden",
  "page not found",
  "deze vacature bestaat niet",
  "404",
];

function isExpiredMipublicPage(html: string): boolean {
  const lower = html.toLowerCase();
  return EXPIRED_PAGE_SIGNALS.some((signal) => lower.includes(signal));
}

function parseMipublicHtmlFallback(html: string, canonicalUrl: string): RawScrapedListing | null {
  // Don't create listings from expired/archived pages
  if (isExpiredMipublicPage(html)) return null;

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

function detectMipublicCaptchaBlocker(
  pageUrl: string,
  page: { status: number; html: string },
): MipublicCaptchaBlocker | null {
  const lowerHtml = page.html.toLowerCase();
  const captchaMarkers = [
    "/.well-known/sgcaptcha/",
    "sgcaptcha",
    'http-equiv="refresh"',
    "http-equiv='refresh'",
  ];

  if (page.status === 202 && captchaMarkers.some((marker) => lowerHtml.includes(marker))) {
    return {
      message: `MiPublic pagina wordt geblokkeerd door een anti-bot challenge: ${pageUrl}`,
    };
  }

  return null;
}

type SitemapDiscoveryResult =
  | { kind: "captcha"; message: string }
  | { kind: "ok"; urls: string[]; errors: string[] };

/**
 * Fetch the configured sitemap and collect vacancy URLs. Falls back to
 * `/sitemap_index.xml` when the primary sitemap yields 0 URLs — that is the
 * RJC-213 regression mode where MiPublic's legacy `/vacature-sitemap.xml` has
 * been frozen in time and current vacancies are only reachable via the index.
 */
async function createBrowserbaseSession(
  apiKey: string,
  projectId: string,
): Promise<string | null> {
  try {
    const response = await fetch("https://api.browserbase.com/v1/sessions", {
      method: "POST",
      headers: {
        "X-BB-API-Key": apiKey,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ projectId }),
      signal: AbortSignal.timeout(15_000),
    });
    if (!response.ok) return null;
    const body = (await response.json()) as { connectUrl?: string };
    return body.connectUrl ?? null;
  } catch {
    return null;
  }
}

async function fetchMipublicSitemapViaBrowserbase(url: string): Promise<string | null> {
  const apiKey = process.env.BROWSERBASE_API_KEY;
  const projectId = process.env.BROWSERBASE_PROJECT_ID;
  if (!apiKey || !projectId) return null;

  const connectUrl = await createBrowserbaseSession(apiKey, projectId);
  if (!connectUrl) return null;

  const puppeteer = await import("puppeteer-core");
  const browser = await puppeteer.default.connect({ browserWSEndpoint: connectUrl });

  try {
    const page = await browser.newPage();
    await page.goto(url, { waitUntil: "networkidle2", timeout: 30_000 });

    // MiPublic uses SiteGuard anti-bot (HTTP 202 + meta-refresh to
    // /.well-known/captcha/). Poll until the challenge self-resolves; the
    // browser then holds the SiteGuard cookie so an in-page fetch() returns
    // the raw XML (puppeteer's page.content() wraps XML in an HTML document).
    const maxWaitMs = 25_000;
    const startTime = Date.now();
    while (Date.now() - startTime < maxWaitMs) {
      await new Promise((resolve) => setTimeout(resolve, 2_000));
      const html = await page.content();
      if (!html.toLowerCase().includes("sgcaptcha")) break;
    }

    return await page.evaluate(async (u) => {
      const res = await fetch(u);
      return await res.text();
    }, url);
  } finally {
    await browser.close().catch(() => {});
  }
}

async function fetchSitemapWithBrowserbaseFallback(
  url: string,
): Promise<{ status: number; html: string; via: "direct" | "browserbase" }> {
  const direct = await fetchPublicJobBoardPage(url);
  if (!detectMipublicCaptchaBlocker(url, direct)) {
    return { status: direct.status, html: direct.html, via: "direct" };
  }

  const browserbaseHtml = await fetchMipublicSitemapViaBrowserbase(url).catch(() => null);
  if (browserbaseHtml && !browserbaseHtml.toLowerCase().includes("sgcaptcha")) {
    return { status: 200, html: browserbaseHtml, via: "browserbase" };
  }

  return { status: direct.status, html: direct.html, via: "direct" };
}

async function discoverMipublicDetailUrls(
  resolved: MipublicOptions,
): Promise<SitemapDiscoveryResult> {
  const sitemapPage = await fetchSitemapWithBrowserbaseFallback(resolved.sitemapUrl);
  const blocker =
    sitemapPage.via === "direct"
      ? detectMipublicCaptchaBlocker(resolved.sitemapUrl, sitemapPage)
      : null;
  if (blocker) return { kind: "captcha", message: blocker.message };

  const collected = await collectMipublicVacatureUrls(
    sitemapPage.html,
    resolved.sitemapUrl,
    fetchPublicJobBoardPage,
  );
  const errors = [...collected.errors];

  if (collected.urls.length > 0) {
    return { kind: "ok", urls: collected.urls, errors };
  }

  // Fallback: if the configured sitemap is the flat `/vacature-sitemap.xml`
  // and it came up empty, try the Yoast sitemap index. Skip if the caller
  // already pointed at the index or at a custom sitemap.
  const fallbackUrl = new URL(SITEMAP_INDEX_FALLBACK_PATH, resolved.sitemapUrl).toString();
  if (resolved.sitemapUrl === fallbackUrl) {
    return { kind: "ok", urls: [], errors };
  }

  try {
    const indexPage = await fetchSitemapWithBrowserbaseFallback(fallbackUrl);
    const indexBlocker =
      indexPage.via === "direct" ? detectMipublicCaptchaBlocker(fallbackUrl, indexPage) : null;
    if (indexBlocker) return { kind: "captcha", message: indexBlocker.message };
    if (indexPage.status >= 400) {
      errors.push(`MiPublic sitemap-index ${fallbackUrl} gaf HTTP ${indexPage.status} terug.`);
      return { kind: "ok", urls: [], errors };
    }
    const fallbackCollected = await collectMipublicVacatureUrls(
      indexPage.html,
      fallbackUrl,
      fetchPublicJobBoardPage,
    );
    return { kind: "ok", urls: fallbackCollected.urls, errors: [...errors, ...fallbackCollected.errors] };
  } catch (error) {
    errors.push(
      `MiPublic sitemap-index ${fallbackUrl} kon niet worden opgehaald: ${error instanceof Error ? error.message : String(error)}`,
    );
    return { kind: "ok", urls: [], errors };
  }
}

async function scrapeMipublicListings(
  config: PlatformRuntimeConfig,
  options?: { limit?: number },
): Promise<PlatformScrapeResult> {
  const resolved = resolveMipublicOptions(config);
  const discovered = await discoverMipublicDetailUrls(resolved);
  if (discovered.kind === "captcha") {
    return { listings: [], errors: [discovered.message] };
  }
  const limit = options?.limit ?? resolved.maxListings;
  const detailUrls = typeof limit === "number" ? discovered.urls.slice(0, limit) : discovered.urls;
  const sitemapErrors = discovered.errors;

  if (detailUrls.length === 0) {
    return {
      listings: [],
      errors: [
        "MiPublic sitemap bevat geen parseerbare vacature-URLs.",
        ...sitemapErrors,
      ],
    };
  }

  const results = await mapWithConcurrency(detailUrls, resolved.detailConcurrency, async (detailUrl) => {
    try {
      const detailPage = await fetchPublicJobBoardPage(detailUrl);
      const captchaBlocker = detectMipublicCaptchaBlocker(detailUrl, detailPage);
      if (captchaBlocker) {
        return {
          error: captchaBlocker.message,
          listings: [] as RawScrapedListing[],
        };
      }
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
          isNoData: true,
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
  const realErrorsFromSitemap = sitemapErrors;
  const noDataEntries = results.filter(
    (
      entry,
    ): entry is {
      error: string;
      listings: RawScrapedListing[];
      isNoData: true;
    } => "isNoData" in entry && entry.isNoData === true,
  );
  const noDataCount = noDataEntries.length;
  const realErrors = [
    ...realErrorsFromSitemap,
    ...results.flatMap((entry) =>
      entry.error && !("isNoData" in entry && entry.isNoData) ? [entry.error] : [],
    ),
  ];
  // Summarise missing-data pages into a single line instead of one per URL
  if (noDataCount > 0) {
    const exampleUrls = noDataEntries
      .map((entry) => entry.error.replace("MiPublic detailpagina bevat geen JobPosting-data: ", ""))
      .slice(0, 3);
    const exampleSuffix =
      exampleUrls.length > 0 ? ` (bijv. ${exampleUrls.join(", ")})` : "";
    realErrors.push(
      `${noDataCount} MiPublic detailpagina's bevatten geen JobPosting-data${exampleSuffix}`,
    );
  }

  return {
    listings,
    errors: realErrors.length > 0 ? realErrors : undefined,
  };
}

export const mipublicAdapter: PlatformAdapter = {
  async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
    const resolved = resolveMipublicOptions(config);
    const discovered = await discoverMipublicDetailUrls(resolved);
    if (discovered.kind === "captcha") {
      return {
        ok: false,
        status: "failed",
        blockerKind: "anti_bot_challenge",
        message: discovered.message,
        evidence: { sitemapUrl: resolved.sitemapUrl },
      };
    }
    const detailUrls = discovered.urls;

    if (detailUrls.length === 0) {
      return {
        ok: false,
        status: "failed",
        message: "MiPublic sitemap bevat geen parseerbare vacaturedetailpagina's.",
        evidence: {
          sitemapUrl: resolved.sitemapUrl,
          sitemapErrors: discovered.errors,
        },
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
