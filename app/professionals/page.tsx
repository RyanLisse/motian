import { redirect } from "next/navigation";

/**
 * Legacy route — /professionals is now /kandidaten.
 * Preserves query string for backward-compatible bookmarks and links.
 */
export default async function ProfessionalsRedirect({
  searchParams,
}: {
  searchParams: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = await searchParams;
  const qs = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined) continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) qs.set(key, v);
  }
  const query = qs.toString();
  redirect(`/kandidaten${query ? `?${query}` : ""}`);
}
