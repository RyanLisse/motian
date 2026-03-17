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
