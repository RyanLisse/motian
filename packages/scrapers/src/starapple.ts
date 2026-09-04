import { stripHtml } from "./lib/utils";
import type {
  PlatformAdapter,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
  RawScrapedListing,
} from "./types";

/**
 * Starapple adapter — Dutch IT recruitment agency with a WordPress-based
 * listing site (https://www.starapple.nl/vacatures).
 *
 * Discovery: Yoast sitemap at `/vacancy-sitemap.xml`. Detail URL pattern is
 * `/vacatures/{slug}/`. Pages have no JSON-LD JobPosting, so we extract title,
 * description and a few light metadata signals from the HTML.
 *
 * Starapple is the end-client attribution-wise; individual listings may name a
 * different real employer inside the body, but on the platform-facing feed the
 * agency name is what users see. We store "Starapple" as the `company` field
 * and leave the body-level client name inside the description.
 */

const DEFAULT_SITEMAP_URL = "https://www.starapple.nl/vacancy-sitemap.xml";
const DETAIL_URL_PREFIX = "https://www.starapple.nl/vacatures/";
const DEFAULT_DETAIL_CONCURRENCY = 4;
const FETCH_TIMEOUT_MS = 30_000;
const USER_AGENT = "MotianScraper/1.0 (+https://motian.vercel.app) - contact: ryan@ryanlisse.com";

type StarappleOptions = {
  sitemapUrl: string;
  detailConcurrency: number;
  maxListings?: number;
};

function resolveStarappleOptions(config: PlatformRuntimeConfig): StarappleOptions {
  const params = (config.parameters ?? {}) as Record<string, unknown>;
  const sitemapUrl =
    typeof params.sitemapUrl === "string" && params.sitemapUrl.length > 0
      ? params.sitemapUrl
      : DEFAULT_SITEMAP_URL;
  const detailConcurrency =
    typeof params.detailConcurrency === "number" &&
    params.detailConcurrency > 0 &&
    params.detailConcurrency <= 8
      ? params.detailConcurrency
      : DEFAULT_DETAIL_CONCURRENCY;
  const maxListings =
    typeof params.maxListings === "number" && params.maxListings > 0
      ? Math.floor(params.maxListings)
      : undefined;
  return { sitemapUrl, detailConcurrency, maxListings };
}

async function fetchText(
  url: string,
  signal?: AbortSignal,
): Promise<{ status: number; body: string }> {
  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), FETCH_TIMEOUT_MS);
  const onAbort = () => controller.abort();
  signal?.addEventListener("abort", onAbort, { once: true });
  try {
    const res = await fetch(url, {
      headers: { "User-Agent": USER_AGENT, Accept: "text/html,application/xml,text/xml,*/*" },
      signal: controller.signal,
    });
    const body = await res.text();
    return { status: res.status, body };
  } finally {
    clearTimeout(timeout);
    signal?.removeEventListener("abort", onAbort);
  }
}

/**
 * Extract vacancy detail URLs from the Yoast sitemap. Filters the listing-page
 * self-entry (`/vacatures/`) which is not an individual vacancy.
 */
export function parseStarappleSitemap(xml: string): string[] {
  const urls: string[] = [];
  const regex = /<loc>\s*([^<\s]+)\s*<\/loc>/g;
  let match: RegExpExecArray | null = regex.exec(xml);
  while (match !== null) {
    const loc = match[1];
    if (
      loc.startsWith(DETAIL_URL_PREFIX) &&
      loc !== DETAIL_URL_PREFIX &&
      loc !== `${DETAIL_URL_PREFIX.replace(/\/$/, "")}`
    ) {
      urls.push(loc);
    }
    match = regex.exec(xml);
  }
  return urls;
}

type StarappleDetail = {
  title: string;
  externalUrl: string;
  externalId: string;
  description: string;
  location?: string;
};

