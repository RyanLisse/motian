import { logger, metadata, task } from "@trigger.dev/sdk";
import type { PlatformOnboardingSource } from "../src/services/platform-onboarding";
import type { PlatformTestImportResponse } from "../src/services/scrapers";

export const platformOnboardTask = task({
  id: "platform-onboard",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: { platform: string; source: PlatformOnboardingSource }) => {
    // Import services dynamically to avoid circular deps (per institutional learning)
    const { validateConfig, triggerTestRun, activatePlatform, completeOnboarding } = await import(
      "../src/services/scrapers"
    );

    const { platform, source } = payload;

    // Step 1: Validate
    metadata.set("step", "validate");
    metadata.set("platform", platform);
    const validation = await validateConfig(platform, source);
    metadata.set("validationResult", validation.ok ? "passed" : "failed");

    if (!validation.ok) {
      return {
        success: false,
        step: "validate",
        platform,
        validation: { ok: false, message: validation.message },
      };
    }

    // Step 1.5: Verify strategy with multimodal check
    metadata.set("step", "verify_strategy");
    const { verifyPlatformStrategyMultimodal, gateDecision } = await import(
      "../src/services/platform-strategy-verifier"
    );
    const { getConfigByPlatform } = await import("../src/services/scrapers");

    const config = await getConfigByPlatform(platform);
    const strategyParams = config?.parameters as Record<string, unknown> | null;
    const strategy = strategyParams?.scrapingStrategy as Record<string, unknown> | undefined;

    if (config?.baseUrl && strategy) {
      try {
        const verification = await verifyPlatformStrategyMultimodal({
          url: config.baseUrl,
          strategy: strategy as Parameters<typeof verifyPlatformStrategyMultimodal>[0]["strategy"],
        });

        metadata.set("verificationScore", verification.score);
        metadata.set("verificationConfidence", verification.confidence);
        metadata.set("verificationAttempts", verification.attempts);

        const gate = gateDecision(verification);

        if (gate === "block") {
          return {
            success: false,
            step: "verify_strategy",
            platform,
            verification: {
              confidence: verification.confidence,
              score: verification.score,
              issues: verification.issues,
              suggestedFixes: verification.suggestedFixes,
            },
          };
        }

        // Persist corrected strategy if auto-correction improved selectors
        if (verification.correctedStrategy) {
          const { updateConfigParameters } = await import("../src/services/scrapers");
          await updateConfigParameters(platform, {
            scrapingStrategy: verification.correctedStrategy,
          });
          metadata.set("strategyCorrected", true);
        }

        if (gate === "continue_monitored") {
          metadata.set("needsMonitoring", true);
        }
      } catch (err) {
        // Non-fatal — strategy verification failure shouldn't block onboarding
        logger.warn(`[platform-onboard] Strategy verification failed for ${platform}:`, {
          error: err,
        });
        metadata.set("verificationSkipped", true);
      }
    }

    // Step 2: Test import
    metadata.set("step", "test_import");
    const testImport = await triggerTestRun(platform, source, 3);
    metadata.set("testImportResult", testImport.status);
    metadata.set("jobsFound", testImport.jobsFound);

    if (testImport.status === "failed" || testImport.jobsFound === 0) {
      return {
        success: false,
        step: "test_import",
        platform,
        testImport: {
          status: testImport.status,
          jobsFound: testImport.jobsFound,
        },
      };
    }

    // Step 3: Activate
    metadata.set("step", "activate");
    await activatePlatform(platform, source);

    // Step 4: Complete onboarding (emits schedule_verified + first_run_verified)
    metadata.set("step", "complete");
    let completed = true;
    try {
      await completeOnboarding(platform);
    } catch (err) {
      // Non-fatal — platform is already activated, but track the failure
      completed = false;
      logger.error(`[platform-onboard] completeOnboarding failed for ${platform}:`, {
        error: err,
      });
    }

    metadata.set("step", "done");
    return {
      success: true,
      platform,
      validation: { ok: true, message: validation.message },
      testImport: {
        status: testImport.status,
        jobsFound: testImport.jobsFound,
        sampleListings: testImport.listings
          ?.slice(0, 2)
          .map((listing: PlatformTestImportResponse["listings"][number]) => ({
            title: listing.title,
            company: listing.company,
            location: listing.location,
          })),
      },
      activated: true,
      completed,
    };
  },
});
