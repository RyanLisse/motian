import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockActivatePlatform,
  mockCompleteOnboarding,
  mockGetConfigByPlatform,
  mockRecordPlatformOnboardingEvent,
  mockTriggerTestRun,
  mockUpdateConfigParameters,
  mockValidateConfig,
  mockGateDecision,
  mockVerifyPlatformStrategyMultimodal,
} = vi.hoisted(() => ({
  mockActivatePlatform: vi.fn(),
  mockCompleteOnboarding: vi.fn(),
  mockGetConfigByPlatform: vi.fn(),
  mockRecordPlatformOnboardingEvent: vi.fn(),
  mockTriggerTestRun: vi.fn(),
  mockUpdateConfigParameters: vi.fn(),
  mockValidateConfig: vi.fn(),
  mockGateDecision: vi.fn(),
  mockVerifyPlatformStrategyMultimodal: vi.fn(),
}));

vi.mock("@trigger.dev/sdk", () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
  },
  metadata: {
    set: vi.fn(),
  },
  task: <T extends object>(definition: T) => definition,
}));

vi.mock("../src/services/scrapers", () => ({
  activatePlatform: mockActivatePlatform,
  completeOnboarding: mockCompleteOnboarding,
  getConfigByPlatform: mockGetConfigByPlatform,
  recordPlatformOnboardingEvent: mockRecordPlatformOnboardingEvent,
  triggerTestRun: mockTriggerTestRun,
  updateConfigParameters: mockUpdateConfigParameters,
  validateConfig: mockValidateConfig,
}));

vi.mock("../src/services/platform-strategy-verifier", () => ({
  gateDecision: mockGateDecision,
  verifyPlatformStrategyMultimodal: mockVerifyPlatformStrategyMultimodal,
}));

import { platformOnboardTask } from "../trigger/platform-onboard";

type PlatformOnboardTask = {
  run: (payload: {
    platform: string;
    source: "agent" | "ui" | "cli" | "mcp" | "system" | "voice";
  }) => Promise<Record<string, unknown>>;
};

const taskUnderTest = platformOnboardTask as unknown as PlatformOnboardTask;

describe("platformOnboardTask", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockValidateConfig.mockResolvedValue({ ok: true, message: "valid" });
    mockGetConfigByPlatform.mockResolvedValue({
      id: "cfg-1",
      baseUrl: "https://platform.example/jobs",
      parameters: {
        scrapingStrategy: {
          listingPath: ".listing",
        },
      },
    });
  });

  it("persists a strategy verification failure before returning a blocked result", async () => {
    mockVerifyPlatformStrategyMultimodal.mockResolvedValue({
      confidence: "low",
      score: 0.2,
      attempts: 1,
      issues: ["selector drift"],
      suggestedFixes: ["check listing selector"],
      correctedStrategy: undefined,
    });
    mockGateDecision.mockReturnValue("block");

    const result = await taskUnderTest.run({
      platform: "example-platform",
      source: "agent",
    });

    expect(mockRecordPlatformOnboardingEvent).toHaveBeenCalledWith({
      platform: "example-platform",
      source: "agent",
      configId: "cfg-1",
      event: {
        type: "strategy_verification_failed",
        evidence: {
          confidence: "low",
          score: 0.2,
          issues: ["selector drift"],
          suggestedFixes: ["check listing selector"],
        },
      },
    });
    expect(result).toMatchObject({
      success: false,
      step: "verify_strategy",
      platform: "example-platform",
    });
    expect(mockTriggerTestRun).not.toHaveBeenCalled();
  });

  it("records a successful strategy verification before continuing onboarding", async () => {
    mockVerifyPlatformStrategyMultimodal.mockResolvedValue({
      confidence: "medium",
      score: 0.78,
      attempts: 2,
      issues: [],
      suggestedFixes: [],
      correctedStrategy: undefined,
    });
    mockGateDecision.mockReturnValue("continue_monitored");
    mockTriggerTestRun.mockResolvedValue({
      status: "success",
      jobsFound: 2,
      listings: [],
    });
    mockActivatePlatform.mockResolvedValue(undefined);
    mockCompleteOnboarding.mockResolvedValue(undefined);

    const result = await taskUnderTest.run({
      platform: "example-platform",
      source: "agent",
    });

    expect(mockRecordPlatformOnboardingEvent).toHaveBeenCalledWith({
      platform: "example-platform",
      source: "agent",
      configId: "cfg-1",
      event: {
        type: "strategy_verified",
        confidence: "medium",
        score: 0.78,
        evidence: {
          attempts: 2,
          issues: [],
          suggestedFixes: [],
          corrected: false,
        },
      },
    });
    expect(result).toMatchObject({
      success: true,
      platform: "example-platform",
      activated: true,
    });
  });
});
