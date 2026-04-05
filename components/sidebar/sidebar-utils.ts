/**
 * Utility functions for the opdrachten sidebar.
 */
import type { useRouter } from "next/navigation";
import { buildOpdrachtenFilterHref } from "@/src/lib/opdrachten-filter-url";
import { DEFAULT_OPDRACHTEN_LIMIT } from "@/src/lib/opdrachten-filters";
import type {
  FilterOverrideValue,
  SearchJobsParams,
  SearchResponse,
  SearchResponsePayload,
  SidebarJob,
} from "./sidebar-types";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

export function hasUrgentDeadline(deadline?: Date | string | null) {
  if (!deadline) return false;

  const parsedDeadline = new Date(deadline);
  if (Number.isNaN(parsedDeadline.getTime())) return false;

  const remainingDays = Math.ceil((parsedDeadline.getTime() - Date.now()) / DAY_IN_MS);
  return remainingDays >= 0 && remainingDays <= 3;
}

export function pushOpdrachtenParams(
  searchParams: URLSearchParams,
  router: ReturnType<typeof useRouter>,
  pathname: string,
  overrides: Record<string, FilterOverrideValue>,
) {
  router.push(buildOpdrachtenFilterHref(pathname, searchParams, overrides));
}

export function toggleFilterValue(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

export function summarizeSelection(label: string, selectedLabels: string[]) {
  if (selectedLabels.length === 0) return label;
  if (selectedLabels.length === 1) return selectedLabels[0] ?? label;
  return `${label} (${selectedLabels.length})`;
}

export function summarizeHoursRange(minValue: string, maxValue: string) {
  if (!minValue && !maxValue) return "Alle uren";
  return `${minValue || "0"} - ${maxValue || "onbeperkt"} uur`;
}

function isSidebarJob(value: unknown): value is SidebarJob {
  if (!value || typeof value !== "object") return false;

  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate.id === "string" &&
    typeof candidate.title === "string" &&
    typeof candidate.platform === "string"
  );
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === "number" && Number.isFinite(value);
}

export function parseSearchResponse(payload: SearchResponsePayload): SearchResponse {
  if (
    !Array.isArray(payload.jobs) ||
    !payload.jobs.every(isSidebarJob) ||
    !isFiniteNumber(payload.total) ||
    !isFiniteNumber(payload.page) ||
    !isFiniteNumber(payload.perPage) ||
    !isFiniteNumber(payload.totalPages)
  ) {
    throw new Error("Ongeldig zoekresultaat ontvangen.");
  }

  const jobs = payload.jobs as SidebarJob[];
  const total = payload.total as number;
  const page = payload.page as number;
  const perPage = payload.perPage as number;
  const totalPages = payload.totalPages as number;

  return {
    jobs,
    total,
    page,
    perPage,
    totalPages,
  };
}

async function getSearchErrorMessage(response: Response) {
  try {
    const payload = (await response.json()) as { error?: string };
    if (typeof payload.error === "string" && payload.error.trim()) {
      return payload.error.trim();
    }
  } catch {
    // Ignore non-JSON or malformed error payloads and fall back to the status-based message below.
  }

  return `Zoeken mislukt (${response.status}).`;
}

export async function searchJobs({
  q,
  platforms,
  endClient,
  vaardigheid,
  status,
  provincie,
  regios,
  vakgebieden,
  urenPerWeek,
  urenPerWeekMin,
  urenPerWeekMax,
  straalKm,
  contractType,
  tariefMin,
  tariefMax,
  sort,
  page,
  limit,
  signal,
}: SearchJobsParams & { signal?: AbortSignal }): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  platforms.forEach((platform) => {
    params.append("platform", platform);
  });
  if (endClient) params.set("endClient", endClient);
  if (vaardigheid) params.set("vaardigheid", vaardigheid);
  if (status !== "open") params.set("status", status);
  if (provincie) params.set("provincie", provincie);
  regios.forEach((regio) => {
    params.append("regio", regio);
  });
  vakgebieden.forEach((vakgebied) => {
    params.append("vakgebied", vakgebied);
  });
  if (urenPerWeek) params.set("urenPerWeek", urenPerWeek);
  if (urenPerWeekMin) params.set("urenPerWeekMin", urenPerWeekMin);
  if (urenPerWeekMax) params.set("urenPerWeekMax", urenPerWeekMax);
  if (straalKm) params.set("straalKm", straalKm);
  if (contractType) params.set("contractType", contractType);
  if (tariefMin) params.set("tariefMin", tariefMin);
  if (tariefMax) params.set("tariefMax", tariefMax);
  if (sort && sort !== "nieuwste") params.set("sort", sort);
  if (page > 1) params.set("pagina", String(page));
  if (limit !== DEFAULT_OPDRACHTEN_LIMIT) params.set("limit", String(limit));

  const res = await fetch(`/api/vacatures/zoeken?${params.toString()}`, {
    signal,
  });
  if (!res.ok) {
    throw new Error(await getSearchErrorMessage(res));
  }

  return parseSearchResponse((await res.json()) as SearchResponsePayload);
}
