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

/** Format a date string for display in Dutch locale. */
export function formatDateTime(v: string | Date | null | undefined): string | null {
  const d = toDate(v);
  if (!d) return null;
  return d.toLocaleDateString("nl-NL", {
    weekday: "short",
    day: "numeric",
    month: "short",
    hour: "2-digit",
    minute: "2-digit",
  });
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
  run_smoke_import: "Testen",
  verify_schedule: "Schema verifiëren",
  monitor_first_runs: "Monitoren",
  // Simplified aliases used by the trigger task
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
