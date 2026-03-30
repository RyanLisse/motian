import { tool } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { analyzePlatform } from "@/src/services/platform-analyzer";
import {
  completeOnboarding,
  createConfig,
  createPlatformCatalogEntry,
  getPlatformByBaseUrl,
  runPlatformOnboardingWorkflow,
  validateExternalUrl,
} from "@/src/services/scrapers";

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
    credentials: z
      .record(z.string())
      .optional()
      .describe(
        "Login-gegevens voor platforms die authenticatie vereisen (bijv. { username: '...', password: '...' })",
      ),
  }),
  execute: async ({ url, activate, credentials }) => {
    // Step 0a: SSRF validation
    try {
      await validateExternalUrl(url);
    } catch (err) {
      return {
        success: false,
        step: "ssrf_check",
        error: err instanceof Error ? err.message : "URL validatie mislukt",
      };
    }

    // Step 0b: Dedup check — bail early if platform already exists
    const existing = await getPlatformByBaseUrl(url);
    if (existing) {
      return {
        status: "exists" as const,
        platform: existing.slug,
        displayName: existing.displayName,
        isActive: existing.isEnabled ?? false,
        message: existing.isEnabled
          ? `Platform "${existing.displayName}" is al actief. Gebruik platformConfigUpdate om de configuratie aan te passen.`
          : `Platform "${existing.displayName}" bestaat al maar is niet actief. Gebruik platformActivate om te activeren.`,
      };
    }

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

    // Step 2b: Credential gate — if auth required but no credentials provided, pause
    if (analysis.authMode !== "none" && analysis.authMode !== "api_key" && !credentials) {
      // Create a stub config so POST /api/platforms/[slug]/credentials has a row to update
      try {
        await createConfig({
          platform: analysis.slug,
          baseUrl: analysis.defaultBaseUrl,
          parameters: { scrapingStrategy: analysis.scrapingStrategy },
          source: "agent",
        });
      } catch {
        // Config may already exist from a prior attempt — non-fatal
      }
      revalidateTag("scrapers", "default");

      return {
        status: "credentials_needed" as const,
        platform: analysis.slug,
        displayName: analysis.displayName,
        authMode: analysis.authMode,
        fields:
          analysis.authMode === "session" || analysis.authMode === "username_password"
            ? [
                { name: "username", label: "Gebruikersnaam", type: "text" as const },
                { name: "password", label: "Wachtwoord", type: "password" as const },
              ]
            : [{ name: "apiKey", label: "API-sleutel", type: "password" as const }],
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
          ...(credentials ? { authConfig: credentials } : {}),
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

export const platformCompleteOnboarding = tool({
  description:
    "Markeer een platform onboarding als voltooid nadat de eerste scrape succesvol is uitgevoerd. Verplaatst de status naar 'completed'.",
  inputSchema: z.object({
    platform: z.string().min(1).describe("Platform slug"),
  }),
  execute: async ({ platform }) => {
    await completeOnboarding(platform);
    revalidateTag("scrapers", "default");
    return { success: true, platform, status: "completed" };
  },
});
