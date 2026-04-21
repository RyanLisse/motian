import { OPDRACHTEN_PROVINCES } from "@/src/lib/opdrachten-filters";

/**
 * Maps a free-text location input to the province filter value.
 * Returns the matched province when the input equals one of
 * OPDRACHTEN_PROVINCES (case-insensitive), or null when the input
 * is empty. Returns undefined when the input is non-empty but does
 * not match any province — callers should treat this as a no-op.
 */
export function resolveLocationInputToProvince(value: string): string | null | undefined {
  const trimmed = value.trim();
  if (!trimmed) return null;
  const normalized = trimmed.toLowerCase();
  return OPDRACHTEN_PROVINCES.find((p) => p.toLowerCase() === normalized);
}
