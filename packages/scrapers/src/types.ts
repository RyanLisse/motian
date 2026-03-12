import type { z } from "zod";

/** Shape of a single listing returned by platform scrapers (before normalize). */
export type RawScrapedListing = Record<string, unknown>;

export type PlatformAdapterKind =
  | "http_html_list_detail"
  | "browser_bootstrap_http_harvest"
  | "api_json";

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
