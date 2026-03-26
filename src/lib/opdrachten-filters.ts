import { z } from "zod";

export const DEFAULT_OPDRACHTEN_LIMIT = 50;
export const MAX_OPDRACHTEN_LIMIT = 100;
export const OPDRACHTEN_PAGE_SIZE_OPTIONS = [10, 25, 50, 100] as const;

export const OPDRACHTEN_PROVINCES = [
  "Noord-Holland",
  "Zuid-Holland",
  "Utrecht",
  "Noord-Brabant",
  "Gelderland",
  "Overijssel",
  "Limburg",
  "Friesland",
  "Groningen",
  "Drenthe",
  "Flevoland",
  "Zeeland",
] as const;

export type OpdrachtenProvince = (typeof OPDRACHTEN_PROVINCES)[number];

export const OPDRACHTEN_REGION_OPTIONS = [
  { value: "randstad", label: "Randstad" },
  { value: "noord", label: "Noord-Nederland" },
  { value: "oost", label: "Oost-Nederland" },
  { value: "zuid", label: "Zuid-Nederland" },
] as const;

export type OpdrachtenRegion = (typeof OPDRACHTEN_REGION_OPTIONS)[number]["value"];

const OPDRACHTEN_REGION_PROVINCES: Record<OpdrachtenRegion, readonly OpdrachtenProvince[]> = {
  randstad: ["Noord-Holland", "Zuid-Holland", "Utrecht", "Flevoland"],
  noord: ["Groningen", "Friesland", "Drenthe"],
  oost: ["Gelderland", "Overijssel"],
  zuid: ["Noord-Brabant", "Limburg", "Zeeland"],
};

export const OPDRACHTEN_HOURS_OPTIONS = [
  { value: "tot_24", label: "Tot 24 uur", min: 0, max: 24 },
  { value: "24_32", label: "24 - 32 uur", min: 24, max: 32 },
  { value: "32_40", label: "32 - 40 uur", min: 32, max: 40 },
  { value: "40_plus", label: "40+ uur", min: 40 },
] as const;

export type OpdrachtenHoursBucket = (typeof OPDRACHTEN_HOURS_OPTIONS)[number]["value"];

export const OPDRACHTEN_RADIUS_OPTIONS = [10, 25, 50, 75, 100] as const;

export const OPDRACHTEN_SORT_OPTIONS = [
  { value: "nieuwste", label: "Onlangs toegevoegd" },
  { value: "deadline", label: "Sluitingsdatum oplopend" },
  { value: "deadline_desc", label: "Sluitingsdatum aflopend" },
  { value: "relevantie", label: "Relevantie" },
] as const;

export type OpdrachtenSort = (typeof OPDRACHTEN_SORT_OPTIONS)[number]["value"];

export const OPDRACHTEN_STATUS_OPTIONS = ["open", "closed", "archived", "all"] as const;

export type OpdrachtenStatus = (typeof OPDRACHTEN_STATUS_OPTIONS)[number];

type ProvinceAnchor = {
  label: string;
  latitude: number;
  longitude: number;
};

const PROVINCE_ANCHORS: Record<OpdrachtenProvince, ProvinceAnchor> = {
  "Noord-Holland": { label: "Haarlem", latitude: 52.3874, longitude: 4.6462 },
  "Zuid-Holland": { label: "Den Haag", latitude: 52.0705, longitude: 4.3007 },
  Utrecht: { label: "Utrecht", latitude: 52.0907, longitude: 5.1214 },
  "Noord-Brabant": { label: "'s-Hertogenbosch", latitude: 51.6978, longitude: 5.3037 },
  Gelderland: { label: "Arnhem", latitude: 51.9851, longitude: 5.8987 },
  Overijssel: { label: "Zwolle", latitude: 52.5168, longitude: 6.083 },
  Limburg: { label: "Maastricht", latitude: 50.8514, longitude: 5.6909 },
  Friesland: { label: "Leeuwarden", latitude: 53.2012, longitude: 5.7999 },
  Groningen: { label: "Groningen", latitude: 53.2194, longitude: 6.5665 },
  Drenthe: { label: "Assen", latitude: 52.9928, longitude: 6.5624 },
  Flevoland: { label: "Lelystad", latitude: 52.5185, longitude: 5.4714 },
  Zeeland: { label: "Middelburg", latitude: 51.4988, longitude: 3.61 },
};

