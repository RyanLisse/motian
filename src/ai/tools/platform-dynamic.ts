import { tool } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { analyzePlatform } from "@/src/services/platform-analyzer";
import { createPlatformCatalogEntry, runPlatformOnboardingWorkflow } from "@/src/services/scrapers";

export const platformAnalyze = tool({
  description:
    "Analyseer een job platform URL met AI om automatisch de beste scraping strategie te bepalen. Geeft slug, veldmapping, paginatie en adapter-advies terug. Gebruik dit als eerste stap bij het toevoegen van een nieuw platform.",
  inputSchema: z.object({
    url: z
      .string()
      .url()
      .describe("De URL van het job platform om te analyseren (bijv. de vacaturepagina)"),
  }),
  execute: async ({ url }) => {
    const analysis = await analyzePlatform(url);
    return {
      success: true,
      analysis: {
        slug: analysis.slug,
        displayName: analysis.displayName,
        description: analysis.description,
        defaultBaseUrl: analysis.defaultBaseUrl,
        adapterKind: analysis.adapterKind,
        authMode: analysis.authMode,
        capabilities: analysis.capabilities,
        scrapingStrategy: analysis.scrapingStrategy,
      },
      nextStep:
        "Gebruik platformAutoSetup met deze gegevens om het platform volledig in te richten, of gebruik platformCatalogCreate en platformConfigCreate om handmatig in te richten.",
    };
  },
});

export const platformAutoSetup = tool({
  description:
    "Richt een nieuw platform volledig automatisch in op basis van een URL. Voert analyse, catalogus-aanmaak, configuratie, validatie, test-import en activatie uit in één stap. De agent hoeft alleen een URL te geven.",
  inputSchema: z.object({
    url: z
      .string()
      .url()
      .describe("De URL van het job platform (bijv. de vacature-overzichtspagina)"),
    activate: z
      .boolean()
      .optional()
      .default(true)
      .describe("Automatisch activeren na succesvolle test-import (standaard: ja)"),
  }),
  execute: async ({ url, activate }) => {
    // Step 1: Analyze the platform
    let analysis: Awaited<ReturnType<typeof analyzePlatform>>;
    try {
      analysis = await analyzePlatform(url);
    } catch (err) {
      return {
        success: false,
        step: "analyze",
        error: `Platform analyse mislukt: ${err instanceof Error ? err.message : String(err)}`,
        suggestion: "Controleer of de URL toegankelijk is en probeer het opnieuw.",
      };
    }

    // Step 2: Create catalog entry
    try {
      await createPlatformCatalogEntry({
        slug: analysis.slug,
        displayName: analysis.displayName,
        adapterKind: analysis.adapterKind,
        authMode: analysis.authMode,
        attributionLabel: analysis.displayName,
        description: analysis.description,
        defaultBaseUrl: analysis.defaultBaseUrl,
        capabilities: analysis.capabilities,
        source: "agent",
      });
    } catch (err) {
      return {
        success: false,
        step: "catalog_create",
        error: `Catalogus aanmaken mislukt: ${err instanceof Error ? err.message : String(err)}`,
        analysis,
      };
    }

    // Step 3: Run the full onboarding workflow (config + validate + test + activate)
    try {
      const result = await runPlatformOnboardingWorkflow({
        source: "agent",
        config: {
          platform: analysis.slug,
          baseUrl: analysis.defaultBaseUrl,
          parameters: {
            scrapingStrategy: analysis.scrapingStrategy,
            maxPages: analysis.scrapingStrategy.maxPages,
          },
          source: "agent",
        },
        activate,
      });

      revalidateTag("scrapers", "default");
      revalidateTag("jobs", "default");

      return {
        success: true,
        platform: analysis.slug,
        displayName: analysis.displayName,
        adapterKind: analysis.adapterKind,
        validation: {
          ok: result.validation.ok,
          message: result.validation.message,
        },
        testImport: {
          status: result.testImport.status,
          jobsFound: result.testImport.jobsFound,
          sampleListings: result.testImport.listings.slice(0, 2).map((l) => ({
            title: l.title,
            company: l.company,
            location: l.location,
            externalUrl: l.externalUrl,
          })),
        },
        activated: result.activated,
        scrapingStrategy: analysis.scrapingStrategy,
        nextSteps: result.activated
          ? [
              "Platform is actief en wordt automatisch gescrapet volgens het cron-schema.",
              "Gebruik triggerScraper om direct een scrape te starten.",
              "Monitor via platformOnboardingStatus of het scraper-dashboard.",
            ]
          : [
              "Validatie of test-import is niet volledig geslaagd.",
              "Controleer platformOnboardingStatus voor details.",
              "Pas de configuratie aan met platformConfigUpdate indien nodig.",
            ],
      };
    } catch (err) {
      revalidateTag("scrapers", "default");

      return {
        success: false,
        step: "onboarding_workflow",
        error: `Onboarding workflow mislukt: ${err instanceof Error ? err.message : String(err)}`,
        platform: analysis.slug,
        analysis,
        suggestion:
          "Het platform is aangemaakt in de catalogus. Probeer handmatig: platformConfigCreate → platformConfigValidate → platformTestImport → platformActivate.",
      };
    }
  },
});
