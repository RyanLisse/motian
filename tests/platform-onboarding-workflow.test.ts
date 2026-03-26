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

    const afterInspection = reducePlatformOnboardingRun(draft, {
      type: "site_inspected",
      evidence: { adapterKind: "http_html_list_detail" },
    });
    const afterConfig = reducePlatformOnboardingRun(afterInspection, {
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
    const scheduleVerified = reducePlatformOnboardingRun(activated, {
      type: "schedule_verified",
      evidence: { cronExpression: "0 0 */4 * * *" },
    });
    const completed = reducePlatformOnboardingRun(scheduleVerified, {
      type: "first_run_verified",
      evidence: { runId: "scrape-1", jobsFound: 3 },
    });

    expect(draft.status).toBe("draft");
    expect(draft.currentStep).toBe("inspect_site");
    expect(afterInspection.status).toBe("researching");
    expect(afterConfig.currentStep).toBe("validate_access");
    expect(afterValidation.status).toBe("validated");
    expect(afterSmoke.currentStep).toBe("activate");
    expect(activated.status).toBe("active");
    expect(activated.currentStep).toBe("verify_schedule");
    expect(activated.nextActions).toContain("verify_schedule");
    expect(scheduleVerified.status).toBe("monitoring");
    expect(completed.status).toBe("completed");
    expect(completed.nextActions).toEqual([]);
  });

  it("routes unsupported sources into implementation work instead of a dead-end handoff", () => {
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
    expect(blocked.currentStep).toBe("implement_adapter");
    expect(draft.nextActions).toContain("implement_adapter");
    expect(blocked.blockerKind).toBe("needs_implementation");
    expect(blocked.nextActions).toContain("implement_adapter");
  });

  it("ignores invalid rollout transitions for unsupported drafts", () => {
    const draft = createPlatformOnboardingRunDraft({
      platform: "unsupportedboard",
      source: "ui",
      supported: false,
    });

    const invalidTransition = reducePlatformOnboardingRun(draft, {
      type: "config_saved",
      configId: "cfg-unsupported",
    });

    expect(invalidTransition).toEqual(draft);
  });

  it("supports credential pause and resume within the shared onboarding run", () => {
    const draft = createPlatformOnboardingRunDraft({
      platform: "striive",
      source: "agent",
      supported: true,
    });

    const afterInspection = reducePlatformOnboardingRun(draft, {
      type: "site_inspected",
      evidence: { loginRequired: true },
    });
    const waiting = reducePlatformOnboardingRun(afterInspection, {
      type: "credentials_requested",
      evidence: { authMode: "username_password" },
    });
    const resumed = reducePlatformOnboardingRun(waiting, {
      type: "credentials_received",
      evidence: { credentialsRef: "op://motian/striive" },
    });

    expect(waiting.status).toBe("waiting_for_credentials");
    expect(waiting.currentStep).toBe("request_credentials");
    expect(resumed.status).toBe("researching");
    expect(resumed.currentStep).toBe("save_config");
    expect(resumed.nextActions).toContain("save_config");
  });

  it("supports implementation retries before returning to the normal onboarding path", () => {
    const draft = createPlatformOnboardingRunDraft({
      platform: "exampleboard",
      source: "agent",
      supported: false,
    });

    const blocked = reducePlatformOnboardingRun(draft, {
      type: "unsupported_source_detected",
      blockerKind: "needs_implementation",
      evidence: { adapterKind: "novel_markup" },
    });
    const implementing = reducePlatformOnboardingRun(blocked, {
      type: "implementation_started",
      evidence: { branchName: "codex/exampleboard" },
    });
    const failed = reducePlatformOnboardingRun(implementing, {
      type: "implementation_failed",
      evidence: { reason: "selector drift" },
    });
    const retrying = reducePlatformOnboardingRun(failed, {
      type: "implementation_started",
      evidence: { branchName: "codex/exampleboard-retry" },
    });
    const succeeded = reducePlatformOnboardingRun(retrying, {
      type: "implementation_succeeded",
      evidence: { adapterFile: "packages/scrapers/src/exampleboard.ts" },
    });

    expect(implementing.status).toBe("implementing");
    expect(implementing.currentStep).toBe("implement_adapter");
    expect(failed.status).toBe("implementation_failed");
    expect(failed.nextActions).toContain("retry_implementation");
    expect(succeeded.supported).toBe(true);
    expect(succeeded.status).toBe("draft");
    expect(succeeded.currentStep).toBe("save_config");
  });

  it("only allows activation after a tested run or legacy validated test-import state", () => {
    expect(
      canActivatePlatformOnboarding({
        latestRunStatus: "tested",
      }),
    ).toBe(true);

    expect(
      canActivatePlatformOnboarding({
        latestRunStatus: "completed",
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