const provinceLookup = new Map(
  OPDRACHTEN_PROVINCES.map((province) => [province.toLowerCase(), province]),
);

const regionLookup = new Map(
  OPDRACHTEN_REGION_OPTIONS.map((option) => [option.value.toLowerCase(), option.value]),
);

const hoursLookup = new Map(
  OPDRACHTEN_HOURS_OPTIONS.map((option) => [option.value.toLowerCase(), option.value]),
);

const sortLookup = new Map(
  OPDRACHTEN_SORT_OPTIONS.map((option) => [option.value.toLowerCase(), option.value]),
);

function optionalQueryString(maxLength = 255) {
  return z.preprocess((value) => {
    if (value == null) return undefined;
    if (typeof value !== "string") return value;
    const normalized = value.trim();
    return normalized.length > 0 ? normalized : undefined;
  }, z.string().max(maxLength).optional());
}

function optionalQueryStringArray(maxLength = 255) {
  return z.preprocess((value) => {
    if (value == null) return undefined;
    const values = (Array.isArray(value) ? value : [value])
      .filter((candidate): candidate is string => typeof candidate === "string")
      .map((candidate) => candidate.trim())
      .filter(Boolean);

    return values.length > 0 ? values : undefined;
  }, z.array(z.string().max(maxLength)).optional());
}

