import { tool } from "ai";
import { revalidateTag } from "next/cache";
import { z } from "zod";
import { canActivatePlatformOnboarding } from "@/src/services/platform-onboarding";
import { runScrapePipeline } from "@/src/services/scrape-pipeline";
import { getPlatformOnboardingStatus, listPlatformCatalog } from "@/src/services/scrapers";

type TriggerRecoveryStatus = Awaited<ReturnType<typeof getPlatformOnboardingStatus>>;

function getTriggerRecoveryGuidance(platform: string, status: TriggerRecoveryStatus) {
  const latestRunStatus = (status.latestRun?.status ?? null) as Parameters<
    typeof canActivatePlatformOnboarding
  >[0]["latestRunStatus"];
  const validationStatus = status.config?.validationStatus ?? null;
  const lastTestImportStatus = status.config?.lastTestImportStatus ?? null;
  const latestNextActions = status.latestRun?.nextActions ?? [];
  const canActivate = canActivatePlatformOnboarding({
    isActive: status.config?.isActive,
    latestRunStatus,
    validationStatus,
    lastTestImportStatus,
  });

  if (!status.catalog) {
    return {
      suggestion:
        "Gebruik platformsList om de juiste slug te vinden of start opnieuw met platformAutoSetup.",
      recommendedTools: ["platformsList", "platformAutoSetup"],
      nextActions: ["check_platform_slug", "restart_onboarding"],
    };
  }

  if (!status.config) {
    return {
      suggestion:
        latestRunStatus === "waiting_for_credentials"
          ? `Platform "${platform}" wacht nog op credentials. Rond eerst de credential-stap af en hervat daarna de onboarding.`
          : `Platform "${platform}" heeft nog geen runtime-configuratie. Maak of hervat de configuratie voordat je de scraper start.`,
      recommendedTools:
        latestRunStatus === "waiting_for_credentials"
          ? ["platformOnboardingStatus", "platformConfigCreate"]
          : ["platformConfigCreate", "platformOnboardingStatus"],
      nextActions:
        latestNextActions.length > 0 ? latestNextActions : ["save_config", "resume_onboarding"],
    };
  }

  if (!status.config.isActive) {
    if (canActivate) {
      return {
        suggestion: `Platform "${platform}" is klaar om geactiveerd te worden. Activeer eerst het platform en start daarna opnieuw.`,
        recommendedTools: ["platformActivate", "platformOnboardingStatus"],
        nextActions:
          latestNextActions.length > 0 ? latestNextActions : ["activate", "trigger_scraper"],
      };
    }

    if (validationStatus !== "validated") {
      return {
        suggestion: `Platform "${platform}" is nog niet gevalideerd. Draai eerst een configuratie-validatie en probeer daarna opnieuw.`,
        recommendedTools: ["platformConfigValidate", "platformOnboardingStatus"],
        nextActions:
          latestNextActions.length > 0
            ? latestNextActions
            : ["validate_access", "resume_onboarding"],
      };
    }

    if (lastTestImportStatus !== "success" && lastTestImportStatus !== "partial") {
      return {
        suggestion: `Platform "${platform}" heeft nog geen succesvolle smoke import. Draai eerst een test-import en activeer daarna het platform.`,
        recommendedTools: ["platformTestImport", "platformActivate"],
        nextActions:
          latestNextActions.length > 0 ? latestNextActions : ["run_smoke_import", "activate"],
      };
    }
  }

  if (latestRunStatus === "needs_implementation" || latestRunStatus === "implementation_failed") {
    return {
      suggestion:
        latestRunStatus === "needs_implementation"
          ? `Platform "${platform}" heeft nog een adapter-implementatie nodig. Gebruik platformReanalyze of werk de adapter uit voordat je opnieuw triggert.`
          : `De onboarding voor "${platform}" is vastgelopen tijdens implementatie. Heranalyseer of herstel de adapter voordat je opnieuw triggert.`,
      recommendedTools: ["platformReanalyze", "platformOnboardingStatus"],
      nextActions:
        latestNextActions.length > 0 ? latestNextActions : ["inspect_implementation_failure"],
    };
  }

  return {
    suggestion: `Controleer eerst de onboardingstatus van "${platform}" en hervat de volgende stap voordat je de scraper opnieuw start.`,
    recommendedTools: ["platformOnboardingStatus"],
    nextActions: latestNextActions.length > 0 ? latestNextActions : ["inspect_onboarding_status"],
  };
}

