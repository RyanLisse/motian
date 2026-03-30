import { tasks } from "@trigger.dev/sdk";
import { tool } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { analyzePlatform } from "@/src/services/platform-analyzer";
import {
  completeOnboarding,
  createConfig,
  createPlatformCatalogEntry,
  getConfigByPlatform,
  getPlatformByBaseUrl,
  getPlatformCatalogEntry,
  getPlatformOnboardingStatus,
  updateConfigParameters,
  validateExternalUrl,
} from "@/src/services/scrapers";
import type { platformOnboardTask } from "@/trigger/platform-onboard";

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

function getCredentialFields(authMode: "oauth" | "session" | "username_password") {
  switch (authMode) {
    case "session":
    case "username_password":
      return [
        { name: "username", label: "Gebruikersnaam", type: "text" as const },
        { name: "password", label: "Wachtwoord", type: "password" as const },
      ];
    case "oauth":
      return [
        { name: "accessToken", label: "Access-token", type: "password" as const },
        { name: "refreshToken", label: "Refresh-token", type: "password" as const },
      ];
  }
}

export const platformAutoSetup = tool({
  description:
    "Richt een nieuw platform volledig automatisch in op basis van een URL. Voert analyse, catalogus-aanmaak, configuratie, validatie, test-import en activatie uit in één stap. De agent hoeft alleen een URL te geven.",
  inputSchema: z.object({
    url: z
      .string()
      .url()
      .describe("De URL van het job platform (bijv. de vacature-overzichtspagina)"),
  }),
  execute: async ({ url }) => {
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
      // If platform is stuck on needs_implementation, suggest re-analyze
      const status = await getPlatformOnboardingStatus(existing.slug);
      const latestStatus = status.latestRun?.status;

      return {
        status: "exists" as const,
        platform: existing.slug,
        displayName: existing.displayName,
        isActive: existing.isEnabled ?? false,
        message: existing.isEnabled
          ? `Platform "${existing.displayName}" is al actief. Gebruik platformConfigUpdate om de configuratie aan te passen.`
          : latestStatus === "needs_implementation" || latestStatus === "failed"
            ? `Platform "${existing.displayName}" bestaat maar is vastgelopen (${latestStatus}). Gebruik platformReanalyze om de configuratie te herstellen.`
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

    // Step 2b: Credential gate — if auth required, always pause for secure credential collection
    //          Credentials flow through the GenUI form → POST /api/platforms/[slug]/credentials
    if (analysis.authMode !== "none" && analysis.authMode !== "api_key") {
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
        fields: getCredentialFields(analysis.authMode),
      };
    }

    // Step 3: Create config and trigger background onboarding via Trigger.dev
    try {
      await createConfig({
        platform: analysis.slug,
        baseUrl: analysis.defaultBaseUrl,
        parameters: {
          scrapingStrategy: analysis.scrapingStrategy,
          maxPages: analysis.scrapingStrategy.maxPages,
        },
        source: "agent",
      });
    } catch {
      // Config may already exist from a prior attempt — non-fatal
    }

    try {
      const handle = await tasks.trigger<typeof platformOnboardTask>("platform-onboard", {
        platform: analysis.slug,
        source: "agent",
      });

      revalidateTag("scrapers", "default");

      return {
        status: "onboarding_triggered" as const,
        platform: analysis.slug,
        displayName: analysis.displayName,
        adapterKind: analysis.adapterKind,
        runId: handle.id,
        scrapingStrategy: analysis.scrapingStrategy,
        message: `Onboarding voor "${analysis.displayName}" is gestart op de achtergrond. Gebruik platformOnboardingStatus om de voortgang te volgen.`,
      };
    } catch (err) {
      revalidateTag("scrapers", "default");

      return {
        success: false,
        step: "trigger",
        error: `Onboarding task starten mislukt: ${err instanceof Error ? err.message : String(err)}`,
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
    const status = await getPlatformOnboardingStatus(platform);
    const latestRunStatus = status.latestRun?.status ?? "unknown";

    if (latestRunStatus !== "active") {
      throw new Error(
        `Platform ${platform} kan onboarding niet voltooien vanuit status "${latestRunStatus}".`,
      );
    }

    await completeOnboarding(platform);
    revalidateTag("scrapers", "default");
    return { success: true, platform, status: "completed" };
  },
});

export const platformReanalyze = tool({
  description:
    "Heranalyseer een bestaand platform dat vastzit op 'needs_implementation' of waarvan de selectors niet meer werken. Voert een nieuwe AI-analyse uit, updatet de configuratie, en start de onboarding opnieuw op de achtergrond.",
  inputSchema: z.object({
    platform: z.string().min(1).describe("Platform slug (bijv. starapple-nl)"),
  }),
  execute: async ({ platform }) => {
    // Step 1: Verify platform exists
    const catalog = await getPlatformCatalogEntry(platform);
    if (!catalog) {
      return {
        success: false,
        error: `Platform "${platform}" niet gevonden in de catalogus.`,
      };
    }

    // Step 2: Get the config to find the baseUrl
    const config = await getConfigByPlatform(platform);
    const baseUrl = config?.baseUrl ?? catalog.defaultBaseUrl;

    if (!baseUrl) {
      return {
        success: false,
        error: `Geen base URL gevonden voor "${platform}". Gebruik platformAutoSetup met een URL.`,
      };
    }

    // Step 3: Re-run AI analysis on the live page
    let analysis: Awaited<ReturnType<typeof analyzePlatform>>;
    try {
      analysis = await analyzePlatform(baseUrl);
    } catch (err) {
      return {
        success: false,
        step: "reanalyze",
        error: `Heranalyse mislukt: ${err instanceof Error ? err.message : String(err)}`,
        suggestion: "Controleer of de URL nog toegankelijk is.",
      };
    }

    // Step 4: Update config with new strategy
    try {
      if (config) {
        await updateConfigParameters(platform, {
          scrapingStrategy: analysis.scrapingStrategy,
          maxPages: analysis.scrapingStrategy.maxPages,
        });
      } else {
        await createConfig({
          platform,
          baseUrl,
          parameters: {
            scrapingStrategy: analysis.scrapingStrategy,
            maxPages: analysis.scrapingStrategy.maxPages,
          },
          source: "agent",
        });
      }
    } catch (err) {
      return {
        success: false,
        step: "update_config",
        error: `Config update mislukt: ${err instanceof Error ? err.message : String(err)}`,
      };
    }

    // Step 5: Trigger background onboarding
    try {
      const handle = await tasks.trigger<typeof platformOnboardTask>("platform-onboard", {
        platform,
        source: "agent",
      });

      revalidateTag("scrapers", "default");

      return {
        status: "onboarding_triggered" as const,
        platform,
        displayName: catalog.displayName ?? analysis.displayName,
        runId: handle.id,
        scrapingStrategy: analysis.scrapingStrategy,
        message: `Heranalyse voltooid — nieuwe selectors gevonden. Onboarding voor "${catalog.displayName ?? platform}" is opnieuw gestart. Gebruik platformOnboardingStatus om de voortgang te volgen.`,
      };
    } catch (err) {
      revalidateTag("scrapers", "default");

      return {
        success: false,
        step: "trigger",
        error: `Onboarding task starten mislukt: ${err instanceof Error ? err.message : String(err)}`,
        analysis,
      };
    }
  },
});