function optionalQueryNumber() {
  return z.preprocess((value) => {
    if (value == null || value === "") return undefined;
    if (typeof value === "number") return value;
    if (typeof value !== "string") return Number.NaN;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, z.number().finite().optional());
}

function optionalPositiveIntegerQueryNumber() {
  return z.preprocess((value) => {
    if (value == null || value === "") return undefined;
    if (typeof value === "number") return value;
    if (typeof value !== "string") return Number.NaN;
    const parsed = Number(value);
    return Number.isFinite(parsed) ? parsed : Number.NaN;
  }, z.number().int().positive().optional());
}

export const opdrachtenQuerySchema = z.object({
  q: optionalQueryString(200),
  platform: optionalQueryString(100),
  endClient: optionalQueryString(200),
  vaardigheid: optionalQueryString(255),
  escoUri: optionalQueryString(255),
  status: optionalQueryString(32),
  provincie: optionalQueryString(64),
  province: optionalQueryString(64),
  regio: optionalQueryStringArray(64),
  region: optionalQueryStringArray(64),
  vakgebied: optionalQueryStringArray(100),
  category: optionalQueryStringArray(100),
  urenPerWeek: optionalQueryString(32),
  hours: optionalQueryString(32),
  urenPerWeekMin: optionalPositiveIntegerQueryNumber(),
  hoursMin: optionalPositiveIntegerQueryNumber(),
  urenPerWeekMax: optionalPositiveIntegerQueryNumber(),
  hoursMax: optionalPositiveIntegerQueryNumber(),
  straalKm: optionalPositiveIntegerQueryNumber(),
  radiusKm: optionalPositiveIntegerQueryNumber(),
  tariefMin: optionalQueryNumber(),
  tariefMax: optionalQueryNumber(),
  contractType: optionalQueryString(64),
  sort: optionalQueryString(32),
  pagina: optionalPositiveIntegerQueryNumber(),
  page: optionalPositiveIntegerQueryNumber(),
  limit: optionalPositiveIntegerQueryNumber(),
  perPage: optionalPositiveIntegerQueryNumber(),
});

export function validateOpdrachtenQueryParams(params: URLSearchParams) {
  return opdrachtenQuerySchema.safeParse({
    q: params.get("q") ?? undefined,
    platform: params.get("platform") ?? undefined,
    endClient: params.get("endClient") ?? undefined,
    vaardigheid: params.get("vaardigheid") ?? undefined,
    escoUri: params.get("escoUri") ?? undefined,
    status: params.get("status") ?? undefined,
    provincie: params.get("provincie") ?? undefined,
    province: params.get("province") ?? undefined,
    regio: params.getAll("regio"),
    region: params.getAll("region"),
    vakgebied: params.getAll("vakgebied"),
    category: params.getAll("category"),
    urenPerWeek: params.get("urenPerWeek") ?? undefined,
    hours: params.get("hours") ?? undefined,
    urenPerWeekMin: params.get("urenPerWeekMin") ?? undefined,
    hoursMin: params.get("hoursMin") ?? undefined,
    urenPerWeekMax: params.get("urenPerWeekMax") ?? undefined,
    hoursMax: params.get("hoursMax") ?? undefined,
    straalKm: params.get("straalKm") ?? undefined,
    radiusKm: params.get("radiusKm") ?? undefined,
    tariefMin: params.get("tariefMin") ?? undefined,
    tariefMax: params.get("tariefMax") ?? undefined,
    contractType: params.get("contractType") ?? undefined,
    sort: params.get("sort") ?? undefined,
    pagina: params.get("pagina") ?? undefined,
    page: params.get("page") ?? undefined,
    limit: params.get("limit") ?? undefined,
    perPage: params.get("perPage") ?? undefined,
  });
}

function normalizeTextFilter(value: string | null | undefined): string | undefined {
  const normalized = value?.trim();
  return normalized ? normalized : undefined;
}

function parseMultiValueTextFilters(params: URLSearchParams, ...keys: string[]) {
  return [
    ...new Set(
      keys
        .flatMap((key) => params.getAll(key))
        .flatMap((value) => value.split(","))
        .map((value) => normalizeTextFilter(value))
        .filter((value): value is string => Boolean(value)),
    ),
  ];
}

function parseMultiValueRegions(params: URLSearchParams, ...keys: string[]) {
  return [
    ...new Set(
      keys
        .flatMap((key) => params.getAll(key))
        .flatMap((value) => value.split(","))
        .map((value) => normalizeOpdrachtenRegion(value))
        .filter((value): value is OpdrachtenRegion => Boolean(value)),
    ),
  ];
}

function parseNumericFilter(value: string | null | undefined): number | undefined {
  const normalized = normalizeTextFilter(value);
  if (!normalized) return undefined;

  const parsed = Number.parseFloat(normalized);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function parsePositiveIntegerFilter(value: string | null | undefined): number | undefined {
  const parsed = parseNumericFilter(value);
  if (parsed == null) return undefined;

  const rounded = Math.round(parsed);
  return rounded > 0 ? rounded : undefined;
}

export function normalizeOpdrachtenStatus(value: string | null | undefined): OpdrachtenStatus {
  switch (value) {
    case "closed":
    case "archived":
    case "all":
      return value;
    default:
      return "open";
  }
}

export function normalizeOpdrachtenSearchQuery(
  value: string | null | undefined,
): string | undefined {
  const normalized = value?.trim() ?? "";
  return normalized.length >= 2 ? normalized : undefined;
}

export function normalizeOpdrachtenProvince(
  value: string | null | undefined,
): OpdrachtenProvince | undefined {
  if (!value) return undefined;
  return provinceLookup.get(value.trim().toLowerCase());
}

export function normalizeOpdrachtenRegion(
  value: string | null | undefined,
): OpdrachtenRegion | undefined {
  if (!value) return undefined;
  return regionLookup.get(value.trim().toLowerCase());
}

export function normalizeOpdrachtenHoursBucket(
  value: string | null | undefined,
): OpdrachtenHoursBucket | undefined {
  if (!value) return undefined;
  return hoursLookup.get(value.trim().toLowerCase());
}

export function normalizeOpdrachtenSort(value: string | null | undefined): OpdrachtenSort {
  if (!value) return "nieuwste";
  return sortLookup.get(value.trim().toLowerCase()) ?? "nieuwste";
}

export function hasExplicitOpdrachtenSort(params: URLSearchParams): boolean {
  const value = params.get("sort");
  return typeof value === "string" && value.trim().length > 0;
}

export function getOpdrachtenServiceSort(
  sort: OpdrachtenSort,
  hasQuery: boolean,
  hasExplicitSort = true,
): Exclude<OpdrachtenSort, "relevantie"> | undefined {
  if (!hasExplicitSort) {
    return hasQuery ? undefined : "nieuwste";
  }

  if (sort === "relevantie") {
    return hasQuery ? undefined : "nieuwste";
  }

  return sort;
}

export function normalizeOpdrachtenRadiusKm(value: string | null | undefined): number | undefined {
  if (!value) return undefined;
  const parsed = Number.parseInt(value, 10);
  return OPDRACHTEN_RADIUS_OPTIONS.includes(parsed as (typeof OPDRACHTEN_RADIUS_OPTIONS)[number])
    ? parsed
    : undefined;
}

export function getProvincesForRegion(region: OpdrachtenRegion): readonly OpdrachtenProvince[] {
  return OPDRACHTEN_REGION_PROVINCES[region] ?? [];
}

export function getHoursRangeForBucket(bucket: OpdrachtenHoursBucket) {
  const option = OPDRACHTEN_HOURS_OPTIONS.find((candidate) => candidate.value === bucket);
  if (!option) return undefined;
  return {
    min: option.min,
    max: "max" in option ? option.max : undefined,
  };
}

export function getProvinceAnchor(province: string | null | undefined) {
  const normalizedProvince = normalizeOpdrachtenProvince(province);
  if (!normalizedProvince) return undefined;

  return {
    province: normalizedProvince,
    ...PROVINCE_ANCHORS[normalizedProvince],
  };
}

export type ParsedOpdrachtenFilters = {
  q?: string;
  platform?: string;
  endClient?: string;
  escoUri?: string;
  status: OpdrachtenStatus;
  province?: OpdrachtenProvince;
  categories: string[];
  category?: string;
  regions: OpdrachtenRegion[];
  region?: OpdrachtenRegion;
  hoursPerWeek?: OpdrachtenHoursBucket;
  hoursPerWeekMin?: number;
  hoursPerWeekMax?: number;
  radiusKm?: number;
  rateMin?: number;
  rateMax?: number;
  contractType?: string;
  sort: OpdrachtenSort;
};

export function parseOpdrachtenFilters(params: URLSearchParams): ParsedOpdrachtenFilters {
  const categories = parseMultiValueTextFilters(params, "vakgebied", "category");
  const regions = parseMultiValueRegions(params, "regio", "region");

  return {
    q: normalizeTextFilter(params.get("q")),
    platform: normalizeTextFilter(params.get("platform")),
    endClient: normalizeTextFilter(params.get("endClient")),
    escoUri: normalizeTextFilter(params.get("vaardigheid") ?? params.get("escoUri")),
    status: normalizeOpdrachtenStatus(params.get("status")),
    province: normalizeOpdrachtenProvince(params.get("provincie") ?? params.get("province")),
    categories,
    category: categories[0],
    regions,
    region: regions[0],
    hoursPerWeek: normalizeOpdrachtenHoursBucket(params.get("urenPerWeek") ?? params.get("hours")),
    hoursPerWeekMin: parsePositiveIntegerFilter(
      params.get("urenPerWeekMin") ?? params.get("hoursMin"),
    ),
    hoursPerWeekMax: parsePositiveIntegerFilter(
      params.get("urenPerWeekMax") ?? params.get("hoursMax"),
    ),
    radiusKm: normalizeOpdrachtenRadiusKm(params.get("straalKm") ?? params.get("radiusKm")),
    rateMin: parseNumericFilter(params.get("tariefMin")),
    rateMax: parseNumericFilter(params.get("tariefMax")),
    contractType: normalizeTextFilter(params.get("contractType")),
    sort: normalizeOpdrachtenSort(params.get("sort")),
  };
}
