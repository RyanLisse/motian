import type { PlatformBlockerKind } from "@motian/scrapers";

export type PlatformOnboardingSource = "agent" | "cli" | "mcp" | "system" | "ui" | "voice";

export type PlatformOnboardingStep =
  | "create_draft"
  | "inspect_site"
  | "choose_adapter"
  | "save_config"
  | "request_credentials"
  | "implement_adapter"
  | "run_targeted_tests"
  | "validate_access"
  | "run_smoke_import"
  | "activate"
  | "verify_schedule"
  | "monitor_first_runs"
  | "complete";

export type PlatformOnboardingStatus =
  | "draft"
  | "researching"
  | "config_saved"
  | "waiting_for_credentials"
  | "waiting_for_external_approval"
  | "implementing"
  | "implementation_failed"
  | "validated"
  | "tested"
  | "active"
  | "monitoring"
  | "completed"
  | "failed"
  | "cancelled"
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
  | { type: "site_inspected"; evidence?: Record<string, unknown> }
  | { type: "config_saved"; configId: string; evidence?: Record<string, unknown> }
  | { type: "credentials_requested"; evidence?: Record<string, unknown> }
  | { type: "credentials_received"; evidence?: Record<string, unknown> }
  | { type: "external_approval_requested"; evidence?: Record<string, unknown> }
  | { type: "implementation_started"; evidence?: Record<string, unknown> }
  | { type: "implementation_succeeded"; evidence?: Record<string, unknown> }
  | { type: "implementation_failed"; evidence?: Record<string, unknown> }
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
  | { type: "schedule_verified"; evidence?: Record<string, unknown> }
  | { type: "first_run_verified"; evidence?: Record<string, unknown> }
  | { type: "cancelled"; evidence?: Record<string, unknown> }
  | {
      type: "unsupported_source_detected";
      blockerKind: "needs_implementation";
      evidence?: Record<string, unknown>;
    };

function nextActionsFor(status: PlatformOnboardingStatus): string[] {
  switch (status) {
    case "draft":
      return ["inspect_platform", "choose_adapter_kind", "save_config"];
    case "researching":
      return ["capture_site_evidence", "choose_adapter_kind", "request_credentials_if_needed"];
    case "config_saved":
      return ["validate_access"];
    case "waiting_for_credentials":
      return ["collect_credentials_from_user", "resume_onboarding"];
    case "waiting_for_external_approval":
      return ["collect_external_approval", "resume_onboarding"];
    case "implementing":
      return ["generate_adapter_changes", "run_targeted_tests"];
    case "implementation_failed":
      return ["inspect_implementation_failure", "retry_implementation"];
    case "validated":
      return ["run_smoke_import"];
    case "tested":
      return ["activate"];
    case "active":
      return ["verify_schedule", "monitor_first_runs"];
    case "monitoring":
      return ["verify_first_successful_scrape"];
    case "completed":
      return [];
    case "cancelled":
      return ["restart_onboarding"];
    case "needs_implementation":
      return ["collect_live_evidence", "implement_adapter"];
    case "failed":
      return ["inspect_blocker_evidence", "retry_last_step"];
    default:
      return [];
  }
}

function canApplyEvent(
  current: PlatformOnboardingRunState,
  event: PlatformOnboardingEvent,
): boolean {
  switch (event.type) {
    case "site_inspected":
      return ["draft", "researching", "failed", "needs_implementation"].includes(current.status);
    case "config_saved":
      return (
        current.supported &&
        ["draft", "researching", "config_saved", "failed", "waiting_for_credentials"].includes(
          current.status,
        )
      );
    case "credentials_requested":
      return ["draft", "researching", "config_saved", "failed"].includes(current.status);
    case "credentials_received":
      return current.status === "waiting_for_credentials";
    case "external_approval_requested":
      return ["draft", "researching", "config_saved", "failed"].includes(current.status);
    case "implementation_started":
      return ["researching", "draft", "needs_implementation", "implementation_failed"].includes(
        current.status,
      );
    case "implementation_succeeded":
    case "implementation_failed":
      return current.status === "implementing";
    case "validated":
    case "validation_failed":
      return current.supported && ["config_saved", "validated", "failed"].includes(current.status);
    case "smoke_import_succeeded":
    case "smoke_import_failed":
      return current.supported && ["validated", "tested", "failed"].includes(current.status);
    case "activated":
      return current.supported && ["tested", "active"].includes(current.status);
    case "schedule_verified":
      return current.status === "active";
    case "first_run_verified":
      return ["active", "monitoring"].includes(current.status);
    case "cancelled":
      return current.status !== "completed" && current.status !== "cancelled";
    case "unsupported_source_detected":
      return true;
    default:
      return false;
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
    currentStep: input.supported ? "inspect_site" : "create_draft",
    nextActions: input.supported ? nextActionsFor("draft") : nextActionsFor("needs_implementation"),
    blockerKind: input.supported ? null : "needs_implementation",
    evidence: {},
  };
}

