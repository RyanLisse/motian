import { useIsMobile } from "@/hooks/use-mobile";
import { cn } from "@/lib/utils";
import { formatDateTime } from "@/src/lib/helpers";

export { formatDateTime };

/** Check if tool output is an error response. */
export function isToolError(o: unknown): o is { error: unknown } {
  return typeof o === "object" && o !== null && "error" in o;
}

/** Extract error message string from tool error output. */
export function getToolErrorMessage(o: { error: unknown }, fallback: string): string {
  return typeof o.error === "string" ? o.error : fallback;
}

/** Safely parse a date string or Date to Date | null. */
export function toDate(v: string | Date | null | undefined): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

/** Shared Dutch labels for match statuses. */
export const matchStatusLabels: Record<string, string> = {
  pending: "In afwachting",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
};

/** Shared Dutch labels for pipeline stages. */
export const stageLabels: Record<string, string> = {
  new: "Nieuw",
  screening: "Screening",
  interview: "Interview",
  offer: "Aanbod",
  hired: "Aangenomen",
  rejected: "Afgewezen",
};

/** Shared Dutch labels for platform onboarding steps. */
export const onboardingStepLabels: Record<string, string> = {
  create_draft: "Aanmaken",
  inspect_site: "Analyseren",
  choose_adapter: "Adapter kiezen",
  save_config: "Configureren",
  request_credentials: "Inloggegevens",
  implement_adapter: "Implementeren",
  run_targeted_tests: "Testen",
  validate_access: "Valideren",
  verify_strategy: "Strategie verificatie",
  run_smoke_import: "Testen",
  verify_schedule: "Schema verifiëren",
  monitor_first_runs: "Monitoren",
  // Simplified aliases used by the trigger task
  trigger: "Gestart",
  analyze: "Analyseren",
  configure: "Configureren",
  validate: "Valideren",
  test_import: "Testen",
  activate: "Activeren",
  complete: "Voltooien",
};

/** Shared Dutch labels for platform statuses. */
export const platformStatusLabels: Record<string, string> = {
  draft: "Concept",
  researching: "Onderzoeken",
  config_saved: "Geconfigureerd",
  waiting_for_credentials: "Wacht op inloggegevens",
  waiting_for_external_approval: "Wacht op goedkeuring",
  implementing: "Implementeren",
  implementation_failed: "Implementatie mislukt",
  validated: "Gevalideerd",
  tested: "Getest",
  active: "Actief",
  monitoring: "Monitoren",
  completed: "Voltooid",
  failed: "Mislukt",
  needs_implementation: "Implementatie nodig",
  cancelled: "Geannuleerd",
};

/** Shared touch-target sizing so mobile interactions stay above 44px. */
export const genuiTouchTargetClassName =
  "min-h-11 min-w-11 rounded-md px-3 py-2 text-sm font-medium";

/** Shared inline CTA styling for list expansion and detail disclosure. */
export const genuiInlineActionClassName = cn(
  "inline-flex items-center gap-2 text-left text-primary transition-colors hover:bg-accent hover:text-foreground",
  genuiTouchTargetClassName,
);

/** Shared icon-button sizing for card controls and disclosure toggles. */
export const genuiIconButtonClassName =
  "inline-flex min-h-11 min-w-11 items-center justify-center rounded-full transition-colors";

/** Shared summary row styling for native details/summary disclosure. */
export const genuiDisclosureSummaryClassName = cn(
  "flex w-full cursor-pointer list-none items-center justify-between gap-3 text-left text-sm font-medium text-foreground",
  genuiTouchTargetClassName,
);

/** Shared card text behavior: wrap on mobile, clamp on wider breakpoints only. */
export const genuiMobileWrapClassName = "break-words sm:truncate";

/** Shared one-line copy clamp: full text on mobile, clamp only from small screens upward. */
export const genuiDesktopClampClassName = "break-words sm:line-clamp-1";

/** Use the existing shell/mobile breakpoint for GenUI layout switches. */
export function useGenUIMobile() {
  return useIsMobile();
}
