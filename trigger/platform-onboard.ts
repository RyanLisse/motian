import { metadata, task } from "@trigger.dev/sdk";
import type { PlatformOnboardingSource } from "../src/services/platform-onboarding";

export const platformOnboardTask = task({
  id: "platform-onboard",
  retry: {
    maxAttempts: 2,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30_000,
  },
  run: async (payload: {
    platform: string;
    configId: number;
    source: PlatformOnboardingSource;
  }) => {
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
    try {
      await completeOnboarding(platform);
    } catch (err) {
      // Non-fatal — platform is already activated
      console.error(`[platform-onboard] completeOnboarding failed for ${platform}:`, err);
    }

    metadata.set("step", "done");
    const listings = testImport.listings?.slice(0, 2) ?? [];
    return {
      success: true,
      platform,
      validation: { ok: true, message: validation.message },
      testImport: {
        status: testImport.status,
        jobsFound: testImport.jobsFound,
        sampleListings: listings.map((l) => ({
          title: String(l.title ?? ""),
          company: l.company != null ? String(l.company) : undefined,
          location: l.location != null ? String(l.location) : undefined,
        })),
      },
      activated: true,
      completed: true,
    };
  },
});
