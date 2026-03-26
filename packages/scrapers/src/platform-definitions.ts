import { z } from "zod";
import type { PlatformDefinition } from "./types";

const emptyAuthSchema = z.object({}).default({});

const basicPlatformConfigSchema = z.object({
  baseUrl: z.string().url(),
  parameters: z.record(z.unknown()).default({}),
});

const striiveConfigSchema = z.object({
  baseUrl: z.string().url(),
  parameters: z
    .object({
      maxPages: z.number().int().min(1).max(25).optional(),
      detailDelayMs: z.number().int().min(0).max(5_000).optional(),
    })
    .default({}),
});

const striiveAuthSchema = z.object({
  username: z.string().min(1),
  password: z.string().min(1),
});

const nvbConfigSchema = z.object({
  baseUrl: z.string().url(),
  parameters: z
    .object({
      sourcePath: z.string().default("/vacatures/branche/ict"),
      maxPages: z.number().int().min(1).max(20).default(3),
      detailLimit: z.number().int().min(1).max(50).default(10),
      detailConcurrency: z.number().int().min(1).max(10).default(3),
      useBrowserBootstrap: z.boolean().default(true),
    })
    .default({}),
});

const nvbAuthSchema = z
  .object({
    consentProfile: z.enum(["minimal"]).default("minimal"),
  })
  .default({ consentProfile: "minimal" });

const werkzoekenConfigSchema = z.object({
  baseUrl: z.string().url(),
  parameters: z
    .object({
      sourcePath: z.string().default("/vacatures-voor/techniek/"),
      maxPages: z.number().int().min(1).max(1500).default(1300),
      detailConcurrency: z.number().int().min(1).max(10).default(4),
      skipDetailEnrichment: z.boolean().default(false),
    })
    .default({}),
});

const mipublicConfigSchema = z.object({
  baseUrl: z.string().url(),
  parameters: z
    .object({
      sitemapPath: z.string().default("/vacature-sitemap.xml"),
      detailConcurrency: z.number().int().min(1).max(8).default(4),
      maxListings: z.number().int().min(1).max(500).optional(),
    })
    .default({}),
});

