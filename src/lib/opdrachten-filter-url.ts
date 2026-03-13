export const OPDRACHTEN_PARAM_ALIASES: Record<string, string[]> = {
  pagina: ["page"],
  limit: ["perPage"],
  provincie: ["province"],
  regio: ["region"],
  vakgebied: ["category"],
  urenPerWeek: ["hours"],
  urenPerWeekMin: ["hoursMin"],
  urenPerWeekMax: ["hoursMax"],
  straalKm: ["radiusKm"],
};

export type OpdrachtenFilterOverrideValue = string | string[];

function normalizeOverrideEntry(value: string) {
  const normalized = value.trim();
  return normalized.length > 0 ? normalized : undefined;
}

export function getOpdrachtenBasePath(pathname: string) {
  if (pathname === "/vacatures" || pathname === "/vacatures/") return "/vacatures";
  if (pathname.startsWith("/vacatures/")) return pathname;

  if (pathname === "/opdrachten" || pathname === "/opdrachten/") return "/opdrachten";
  if (pathname.startsWith("/opdrachten/")) {
    return pathname;
  }

  return "/opdrachten";
}

export function applyOpdrachtenFilterOverrides(
  searchParams: URLSearchParams,
  overrides: Record<string, OpdrachtenFilterOverrideValue>,
) {
  const nextParams = new URLSearchParams(searchParams.toString());

  for (const [key, value] of Object.entries(overrides)) {
    nextParams.delete(key);

    for (const alias of OPDRACHTEN_PARAM_ALIASES[key] ?? []) {
      nextParams.delete(alias);
    }

    if (Array.isArray(value)) {
      [
        ...new Set(
          value.map(normalizeOverrideEntry).filter((item): item is string => Boolean(item)),
        ),
      ].forEach((item) => {
        nextParams.append(key, item);
      });
      continue;
    }

    const normalizedValue = normalizeOverrideEntry(value);

    if (normalizedValue) {
      nextParams.set(key, normalizedValue);
    }
  }

  return nextParams;
}

export function buildOpdrachtenFilterHref(
  pathname: string,
  searchParams: URLSearchParams,
  overrides: Record<string, OpdrachtenFilterOverrideValue>,
) {
  const nextParams = applyOpdrachtenFilterOverrides(searchParams, overrides);
  const query = nextParams.toString();
  const basePath = getOpdrachtenBasePath(pathname);

  return query ? `${basePath}?${query}` : basePath;
}
