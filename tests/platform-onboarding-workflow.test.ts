import { describe, expect, it } from "vitest";
import {
  canActivatePlatformOnboarding,
  createPlatformOnboardingRunDraft,
  reducePlatformOnboardingRun,
} from "../src/services/platform-onboarding";

describe("platform onboarding workflow", () => {
  it("moves through the happy path for a supported platform", () => {
    const draft = createPlatformOnboardingRunDraft({
      platform: "werkzoeken",
      source: "ui",
      supported: true,
    });

    const afterConfig = reducePlatformOnboardingRun(draft, {
      type: "config_saved",
      configId: "cfg-werkzoeken",
    });
    const afterValidation = reducePlatformOnboardingRun(afterConfig, {
      type: "validated",
      evidence: { access: "ok" },
    });
    const afterSmoke = reducePlatformOnboardingRun(afterValidation, {
      type: "smoke_import_succeeded",
      evidence: { jobsFound: 3 },
    });
    const activated = reducePlatformOnboardingRun(afterSmoke, {
      type: "activated",
    });

    expect(draft.status).toBe("draft");
    expect(afterConfig.currentStep).toBe("validate_access");
    expect(afterValidation.status).toBe("validated");
    expect(afterSmoke.currentStep).toBe("activate");
    expect(activated.status).toBe("active");
    expect(activated.nextActions).toContain("monitor_first_runs");
  });

  it("stops unsupported sources with an explicit needs_implementation state", () => {
    const draft = createPlatformOnboardingRunDraft({
      platform: "exampleboard",
      source: "agent",
      supported: false,
    });

    const blocked = reducePlatformOnboardingRun(draft, {
      type: "unsupported_source_detected",
      blockerKind: "needs_implementation",
      evidence: {
        adapterKind: "novel_markup",
        reason: "No supported adapter kind matched the source",
      },
    });

    expect(blocked.status).toBe("needs_implementation");
    expect(blocked.currentStep).toBe("create_draft");
    expect(blocked.blockerKind).toBe("needs_implementation");
    expect(blocked.nextActions).toContain("capture_follow_up_bead");
  });

  it("only allows activation after a tested run or legacy validated test-import state", () => {
    expect(
      canActivatePlatformOnboarding({
        latestRunStatus: "tested",
      }),
    ).toBe(true);

    expect(
      canActivatePlatformOnboarding({
        latestRunStatus: "failed",
        validationStatus: "validated",
        lastTestImportStatus: "success",
      }),
    ).toBe(false);

    expect(
      canActivatePlatformOnboarding({
        validationStatus: "validated",
        lastTestImportStatus: "partial",
      }),
    ).toBe(true);

    expect(
      canActivatePlatformOnboarding({
        validationStatus: "validated",
        lastTestImportStatus: "failed",
      }),
    ).toBe(false);
  });
});
