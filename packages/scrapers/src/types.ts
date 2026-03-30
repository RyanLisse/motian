import type { z } from "zod";

/** Shape of a single listing returned by platform scrapers (before normalize). */
export type RawScrapedListing = Record<string, unknown>;

/**
 * Adapter strategy used by a platform scraper.
 *
 * - `http_html_list_detail` — pure HTTP fetch + HTML parse (list page → detail pages).
 * - `browser_bootstrap_http_harvest` — browser renders initial page, then HTTP harvests
 *    detail pages. No dedicated runtime adapter exists; the service layer remaps
 *    this to `ai_dynamic` at runtime (see `src/services/scrapers.ts`).
 * - `api_json` — structured JSON API.
 * - `ai_dynamic` — AI-driven dynamic scraper (fallback for unimplemented adapters).
 */
export type PlatformAdapterKind =
  | "http_html_list_detail"
  | "browser_bootstrap_http_harvest"
  | "api_json"
  | "ai_dynamic";

export type PlatformAuthMode =
  | "none"
  | "api_key"
  | "oauth"
  | "session"
  | "username_password";

export type PlatformCapability =
  | "activation"
  | "configurable_path"
  | "detail_enrichment"
  | "pagination"
  | "smoke_import"
  | "validation";

export type PlatformBlockerKind =
  | "access_denied"
  | "anti_bot_challenge"
  | "consent_required"
  | "needs_implementation"
  | "rate_limited"
  | "selector_drift"
  | "source_url_redirect"
  | "unexpected_markup";

export type PlatformRuntimeConfig = {
  slug: string;
  baseUrl: string;
  parameters: Record<string, unknown>;
  auth: Record<string, unknown>;
  credentialsRef?: string;
};

export type PlatformValidationResult = {
  ok: boolean;
  status: "validated" | "failed" | "needs_implementation";
  message: string;
  blockerKind?: PlatformBlockerKind;
  evidence?: Record<string, unknown>;
};

export type PlatformScrapeResult = {
  listings: RawScrapedListing[];
  errors?: string[];
  evidence?: Record<string, unknown>;
  blockerKind?: PlatformBlockerKind;
};

export type PlatformTestImportResult = {
  status: "success" | "partial" | "failed" | "needs_implementation";
  jobsFound: number;
  listings: RawScrapedListing[];
  errors?: string[];
  blockerKind?: PlatformBlockerKind;
  evidence?: Record<string, unknown>;
};

export interface PlatformAdapter {
  validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult>;
  scrape(
    config: PlatformRuntimeConfig,
    options?: { limit?: number; smoke?: boolean },
  ): Promise<PlatformScrapeResult>;
  testImport(
    config: PlatformRuntimeConfig,
    options?: { limit?: number },
  ): Promise<PlatformTestImportResult>;
}

export type PlatformDefinition = {
  slug: string;
  displayName: string;
  adapterKind: PlatformAdapterKind;
  authMode: PlatformAuthMode;
  attributionLabel: string;
  badgeClassName?: string;
  capabilities: PlatformCapability[];
  description: string;
  docsUrl?: string;
  defaultBaseUrl: string;
  defaultParameters?: Record<string, unknown>;
  configSchema: z.AnyZodObject;
  authSchema: z.ZodTypeAny;
};

export type ImplementedPlatformDefinition = PlatformDefinition & {
  adapter: PlatformAdapter;
};

/** AI-generated scraping strategy from platform analysis. */
export type PlatformAnalysisResult = {
  slug: string;
  displayName: string;
  description: string;
  defaultBaseUrl: string;
  adapterKind: PlatformAdapterKind;
  authMode: PlatformAuthMode;
  capabilities: PlatformCapability[];
  /** AI-inferred scraping configuration stored in parameters. */
  scrapingStrategy: {
    /** How to discover job listing URLs from the main page. */
    listSelector: string;
    /** CSS selector or JSON path for the link to each job detail page. */
    linkSelector: string;
    /** How pagination works on this platform. */
    paginationType: "url_parameter" | "next_link" | "infinite_scroll" | "api_offset" | "none";
    /** Pagination selector or URL pattern (e.g., "?page={n}" or CSS selector for next button). */
    paginationSelector?: string;
    /** Max pages to scrape per run. */
    maxPages: number;
    /** Field mapping: keys are unified job schema fields, values are CSS selectors or JSON paths. */
    fieldMapping: Record<string, string>;
    /** Whether a detail page fetch is needed for full data. */
    needsDetailPage: boolean;
    /** Optional: API endpoint discovered for structured data. */
    apiEndpoint?: string;
    /** Additional notes from AI analysis. */
    notes?: string;
  };
};
