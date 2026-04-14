/**
 * Normalise an external URL so it is safe to render as an `<a href>`.
 *
 * - Returns `null` for falsy / blank inputs.
 * - Prepends `https://` when no protocol is present.
 * - Strips trailing slashes for a cleaner display.
 */
export function normalizeExternalUrl(raw: string | null | undefined): string | null {
  if (!raw) return null;
  const trimmed = raw.trim();
  if (trimmed.length === 0) return null;

  const candidate = /^https?:\/\//i.test(trimmed) ? trimmed : `https://${trimmed}`;
  let parsed: URL;
  try {
    parsed = new URL(candidate);
  } catch {
    return null;
  }
  if (!parsed.hostname) return null;

  // Strip a single trailing slash for display, but leave paths intact.
  if (parsed.pathname === "/" && !parsed.search && !parsed.hash) {
    return `${parsed.protocol}//${parsed.host}`;
  }

  return parsed.toString();
}
