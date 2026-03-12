import { scrapeFlextender } from "./flextender";
import { scrapeOpdrachtoverheid } from "./opdrachtoverheid";
import { platformDefinitions } from "./platform-definitions";
import { nationaleVacaturebankAdapter } from "./nationalevacaturebank";
import { scrapeStriive } from "./striive";
import type {
  ImplementedPlatformDefinition,
  PlatformAdapter,
  PlatformRuntimeConfig,
  PlatformScrapeResult,
  PlatformTestImportResult,
  PlatformValidationResult,
} from "./types";
import { werkzoekenAdapter } from "./werkzoeken";

function createDirectScrapeAdapter(
  scrape: (baseUrl?: string) => Promise<Record<string, unknown>[]>,
): PlatformAdapter {
  return {
    async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
      if (!config.baseUrl) {
        return {
          ok: false,
          status: "failed",
          message: "Een baseUrl is verplicht voor deze scraper configuratie.",
        };
      }

      return {
        ok: true,
        status: "validated",
        message: "Configuratie is geldig en klaar voor import.",
      };
    },

    async scrape(config: PlatformRuntimeConfig): Promise<PlatformScrapeResult> {
      return {
        listings: await scrape(config.baseUrl),
      };
    },

    async testImport(
      config: PlatformRuntimeConfig,
      options?: { limit?: number },
    ): Promise<PlatformTestImportResult> {
      const listings = await scrape(config.baseUrl);
      return {
        status: listings.length > 0 ? "success" : "failed",
        jobsFound: Math.min(listings.length, options?.limit ?? listings.length),
        listings: listings.slice(0, options?.limit ?? listings.length),
      };
    },
  };
}

const implementedDefinitions: ImplementedPlatformDefinition[] = platformDefinitions.map((definition) => {
  switch (definition.slug) {
    case "flextender":
      return {
        ...definition,
        adapter: createDirectScrapeAdapter(() => scrapeFlextender()),
      };
    case "opdrachtoverheid":
      return {
        ...definition,
        adapter: createDirectScrapeAdapter(() => scrapeOpdrachtoverheid()),
      };
    case "striive":
      return {
        ...definition,
        adapter: createDirectScrapeAdapter((baseUrl) => scrapeStriive(baseUrl ?? definition.defaultBaseUrl)),
      };
    case "nationalevacaturebank":
      return {
        ...definition,
        adapter: nationaleVacaturebankAdapter,
      };
    case "werkzoeken":
      return {
        ...definition,
        adapter: werkzoekenAdapter,
      };
    default:
      throw new Error(`Geen adapter geregistreerd voor platform ${definition.slug}`);
  }
});

const implementedDefinitionMap = new Map(
  implementedDefinitions.map((definition) => [definition.slug, definition]),
);

export { getImplementedPlatformSlugs, getPlatformDefinition, listPlatformDefinitions } from "./platform-definitions";

export function listPlatformCatalogEntries(): ImplementedPlatformDefinition[] {
  return [...implementedDefinitions];
}

export function getPlatformAdapter(slug: string): PlatformAdapter | undefined {
  return implementedDefinitionMap.get(slug)?.adapter;
}

export function getImplementedPlatformDefinition(
  slug: string,
): ImplementedPlatformDefinition | undefined {
  return implementedDefinitionMap.get(slug);
}
