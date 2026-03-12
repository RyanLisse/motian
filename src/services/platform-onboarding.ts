import type { PlatformBlockerKind } from "@motian/scrapers";

export type PlatformOnboardingSource = "agent" | "cli" | "mcp" | "system" | "ui" | "voice";

export type PlatformOnboardingStep =
  | "create_draft"
  | "choose_adapter"
  | "save_config"
  | "validate_access"
  | "run_smoke_import"
  | "activate"
  | "monitor_first_runs";

export type PlatformOnboardingStatus =
  | "draft"
  | "config_saved"
  | "validated"
  | "tested"
  | "active"
  | "failed"
  | "needs_implementation";

export type PlatformOnboardingRunState = {
  platform: string;
  source: PlatformOnboardingSource;
  supported: boolean;
  status: PlatformOnboardingStatus;
  currentStep: PlatformOnboardingStep;
  nextActions: string[];
  blockerKind: PlatformBlockerKind | null;
  configId?: string;
  evidence: Record<string, unknown>;
};

export type PlatformOnboardingEvent =
  | { type: "config_saved"; configId: string; evidence?: Record<string, unknown> }
  | { type: "validated"; evidence?: Record<string, unknown> }
  | {
      type: "validation_failed";
      blockerKind: PlatformBlockerKind;
      evidence?: Record<string, unknown>;
    }
  | { type: "smoke_import_succeeded"; evidence?: Record<string, unknown> }
  | {
      type: "smoke_import_failed";
      blockerKind?: PlatformBlockerKind;
      evidence?: Record<string, unknown>;
    }
  | { type: "activated"; evidence?: Record<string, unknown> }
  | {
      type: "unsupported_source_detected";
      blockerKind: "needs_implementation";
      evidence?: Record<string, unknown>;
    };

function nextActionsFor(status: PlatformOnboardingStatus): string[] {
  switch (status) {
    case "draft":
      return ["choose_adapter_kind", "save_config"];
    case "config_saved":
      return ["validate_access"];
    case "validated":
      return ["run_smoke_import"];
    case "tested":
      return ["activate"];
    case "active":
      return ["monitor_first_runs"];
    case "needs_implementation":
      return ["capture_follow_up_bead", "collect_live_evidence"];
    case "failed":
      return ["inspect_blocker_evidence", "retry_last_step"];
    default:
      return [];
  }
}

export function createPlatformOnboardingRunDraft(input: {
  platform: string;
  source: PlatformOnboardingSource;
  supported: boolean;
}): PlatformOnboardingRunState {
  return {
    platform: input.platform,
    source: input.source,
    supported: input.supported,
    status: "draft",
    currentStep: input.supported ? "choose_adapter" : "create_draft",
    nextActions: nextActionsFor("draft"),
    blockerKind: null,
    evidence: {},
  };
}

export function reducePlatformOnboardingRun(
  current: PlatformOnboardingRunState,
  event: PlatformOnboardingEvent,
): PlatformOnboardingRunState {
  const mergedEvidence = {
    ...current.evidence,
    ...(event.evidence ?? {}),
  };

  switch (event.type) {
    case "config_saved":
      return {
        ...current,
        configId: event.configId,
        status: "config_saved",
        currentStep: "validate_access",
        nextActions: nextActionsFor("config_saved"),
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "validated":
      return {
        ...current,
        status: "validated",
        currentStep: "run_smoke_import",
        nextActions: nextActionsFor("validated"),
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "validation_failed":
      return {
        ...current,
        status: "failed",
        currentStep: "validate_access",
        nextActions: nextActionsFor("failed"),
        blockerKind: event.blockerKind,
        evidence: mergedEvidence,
      };
    case "smoke_import_succeeded":
      return {
        ...current,
        status: "tested",
        currentStep: "activate",
        nextActions: nextActionsFor("tested"),
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "smoke_import_failed":
      return {
        ...current,
        status: "failed",
        currentStep: "run_smoke_import",
        nextActions: nextActionsFor("failed"),
        blockerKind: event.blockerKind ?? null,
        evidence: mergedEvidence,
      };
    case "activated":
      return {
        ...current,
        status: "active",
        currentStep: "monitor_first_runs",
        nextActions: nextActionsFor("active"),
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "unsupported_source_detected":
      return {
        ...current,
        supported: false,
        status: "needs_implementation",
        currentStep: "monitor_first_runs",
        nextActions: nextActionsFor("needs_implementation"),
        blockerKind: event.blockerKind,
        evidence: mergedEvidence,
      };
    default:
      return current;
  }
}
