import type {
  PlatformAdapter,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
  RawScrapedListing,
} from "./types";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

type DynamicScrapingStrategy = {
  listSelector: string;
  linkSelector: string;
  paginationType: string;
  paginationSelector?: string;
  maxPages: number;
  fieldMapping: Record<string, string>;
  needsDetailPage: boolean;
  apiEndpoint?: string;
};

function getStrategy(config: PlatformRuntimeConfig): DynamicScrapingStrategy {
  const params = config.parameters as Record<string, unknown>;
  const strategy = params.scrapingStrategy as DynamicScrapingStrategy | undefined;
  if (!strategy) {
    throw new Error(
      `Platform ${config.slug} mist scrapingStrategy in parameters — voer eerst platformAnalyze uit`,
    );
  }
  return strategy;
}

async function fetchHtml(url: string): Promise<string> {
  const apiKey = process.env.FIRECRAWL_API_KEY;

  // Try Firecrawl first for anti-bot bypass
  if (apiKey) {
    try {
      const response = await fetch(FIRECRAWL_API_URL, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${apiKey}`,
        },
        body: JSON.stringify({
          url,
          formats: ["html"],
          waitFor: 3000,
          timeout: 30000,
        }),
      });

      if (response.ok) {
        const data = (await response.json()) as {
          success: boolean;
          data?: { html?: string };
        };
        if (data.success && data.data?.html) {
          return data.data.html;
        }
      }
    } catch {
      // Fall through to direct fetch
    }
  }

  // Direct fetch fallback
  const response = await fetch(url, {
    headers: {
      "User-Agent":
        "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36",
      Accept: "text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8",
      "Accept-Language": "nl-NL,nl;q=0.9,en;q=0.8",
    },
    signal: AbortSignal.timeout(15000),
  });

  if (!response.ok) {
    throw new Error(`Fetch mislukt voor ${url}: HTTP ${response.status}`);
  }

  return response.text();
}

/**
 * Minimal server-side HTML parser using regex for CSS selector-like extraction.
 * Works without DOM dependencies (no jsdom/cheerio needed in the scraper package).
 */
function extractBySelector(html: string, selector: string): string[] {
  const results: string[] = [];

  // Handle simple tag selectors
  if (/^[a-z]+$/i.test(selector)) {
    const tagRegex = new RegExp(`<${selector}[^>]*>([\\s\\S]*?)</${selector}>`, "gi");
    let match: RegExpExecArray | null;
    while ((match = tagRegex.exec(html)) !== null) {
      results.push(match[0]);
    }
    return results;
  }

  // Handle class selectors (.classname)
  const classMatch = selector.match(/\.([a-zA-Z0-9_-]+)/g);
  if (classMatch) {
    const className = classMatch[0].slice(1);
    const classRegex = new RegExp(
      `<([a-z][a-z0-9]*)\\s[^>]*class="[^"]*\\b${escapeRegex(className)}\\b[^"]*"[^>]*>([\\s\\S]*?)(?=<\\1[^>]*class=|$)`,
      "gi",
    );
    let match: RegExpExecArray | null;
    while ((match = classRegex.exec(html)) !== null) {
      results.push(match[0]);
    }
    return results;
  }

  // Handle attribute selectors [data-attr]
  const attrMatch = selector.match(/\[([a-zA-Z0-9_-]+)(?:="([^"]*)")?\]/);
  if (attrMatch) {
    const attrName = attrMatch[1];
    const attrRegex = new RegExp(
      `<[a-z][a-z0-9]*\\s[^>]*${escapeRegex(attrName)}[^>]*>[\\s\\S]*?(?=<[a-z][a-z0-9]*\\s[^>]*${escapeRegex(attrName)}|$)`,
      "gi",
    );
    let match: RegExpExecArray | null;
    while ((match = attrRegex.exec(html)) !== null) {
      results.push(match[0]);
    }
    return results;
  }

  // Fallback: treat as generic text search
  return [html];
}

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function extractText(html: string): string {
  return html
    .replace(/<script[^>]*>[\s\S]*?<\/script>/gi, "")
    .replace(/<style[^>]*>[\s\S]*?<\/style>/gi, "")
    .replace(/<[^>]+>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/&amp;/g, "&")
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&#?\w+;/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

function extractLinks(html: string, baseUrl: string): string[] {
  const links: string[] = [];
  const linkRegex = /href="([^"]*?)"/gi;
  let match: RegExpExecArray | null;
  while ((match = linkRegex.exec(html)) !== null) {
    try {
      const href = match[1];
      if (href.startsWith("http")) {
        links.push(href);
      } else if (href.startsWith("/")) {
        links.push(new URL(href, baseUrl).href);
      }
    } catch {
      // Invalid URL, skip
    }
  }
  return links;
}

function extractFieldValue(html: string, selector: string): string {
  const elements = extractBySelector(html, selector);
  if (elements.length === 0) return "";
  return extractText(elements[0]);
}

function buildPageUrl(
  baseUrl: string,
  page: number,
  strategy: DynamicScrapingStrategy,
): string {
  if (strategy.paginationType === "url_parameter" && strategy.paginationSelector) {
    const pattern = strategy.paginationSelector;
    if (pattern.includes("{n}")) {
      return `${baseUrl}${pattern.replace("{n}", String(page))}`;
    }
    // Append as query param
    const url = new URL(baseUrl);
    url.searchParams.set(pattern.replace("?", "").split("=")[0], String(page));
    return url.href;
  }
  return baseUrl;
}

async function scrapeListings(
  config: PlatformRuntimeConfig,
  options?: { limit?: number },
): Promise<{ listings: RawScrapedListing[]; errors: string[] }> {
  const strategy = getStrategy(config);
  const limit = options?.limit;
  const maxPages = limit ? Math.min(strategy.maxPages, 2) : strategy.maxPages;
  const allListings: RawScrapedListing[] = [];
  const errors: string[] = [];

  for (let page = 1; page <= maxPages; page++) {
    if (limit && allListings.length >= limit) break;

    try {
      const pageUrl = buildPageUrl(config.baseUrl, page, strategy);
      const html = await fetchHtml(pageUrl);

      // Extract listing elements from the page
      const listElements = extractBySelector(html, strategy.listSelector);

      if (listElements.length === 0 && page === 1) {
        errors.push(`Geen listings gevonden met selector "${strategy.listSelector}" op ${pageUrl}`);
        break;
      }

      if (listElements.length === 0) break; // No more pages

      // Apply limit to elements we process from this page
      const remaining = limit ? limit - allListings.length : listElements.length;
      const elementsToProcess = listElements.slice(0, remaining);

      if (strategy.needsDetailPage) {
        // Build fetch plan: extract detail URLs from all elements first
        const detailFetchPlan = elementsToProcess
          .map((element) => {
            const links = extractLinks(element, config.baseUrl);
            return { element, detailUrl: links[0] };
          })
          .filter((plan) => plan.detailUrl);

        // Fetch ALL detail pages in parallel
        const detailResults = await Promise.allSettled(
          detailFetchPlan.map((plan) => fetchHtml(plan.detailUrl!)),
        );

        // Map results back to listings
        for (let i = 0; i < detailFetchPlan.length; i++) {
          const { element, detailUrl } = detailFetchPlan[i];
          const detailResult = detailResults[i];

          const listing: RawScrapedListing = {
            externalUrl: detailUrl ?? "",
            externalId: detailUrl
              ? (detailUrl.split("/").filter(Boolean).pop() ?? detailUrl)
              : "",
          };

          if (detailResult.status === "fulfilled") {
            for (const [field, selector] of Object.entries(strategy.fieldMapping)) {
              const value = extractFieldValue(detailResult.value, selector);
              if (value) {
                listing[field] = value;
              }
            }
          } else {
            // Fallback to list page data
            errors.push(
              `Detail fetch mislukt voor ${detailUrl}: ${detailResult.reason instanceof Error ? detailResult.reason.message : String(detailResult.reason)}`,
            );
            for (const [field, selector] of Object.entries(strategy.fieldMapping)) {
              const value = extractFieldValue(element, selector);
              if (value) {
                listing[field] = value;
              }
            }
          }

          if (listing.title || listing.externalUrl) {
            if (!listing.title) {
              listing.title = extractText(element).slice(0, 200);
            }
            allListings.push(listing);
          }
        }

        // Handle elements without a detail URL (no link found)
        for (const element of elementsToProcess) {
          const links = extractLinks(element, config.baseUrl);
          if (links[0]) continue; // Already processed in parallel batch above

          // Derive a deterministic ID from element content to prevent duplicate drift
          const elementText = extractText(element).slice(0, 100);
          const listing: RawScrapedListing = {
            externalUrl: "",
            externalId: elementText.replace(/\s+/g, "-").toLowerCase().slice(0, 80) || `no-id-${allListings.length}`,
          };
          for (const [field, selector] of Object.entries(strategy.fieldMapping)) {
            const value = extractFieldValue(element, selector);
            if (value) {
              listing[field] = value;
            }
          }
          if (listing.title || listing.externalUrl) {
            if (!listing.title) {
              listing.title = extractText(element).slice(0, 200);
            }
            allListings.push(listing);
          }
        }
      } else {
        // No detail page needed — extract from list elements directly
        for (const element of elementsToProcess) {
          const links = extractLinks(element, config.baseUrl);
          const detailUrl = links[0];

          const listing: RawScrapedListing = {
            externalUrl: detailUrl ?? "",
            externalId: detailUrl
              ? (detailUrl.split("/").filter(Boolean).pop() ?? detailUrl)
              : "",
          };

          for (const [field, selector] of Object.entries(strategy.fieldMapping)) {
            const value = extractFieldValue(element, selector);
            if (value) {
              listing[field] = value;
            }
          }

          if (listing.title || listing.externalUrl) {
            if (!listing.title) {
              listing.title = extractText(element).slice(0, 200);
            }
            allListings.push(listing);
          }
        }
      }
    } catch (err) {
      errors.push(
        `Pagina ${page} scrapen mislukt: ${err instanceof Error ? err.message : String(err)}`,
      );
      if (page === 1) break; // First page failure = stop
    }
  }

  return { listings: allListings, errors };
}

/** Dynamic adapter that uses AI-generated scraping strategies. */
export const dynamicAdapter: PlatformAdapter = {
  async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
    if (!config.baseUrl) {
      return {
        ok: false,
        status: "failed",
        message: "Een baseUrl is verplicht voor dynamische scrapers.",
      };
    }

    try {
      getStrategy(config);
    } catch {
      return {
        ok: false,
        status: "failed",
        message:
          "Geen scrapingStrategy gevonden in parameters. Voer eerst platformAnalyze uit om de scraping strategie te bepalen.",
        blockerKind: "needs_implementation",
      };
    }

    // Test that the URL is reachable
    try {
      const html = await fetchHtml(config.baseUrl);
      const strategy = getStrategy(config);
      const elements = extractBySelector(html, strategy.listSelector);

      if (elements.length === 0) {
        return {
          ok: false,
          status: "failed",
          message: `Validatie mislukt: selector "${strategy.listSelector}" vond geen elementen op ${config.baseUrl}. Mogelijk is de paginastructuur veranderd.`,
          blockerKind: "selector_drift",
          evidence: {
            testedUrl: config.baseUrl,
            selector: strategy.listSelector,
            htmlLength: html.length,
          },
        };
      }

      return {
        ok: true,
        status: "validated",
        message: `Configuratie gevalideerd: ${elements.length} listing elementen gevonden.`,
        evidence: {
          elementsFound: elements.length,
          testedUrl: config.baseUrl,
        },
      };
    } catch (err) {
      return {
        ok: false,
        status: "failed",
        message: `Validatie mislukt: ${err instanceof Error ? err.message : String(err)}`,
        blockerKind: "access_denied",
      };
    }
  },

  async scrape(
    config: PlatformRuntimeConfig,
    options?: { limit?: number },
  ): Promise<PlatformScrapeResult> {
    const { listings, errors } = await scrapeListings(config, options);
    return { listings, errors: errors.length > 0 ? errors : undefined };
  },

  async testImport(
    config: PlatformRuntimeConfig,
    options?: { limit?: number },
  ): Promise<PlatformTestImportResult> {
    const effectiveLimit = options?.limit ?? 3;
    const { listings, errors } = await scrapeListings(config, { limit: effectiveLimit });

    return {
      status: listings.length > 0 ? "success" : "failed",
      jobsFound: listings.length,
      listings: listings.slice(0, effectiveLimit),
      errors: errors.length > 0 ? errors : undefined,
      evidence: {
        totalFound: listings.length,
        strategy: getStrategy(config),
      },
    };
  },
};
