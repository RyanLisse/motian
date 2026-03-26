import { dynamicAdapter } from "./dynamic-adapter";
import { scrapeFlextender } from "./flextender";
import { mipublicAdapter } from "./mipublic";
import { monsterboardAdapter } from "./monsterboard";
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
  options: {
    requiresRuntimeBaseUrl?: boolean;
    validationMessage?: string;
  } = {},
): PlatformAdapter {
  const requiresRuntimeBaseUrl = options.requiresRuntimeBaseUrl ?? true;

  return {
    async validate(config: PlatformRuntimeConfig): Promise<PlatformValidationResult> {
      if (requiresRuntimeBaseUrl && !config.baseUrl) {
        return {
          ok: false,
          status: "failed",
          message: "Een baseUrl is verplicht voor deze scraper configuratie.",
        };
      }

      return {
        ok: true,
        status: "validated",
        message: options.validationMessage ?? "Configuratie is geldig en klaar voor import.",
      };
    },

    async scrape(config: PlatformRuntimeConfig): Promise<PlatformScrapeResult> {
      return {
        listings: await scrape(requiresRuntimeBaseUrl ? config.baseUrl : undefined),
      };
    },

    async testImport(
      config: PlatformRuntimeConfig,
      options?: { limit?: number },
    ): Promise<PlatformTestImportResult> {
      const listings = await scrape(requiresRuntimeBaseUrl ? config.baseUrl : undefined);
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
        adapter: createDirectScrapeAdapter(() => scrapeFlextender(), {
          requiresRuntimeBaseUrl: false,
          validationMessage:
            "Configuratie is geldig. Flextender gebruikt een vaste bron-URL tijdens runtime.",
        }),
      };
    case "opdrachtoverheid":
      return {
        ...definition,
        adapter: createDirectScrapeAdapter(() => scrapeOpdrachtoverheid(), {
          requiresRuntimeBaseUrl: false,
          validationMessage:
            "Configuratie is geldig. Opdrachtoverheid gebruikt een vaste API-bron tijdens runtime.",
        }),
      };
    case "mipublic":
      return {
        ...definition,
        adapter: mipublicAdapter,
      };
    case "striive":
      return {
        ...definition,
        adapter: createDirectScrapeAdapter(
          (baseUrl) => scrapeStriive(baseUrl ?? definition.defaultBaseUrl),
          {
            requiresRuntimeBaseUrl: true,
          },
        ),
      };
    case "nationalevacaturebank":
      return {
        ...definition,
        adapter: nationaleVacaturebankAdapter,
      };
    case "monsterboard":
      return {
        ...definition,
        adapter: monsterboardAdapter,
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

/**
 * Get the adapter for a platform.
 * For hardcoded platforms, returns the specific adapter.
 * For ai_dynamic platforms (not in the hardcoded list), returns the dynamic adapter.
 */
export function getPlatformAdapter(slug: string): PlatformAdapter | undefined {
  const implemented = implementedDefinitionMap.get(slug)?.adapter;
  if (implemented) return implemented;

  // Dynamic platforms are resolved at runtime — the dynamic adapter is returned
  // for any platform that has a scrapingStrategy in its config parameters.
  // The caller (scrape-pipeline) will pass the config with the strategy.
  return undefined;
}

/**
 * Get the dynamic adapter for AI-analyzed platforms.
 * This is used by the scrape pipeline when a platform has adapterKind "ai_dynamic"
 * in the platform_catalog table but no hardcoded adapter.
 */
export function getDynamicAdapter(): PlatformAdapter {
  return dynamicAdapter;
}

export function getImplementedPlatformDefinition(
  slug: string,
): ImplementedPlatformDefinition | undefined {
  return implementedDefinitionMap.get(slug);
}
