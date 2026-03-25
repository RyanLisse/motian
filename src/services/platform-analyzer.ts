import type { PlatformAnalysisResult } from "@motian/scrapers";
import { z } from "zod";
import { geminiFlash, tracedGenerateObject as generateObject } from "../lib/ai-models";

const FIRECRAWL_API_URL = "https://api.firecrawl.dev/v1/scrape";

/** Fetch page content via Firecrawl for anti-bot bypass and JS rendering. */
async function fetchPageViaFirecrawl(url: string): Promise<{ html: string; markdown: string }> {
  const apiKey = process.env.FIRECRAWL_API_KEY;
  if (!apiKey) {
    throw new Error("FIRECRAWL_API_KEY niet geconfigureerd — kan pagina niet ophalen voor analyse");
  }

  const response = await fetch(FIRECRAWL_API_URL, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      url,
      formats: ["html", "markdown"],
      waitFor: 3000,
      timeout: 30000,
    }),
  });

  if (!response.ok) {
    throw new Error(`Firecrawl fout bij ophalen ${url}: HTTP ${response.status}`);
  }

  const data = (await response.json()) as {
    success: boolean;
    data?: { html?: string; markdown?: string };
  };

  if (!data.success || !data.data) {
    throw new Error(`Firecrawl retourneerde geen data voor ${url}`);
  }

  return {
    html: data.data.html ?? "",
    markdown: data.data.markdown ?? "",
  };
}

/** Fallback: fetch page directly without Firecrawl. */
async function fetchPageDirect(url: string): Promise<{ html: string; markdown: string }> {
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
    throw new Error(`Direct fetch mislukt voor ${url}: HTTP ${response.status}`);
  }

  const html = await response.text();
  return { html, markdown: "" };
}

const analysisResultSchema = z.object({
  slug: z.string().min(1).describe("URL-safe lowercase slug for the platform (e.g., 'indeed-nl')"),
  displayName: z.string().min(1).describe("Human-readable platform name"),
  description: z.string().describe("Brief Dutch description of the platform and its content"),
  adapterKind: z
    .enum(["http_html_list_detail", "api_json", "browser_bootstrap_http_harvest", "ai_dynamic"])
    .describe("Recommended adapter kind based on page analysis"),
  authMode: z
    .enum(["none", "api_key", "oauth", "session", "username_password"])
    .describe("Authentication mode required"),
  capabilities: z.array(z.string()).describe("Platform capabilities detected"),
  scrapingStrategy: z.object({
    listSelector: z
      .string()
      .describe(
        "CSS selector for the container or repeated elements that represent job listings on the list page",
      ),
    linkSelector: z
      .string()
      .describe("CSS selector for the link to each individual job detail page"),
    paginationType: z
      .enum(["url_parameter", "next_link", "infinite_scroll", "api_offset", "none"])
      .describe("How pagination works on this platform"),
    paginationSelector: z
      .string()
      .optional()
      .describe('Pagination CSS selector or URL pattern (e.g., "?page={n}")'),
    maxPages: z.number().int().min(1).max(100).describe("Recommended max pages to scrape per run"),
    fieldMapping: z
      .record(z.string())
      .describe(
        "Maps unified job schema fields (title, company, location, description, externalUrl, externalId, rateMin, rateMax, contractType, startDate, endDate) to CSS selectors on the detail page",
      ),
    needsDetailPage: z
      .boolean()
      .describe("Whether a separate detail page fetch is needed for complete job data"),
    apiEndpoint: z
      .string()
      .optional()
      .describe("API endpoint discovered in page source (JSON API, GraphQL, etc.)"),
    notes: z
      .string()
      .optional()
      .describe("Additional observations about the platform structure, anti-bot measures, etc."),
  }),
});

/**
 * Analyze a job platform URL using Firecrawl + AI to determine the optimal
 * scraping strategy and generate a complete platform configuration.
 */
export async function analyzePlatform(url: string): Promise<PlatformAnalysisResult> {
  // Try Firecrawl first, fall back to direct fetch
  let pageContent: { html: string; markdown: string };
  try {
    pageContent = await fetchPageViaFirecrawl(url);
  } catch {
    pageContent = await fetchPageDirect(url);
  }

  // Truncate HTML to avoid token limits (keep first 30k chars which covers most listing pages)
  const truncatedHtml = pageContent.html.slice(0, 30_000);
  const truncatedMarkdown = pageContent.markdown.slice(0, 15_000);

  const { object } = await generateObject({
    model: geminiFlash,
    schema: analysisResultSchema,
    prompt: `You are an expert web scraper analyst. Analyze this job platform page and determine the optimal scraping strategy.

SOURCE URL: ${url}

PAGE HTML (truncated):
\`\`\`html
${truncatedHtml}
\`\`\`

${truncatedMarkdown ? `PAGE CONTENT (markdown):\n${truncatedMarkdown}\n` : ""}

TASK:
1. Identify the platform name, create a URL-safe slug, and write a brief Dutch description
2. Analyze the page structure to find:
   - How job listings are displayed (cards, table rows, list items)
   - CSS selectors for listing containers and individual job links
   - Pagination mechanism (URL params, next buttons, infinite scroll, API)
   - Whether full job data is on the list page or requires detail page visits
3. For each job listing, map the available data fields to the unified schema:
   - Required: title, externalId, externalUrl
   - Important: company, location, description, rateMin, rateMax
   - Optional: contractType, startDate, endDate, hoursPerWeek, requirements
4. Check for API endpoints in page source (look for fetch/XHR calls, JSON-LD, data attributes)
5. Assess anti-bot measures, login requirements, consent walls
6. Recommend the best adapter kind:
   - "api_json" if a clean JSON API is available
   - "http_html_list_detail" if standard HTML with simple HTTP requests works
   - "browser_bootstrap_http_harvest" if browser rendering is needed for initial load but data can then be harvested via HTTP
   - "ai_dynamic" if the structure is complex/non-standard and AI extraction would be most reliable

IMPORTANT:
- CSS selectors should be specific enough to target job data reliably
- For fieldMapping, provide CSS selectors that work on the DETAIL page if needsDetailPage is true, or on list items if not
- For externalId, use a selector or strategy that extracts a unique identifier (URL slug, data attribute, etc.)
- The slug should be lowercase, URL-safe, and descriptive (e.g., "indeed-nl", "hays-nederland")
- Description should be in Dutch
- Be conservative with maxPages — start with 3-5 for unknown platforms`,
  });

  return {
    ...object,
    defaultBaseUrl: new URL(url).origin,
    capabilities: object.capabilities as PlatformAnalysisResult["capabilities"],
    scrapingStrategy: {
      ...object.scrapingStrategy,
      paginationType: object.scrapingStrategy
        .paginationType as PlatformAnalysisResult["scrapingStrategy"]["paginationType"],
    },
  };
}