export function canActivatePlatformOnboarding(input: {
  isActive?: boolean;
  latestRunStatus?: PlatformOnboardingStatus | null;
  validationStatus?: string | null;
  lastTestImportStatus?: string | null;
}): boolean {
  if (input.isActive) {
    return true;
  }

  if (input.latestRunStatus && input.latestRunStatus !== "draft") {
    return (
      input.latestRunStatus === "tested" ||
      input.latestRunStatus === "active" ||
      input.latestRunStatus === "monitoring" ||
      input.latestRunStatus === "completed"
    );
  }

  // Fallback: allow activation when validation + smoke import both succeeded,
  // even if the onboarding run is still in "draft" status.
  return (
    input.validationStatus === "validated" &&
    (input.lastTestImportStatus === "success" || input.lastTestImportStatus === "partial")
  );
}

export function reducePlatformOnboardingRun(
  current: PlatformOnboardingRunState,
  event: PlatformOnboardingEvent,
): PlatformOnboardingRunState {
  if (!canApplyEvent(current, event)) {
    return current;
  }

  const mergedEvidence = {
    ...current.evidence,
    ...(event.evidence ?? {}),
  };

  switch (event.type) {
    case "site_inspected":
      return {
        ...current,
        status: "researching",
        currentStep: "choose_adapter",
        nextActions: nextActionsFor("researching"),
        blockerKind: null,
        evidence: mergedEvidence,
      };
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
    case "credentials_requested":
      return {
        ...current,
        status: "waiting_for_credentials",
        currentStep: "request_credentials",
        nextActions: nextActionsFor("waiting_for_credentials"),
        evidence: mergedEvidence,
      };
    case "credentials_received":
      return {
        ...current,
        status: "researching",
        currentStep: "save_config",
        nextActions: ["save_config", "validate_access"],
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "external_approval_requested":
      return {
        ...current,
        status: "waiting_for_external_approval",
        currentStep: "inspect_site",
        nextActions: nextActionsFor("waiting_for_external_approval"),
        evidence: mergedEvidence,
      };
    case "implementation_started":
      return {
        ...current,
        status: "implementing",
        currentStep: "implement_adapter",
        nextActions: nextActionsFor("implementing"),
        blockerKind: "needs_implementation",
        evidence: mergedEvidence,
      };
    case "implementation_succeeded":
      return {
        ...current,
        supported: true,
        status: "draft",
        currentStep: "save_config",
        nextActions: ["save_config", "validate_access"],
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "implementation_failed":
      return {
        ...current,
        status: "implementation_failed",
        currentStep: "implement_adapter",
        nextActions: nextActionsFor("implementation_failed"),
        blockerKind: current.blockerKind ?? "needs_implementation",
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
        currentStep: "verify_schedule",
        nextActions: nextActionsFor("active"),
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "schedule_verified":
      return {
        ...current,
        status: "monitoring",
        currentStep: "monitor_first_runs",
        nextActions: nextActionsFor("monitoring"),
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "first_run_verified":
      return {
        ...current,
        status: "completed",
        currentStep: "complete",
        nextActions: nextActionsFor("completed"),
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "cancelled":
      return {
        ...current,
        status: "cancelled",
        currentStep: current.currentStep,
        nextActions: nextActionsFor("cancelled"),
        blockerKind: null,
        evidence: mergedEvidence,
      };
    case "unsupported_source_detected":
      return {
        ...current,
        supported: false,
        status: "needs_implementation",
        currentStep: "implement_adapter",
        nextActions: nextActionsFor("needs_implementation"),
        blockerKind: event.blockerKind,
        evidence: mergedEvidence,
      };
    default:
      return current;
  }
}