/**
 * Onboarding statuses that indicate the platform-onboard Trigger.dev task is
 * still running or hasn't finished yet. When the scraper is triggered during
 * these states the recruiter should be told to wait rather than getting a
 * confusing "niet actief" error.
 */
const IN_PROGRESS_ONBOARDING_STATUSES = new Set([
  "draft",
  "researching",
  "config_saved",
  "implementing",
  "validated",
  "tested",
]);

export const triggerScraper = tool({
  description:
    "Start een scraper voor een specifiek platform uit de dynamische platformcatalogus. Gebruik platformsList om de actuele platformslugs op te halen. Dit kan even duren (30s-2min). BELANGRIJK: roep deze tool NIET aan direct na platformAutoSetup — de achtergrond-onboarding regelt validatie, test-import en activatie automatisch. Gebruik platformOnboardingStatus om te controleren of het platform al actief is voordat je deze tool aanroept.",
  inputSchema: z.object({
    platform: z.string().describe("Het platform om te scrapen"),
  }),
  execute: async ({ platform }) => {
    const catalog = await listPlatformCatalog();
    const availablePlatforms = catalog.map((entry) => entry.slug);

    if (!availablePlatforms.includes(platform)) {
      return {
        error: `Onbekend platform: ${platform}`,
        availablePlatforms,
        suggestion:
          "Gebruik platformsList om een geldige slug te kiezen of start opnieuw met platformAutoSetup.",
        recommendedTools: ["platformsList", "platformAutoSetup"],
      };
    }

    const status = await getPlatformOnboardingStatus(platform);
    const config = status.config;
    const onboardingStatus = status.latestRun?.status ?? null;

    if (!config) {
      return {
        error: `Geen scraper configuratie gevonden voor ${platform}`,
        platform,
        onboardingStatus,
        ...getTriggerRecoveryGuidance(platform, status),
      };
    }

    if (!config.isActive) {
      // Detect in-progress onboarding and give a clear "please wait" message
      // instead of a confusing "niet actief" error.
      if (onboardingStatus && IN_PROGRESS_ONBOARDING_STATUSES.has(onboardingStatus)) {
        return {
          error: `Platform "${platform}" is nog bezig met onboarding (status: ${onboardingStatus}). De achtergrond-taak regelt validatie, test-import en activatie automatisch.`,
          platform,
          onboardingStatus,
          currentStep: status.latestRun?.currentStep ?? null,
          suggestion:
            "Wacht tot de onboarding is afgerond. Gebruik platformOnboardingStatus om de voortgang te controleren. Het platform wordt automatisch actief na succesvolle onboarding.",
          recommendedTools: ["platformOnboardingStatus"],
          nextActions: ["wait_for_onboarding", "check_status"],
        };
      }

      return {
        error: `Scraper voor ${platform} is niet actief`,
        platform,
        onboardingStatus,
        validationStatus: config.validationStatus ?? null,
        lastTestImportStatus: config.lastTestImportStatus ?? null,
        ...getTriggerRecoveryGuidance(platform, status),
      };
    }

    const result = await runScrapePipeline(platform, config.baseUrl);

    // Revalidate cached pages so UI reflects new data
    revalidateTag("jobs", "default");
    revalidateTag("scrape-results", "default");
    revalidateTag("scrapers", "default");

    return {
      platform,
      jobsNew: result.jobsNew,
      duplicates: result.duplicates,
      errors: result.errors.length > 0 ? result.errors : undefined,
      status: result.errors.length === 0 ? "success" : "partial",
    };
  },
});