function slugFromUrl(url: string): string {
  try {
    return new URL(url).pathname.replace(/^\/vacatures\//, "").replace(/\/+$/, "") || url;
  } catch {
    return url;
  }
}

/**
 * Parse a single detail page. Starapple uses h1 for the vacancy title and h3
 * for body sections (Organisatie & Afdeling, Functie, Functie eisen, Aanbod).
 * Returns `null` when the page does not look like a vacancy (e.g. 404 / expired).
 */
export function parseStarappleDetail(html: string, url: string): StarappleDetail | null {
  const h1Match = html.match(/<h1[^>]*>([\s\S]*?)<\/h1>/i);
  const rawTitle = h1Match ? stripHtml(h1Match[1]).trim() : null;
  if (!rawTitle || rawTitle.length < 3) return null;

  // Pull h3 sections into a single description. Keep it bounded so we don't
  // blow the `description` column out when Starapple ships a novel.
  const sections: string[] = [];
  const sectionRegex = /<h3[^>]*>([\s\S]*?)<\/h3>([\s\S]*?)(?=<h3[^>]*>|<\/main>|<footer)/gi;
  let sec: RegExpExecArray | null = sectionRegex.exec(html);
  while (sec !== null) {
    const heading = stripHtml(sec[1]).trim();
    const bodyText = stripHtml(sec[2]).replace(/\s+/g, " ").trim();
    if (heading && bodyText) {
      sections.push(`${heading}: ${bodyText.slice(0, 1500)}`);
    }
    sec = sectionRegex.exec(html);
  }
  const description = sections.length > 0 ? sections.join("\n\n").slice(0, 8000) : rawTitle;

  // Location extraction — Starapple's WordPress theme places location in a
  // `<!-- Location -->` section that conditionally renders a `.meta-item` div
  // with an SVG icon followed by the location text. When the WordPress custom
  // field is not set the block renders empty (common on current listings).
  //
  // Strategy (in priority order):
  // 1. Structured meta-item: anchor on the <!-- Location --> HTML comment, then
  //    skip the optional meta-item+SVG wrapper and capture the trailing text.
  // 2. Prose label fallback: "Standplaats: Amsterdam" or "Locatie: Utrecht"
  //    patterns that sometimes appear in the job-description body.
  let location: string | undefined;

  // 1. Structured meta-item — matches when WordPress field is populated.
  //    Pattern: <!-- Location -->[whitespace]<div class="meta-item ...">
  //      <svg ...>...</svg>[whitespace]CITY TEXT[whitespace]</div>
  const metaItemMatch = html.match(
    /<!--\s*Location\s*-->[\s\S]{0,200}?<\/svg>\s*([^\s<][^<]{1,59}?)\s*<\/div>/i,
  );
  if (metaItemMatch) {
    const candidate = metaItemMatch[1].trim();
    // Reject obvious non-locations (empty, just dashes, placeholder text)
    if (candidate.length >= 2 && candidate !== "-" && !/^[\s\-–—]+$/.test(candidate)) {
      location = candidate;
    }
  }

  // 2. Inline tag fallback — "Locatie<strong>Amsterdam</strong>" or
  //    "Standplaats<span>Utrecht</span>" without a colon separator.
  if (!location) {
    const inlineTagMatch = html.match(
      /(?:Standplaats|Werklocatie|Locatie)\s*<[^>]+>\s*([^<]{2,60}?)\s*</i,
    );
    if (inlineTagMatch) {
      const candidate = inlineTagMatch[1].trim().replace(/[;,.]$/, "");
      if (candidate.length >= 2 && candidate !== "-" && !/^[\s\-–—]+$/.test(candidate)) {
        location = candidate;
      }
    }
  }

  // 3. Prose label fallback — "Standplaats: Utrecht" or "Locatie: Amsterdam"
  //    anywhere in the page text, bounded to 60 chars after the colon.
  if (!location) {
    const proseMatch = html.match(
      /(?:Standplaats|Werklocatie|Locatie)\s*:\s*([A-ZÀÁÂÃÄÅÆÇÈÉÊËÌÍÎÏÐÑÒÓÔÕÖØÙÚÛÜÝ][^<\n\r]{1,59}?)(?:\s*<|\s*\n)/i,
    );
    if (proseMatch) {
      const candidate = proseMatch[1].trim().replace(/[;,.]$/, "");
      // Reject generic prose uses like "locatie bij de klant" (lowercase start after colon)
      if (
        candidate.length >= 2 &&
        candidate !== "-" &&
        !/^(om|bij|van|in|op|het|een|de|dit|dat)\b/i.test(candidate)
      ) {
        location = candidate;
      }
    }
  }

  return {
    title: rawTitle.slice(0, 300),
    externalUrl: url,
    externalId: slugFromUrl(url),
    description,
    location,
  };
}

async function mapWithConcurrency<T, R>(
  items: T[],
  concurrency: number,
  fn: (item: T, index: number) => Promise<R>,
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let cursor = 0;
  const workers = Array.from({ length: Math.min(concurrency, items.length) }, async () => {
    while (true) {
      const i = cursor++;
      if (i >= items.length) return;
      results[i] = await fn(items[i], i);
    }
  });
  await Promise.all(workers);
  return results;
}

async function scrapeStarappleListings(
  config: PlatformRuntimeConfig,
  options?: { limit?: number },
): Promise<PlatformScrapeResult> {
  const resolved = resolveStarappleOptions(config);
  const errors: string[] = [];

  let sitemapBody: string;
  try {
    const { status, body } = await fetchText(resolved.sitemapUrl);
    if (status >= 400) {
      return {
        listings: [],
        errors: [`Starapple sitemap gaf HTTP ${status}`],
      };
    }
    sitemapBody = body;
  } catch (err) {
    return {
      listings: [],
      errors: [
        `Starapple sitemap fetch mislukt: ${err instanceof Error ? err.message : String(err)}`,
      ],
    };
  }

  const allUrls = parseStarappleSitemap(sitemapBody);
  const limit = options?.limit ?? resolved.maxListings;
  const detailUrls = typeof limit === "number" ? allUrls.slice(0, limit) : allUrls;
  if (detailUrls.length === 0) {
    return { listings: [], errors: ["Starapple sitemap bevat geen parseerbare vacature-URLs."] };
  }

  const listings: RawScrapedListing[] = [];
  let missing = 0;

  const results = await mapWithConcurrency(detailUrls, resolved.detailConcurrency, async (url) => {
    try {
      const { status, body } = await fetchText(url);
      if (status >= 400) {
        return { kind: "error" as const, url, message: `HTTP ${status}` };
      }
      const detail = parseStarappleDetail(body, url);
      if (!detail) {
        return { kind: "missing" as const, url };
      }
      return { kind: "ok" as const, detail };
    } catch (err) {
      return {
        kind: "error" as const,
        url,
        message: err instanceof Error ? err.message : String(err),
      };
    }
  });

  for (const r of results) {
    if (r.kind === "ok") {
      listings.push({
        title: r.detail.title,
        company: "Starapple",
        location: r.detail.location,
        description: r.detail.description,
        externalId: r.detail.externalId,
        externalUrl: r.detail.externalUrl,
        sourceUrl: r.detail.externalUrl,
      });
    } else if (r.kind === "missing") {
      missing += 1;
    } else {
      errors.push(`Starapple detail ${r.url}: ${r.message}`);
    }
  }

  // Missing-signal fallback: mirror mipublic's < 5% tolerance. Starapple pages
  // occasionally return without an h1 (archived jobs); we log but don't fail.
  const missingRatio = detailUrls.length > 0 ? missing / detailUrls.length : 0;
  if (missing > 0 && missingRatio > 0.05) {
    errors.push(
      `${missing} Starapple pagina's missen een vacaturetitel (${(missingRatio * 100).toFixed(1)}% > 5%)`,
    );
  } else if (missing > 0) {
    console.log(
      `[starapple] ${missing} pagina's zonder titel — binnen tolerantie, niet als fout gerapporteerd`,
    );
  }

  return { listings, errors: errors.length > 0 ? errors : undefined };
}

export const starappleAdapter: PlatformAdapter = {
  async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
    const resolved = resolveStarappleOptions(config);
    try {
      const { status, body } = await fetchText(resolved.sitemapUrl);
      if (status >= 400) {
        return {
          ok: false,
          status: "failed",
          message: `Sitemap ${resolved.sitemapUrl} gaf HTTP ${status}`,
          evidence: { sitemapUrl: resolved.sitemapUrl, httpStatus: status },
        };
      }
      const urls = parseStarappleSitemap(body);
      if (urls.length === 0) {
        return {
          ok: false,
          status: "failed",
          message: "Sitemap bevat geen parseerbare vacature-URLs.",
          evidence: { sitemapUrl: resolved.sitemapUrl, bodyLength: body.length },
        };
      }
      return {
        ok: true,
        status: "validated",
        message: `Starapple sitemap ok — ${urls.length} vacature-URLs gevonden.`,
        evidence: { sitemapUrl: resolved.sitemapUrl, urlCount: urls.length },
      };
    } catch (err) {
      return {
        ok: false,
        status: "failed",
        message: `Validatie mislukt: ${err instanceof Error ? err.message : String(err)}`,
        evidence: { sitemapUrl: resolved.sitemapUrl },
      };
    }
  },
  scrape: scrapeStarappleListings,
  async testImport(
    config: PlatformRuntimeConfig,
    options?: { limit?: number },
  ): Promise<PlatformTestImportResult> {
    const limit = Math.min(options?.limit ?? 3, 10);
    const result = await scrapeStarappleListings(config, { limit });
    const jobsFound = result.listings.length;
    return {
      status: jobsFound > 0 ? "success" : "failed",
      jobsFound,
      listings: result.listings,
      errors: result.errors,
    };
  },
};