export const platformDefinitions: PlatformDefinition[] = [
  {
    slug: "flextender",
    displayName: "Flextender",
    adapterKind: "http_html_list_detail",
    authMode: "none",
    attributionLabel: "Flextender",
    badgeClassName: "border-sky-500/20 bg-sky-500/10 text-sky-600 dark:text-sky-400",
    capabilities: ["detail_enrichment", "smoke_import", "validation"],
    description: "Publieke Flextender opdrachten via widget/AJAX scraping.",
    defaultBaseUrl: "https://www.flextender.nl/opdrachten/",
    configSchema: basicPlatformConfigSchema,
    authSchema: emptyAuthSchema,
  },
  {
    slug: "mipublic",
    displayName: "MiPublic",
    adapterKind: "http_html_list_detail",
    authMode: "none",
    attributionLabel: "MiPublic",
    badgeClassName: "border-cyan-500/20 bg-cyan-500/10 text-cyan-700 dark:text-cyan-300",
    capabilities: ["detail_enrichment", "pagination", "smoke_import", "validation"],
    description:
      "Publieke WordPress vacaturebron met Yoast sitemap en JobPosting JSON-LD op detailpagina's.",
    defaultBaseUrl: "https://mipublic.nl",
    defaultParameters: {
      sitemapPath: "/vacature-sitemap.xml",
      detailConcurrency: 4,
    },
    docsUrl: "https://mipublic.nl/vacature-sitemap.xml",
    configSchema: mipublicConfigSchema,
    authSchema: emptyAuthSchema,
  },
  {
    slug: "opdrachtoverheid",
    displayName: "Opdrachtoverheid",
    adapterKind: "api_json",
    authMode: "none",
    attributionLabel: "Opdrachtoverheid",
    badgeClassName: "border-amber-500/20 bg-amber-500/10 text-amber-600 dark:text-amber-400",
    capabilities: ["pagination", "smoke_import", "validation"],
    description: "Publieke JSON API voor overheidsopdrachten.",
    defaultBaseUrl: "https://www.opdrachtoverheid.nl/",
    configSchema: basicPlatformConfigSchema,
    authSchema: emptyAuthSchema,
  },
  {
    slug: "striive",
    displayName: "Striive",
    adapterKind: "browser_bootstrap_http_harvest",
    authMode: "username_password",
    attributionLabel: "Striive",
    badgeClassName: "border-violet-500/20 bg-violet-500/10 text-violet-600 dark:text-violet-400",
    capabilities: ["detail_enrichment", "smoke_import", "validation"],
    description: "Supplier portal scraping met Playwright login en API harvest.",
    defaultBaseUrl: "https://supplier.striive.com/jobrequests/list",
    configSchema: striiveConfigSchema,
    authSchema: striiveAuthSchema,
  },
  {
    slug: "monsterboard",
    displayName: "Monsterboard",
    adapterKind: "http_html_list_detail",
    authMode: "none",
    attributionLabel: "Monsterboard",
    badgeClassName: "border-fuchsia-500/20 bg-fuchsia-500/10 text-fuchsia-600 dark:text-fuchsia-400",
    capabilities: ["detail_enrichment", "smoke_import", "validation"],
    description:
      "Publiek job board met JSON-LD detailpagina's en expliciete anti-bot blokkadeherkenning.",
    defaultBaseUrl: "https://www.monsterboard.nl/vacatures/",
    docsUrl: "https://www.monsterboard.nl/vacatures/",
    configSchema: basicPlatformConfigSchema,
    authSchema: emptyAuthSchema,
  },
  {
    slug: "nationalevacaturebank",
    displayName: "Nationale Vacaturebank",
    adapterKind: "browser_bootstrap_http_harvest",
    authMode: "session",
    attributionLabel: "Nationale Vacaturebank",
    badgeClassName: "border-rose-500/20 bg-rose-500/10 text-rose-600 dark:text-rose-400",
    capabilities: [
      "configurable_path",
      "detail_enrichment",
      "pagination",
      "smoke_import",
      "validation",
    ],
    description: "Publiek job board met DPG consent bootstrap en daarna goedkope request harvest.",
    defaultBaseUrl: "https://www.nationalevacaturebank.nl",
    defaultParameters: {
      sourcePath: "/vacatures/branche/ict",
      maxPages: 3,
      detailLimit: 10,
      detailConcurrency: 3,
      useBrowserBootstrap: true,
    },
    docsUrl: "https://www.nationalevacaturebank.nl/vacatures/branche/ict",
    configSchema: nvbConfigSchema,
    authSchema: nvbAuthSchema,
  },
  {
    slug: "werkzoeken",
    displayName: "Werkzoeken",
    adapterKind: "http_html_list_detail",
    authMode: "none",
    attributionLabel: "Werkzoeken.nl",
    badgeClassName: "border-emerald-500/20 bg-emerald-500/10 text-emerald-600 dark:text-emerald-400",
    capabilities: [
      "configurable_path",
      "detail_enrichment",
      "pagination",
      "smoke_import",
      "validation",
    ],
    description:
      "Publieke SSR vacaturekaartjes met configureerbare categoriepaden. Werkzoeken heeft daarnaast een aparte publisher API op /doc/ met Bearer API-key auth.",
    defaultBaseUrl: "https://www.werkzoeken.nl",
    defaultParameters: {
      sourcePath: "/vacatures-voor/techniek/",
      maxPages: 1300,
      detailConcurrency: 4,
      skipDetailEnrichment: false,
    },
    docsUrl: "https://www.werkzoeken.nl/doc/",
    configSchema: werkzoekenConfigSchema,
    authSchema: emptyAuthSchema,
  },
];

const platformDefinitionMap = new Map(platformDefinitions.map((entry) => [entry.slug, entry]));

export function listPlatformDefinitions(): PlatformDefinition[] {
  return [...platformDefinitions];
}

export function getPlatformDefinition(slug: string): PlatformDefinition | undefined {
  return platformDefinitionMap.get(slug);
}

export function getImplementedPlatformSlugs(): string[] {
  return platformDefinitions.map((entry) => entry.slug);
}
