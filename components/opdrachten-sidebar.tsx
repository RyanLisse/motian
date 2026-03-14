"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, RotateCcw, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useMemo, useRef, useState } from "react";
import { JobListItem } from "@/components/job-list-item";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import {
  DropdownMenu,
  DropdownMenuCheckboxItem,
  DropdownMenuContent,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Input } from "@/components/ui/input";
import { ScrollArea } from "@/components/ui/scroll-area";
import { SearchableCombobox } from "@/components/ui/searchable-combobox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
import { buildOpdrachtenFilterHref, getOpdrachtenBasePath } from "@/src/lib/opdrachten-filter-url";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  getHoursRangeForBucket,
  getProvinceAnchor,
  MAX_OPDRACHTEN_LIMIT,
  OPDRACHTEN_PAGE_SIZE_OPTIONS,
  OPDRACHTEN_PROVINCES,
  OPDRACHTEN_RADIUS_OPTIONS,
  OPDRACHTEN_REGION_OPTIONS,
  OPDRACHTEN_SORT_OPTIONS,
  parseOpdrachtenFilters,
} from "@/src/lib/opdrachten-filters";

interface SidebarJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  workArrangement: string | null;
  contractType: string | null;
  applicationDeadline?: Date | string | null;
  pipelineCount?: number;
  hasPipeline?: boolean;
}

interface SearchResponse {
  jobs: SidebarJob[];
  total: number;
  page: number;
  perPage: number;
  totalPages: number;
}

type SearchResponsePayload = {
  jobs?: unknown;
  total?: unknown;
  page?: unknown;
  perPage?: unknown;
  totalPages?: unknown;
};

interface OpdrachtenSidebarProps {
  jobs: SidebarJob[];
  totalCount: number;
  platforms: string[];
  endClients: string[];
  categories: string[];
  skillOptions: FilterOption[];
}

const CONTRACT_TYPES = [
  { value: "freelance", label: "Freelance" },
  { value: "interim", label: "Interim" },
  { value: "vast", label: "Vast" },
  { value: "opdracht", label: "Opdracht" },
];

const DARK_FILTER_PANEL_CLASS =
  "rounded-[24px] border border-white/10 bg-white/[0.035] shadow-[inset_0_1px_0_rgba(255,255,255,0.04)] backdrop-blur";
const DARK_FILTER_CONTROL_CLASS =
  "h-12 rounded-[20px] border-white/10 bg-white/[0.035] px-4 text-[15px] font-normal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] placeholder:text-white/35 focus-visible:ring-1 focus-visible:ring-white/20 focus-visible:ring-offset-0";
const DARK_FILTER_TRIGGER_CLASS =
  "h-12 rounded-[20px] border-white/10 bg-white/[0.035] px-4 text-left text-[15px] font-normal text-white shadow-[inset_0_1px_0_rgba(255,255,255,0.03)] data-[placeholder]:text-white/35";
const DARK_FILTER_MENU_CLASS = "border-white/10 bg-[#101113] text-white";
const DARK_FILTER_SECTION_LABEL_CLASS =
  "text-[11px] font-semibold uppercase tracking-[0.22em] text-white/45";
const DARK_FILTER_SECTION_VALUE_CLASS = "text-sm text-white/55";

const DAY_IN_MS = 24 * 60 * 60 * 1000;
type FilterOverrideValue = string | string[];

type FilterOption = {
  value: string;
  label: string;
};

function hasUrgentDeadline(deadline?: Date | string | null) {
  if (!deadline) return false;

  const parsedDeadline = new Date(deadline);
  if (Number.isNaN(parsedDeadline.getTime())) return false;

  const remainingDays = Math.ceil((parsedDeadline.getTime() - Date.now()) / DAY_IN_MS);
  return remainingDays >= 0 && remainingDays <= 3;
}

function pushOpdrachtenParams(
  searchParams: URLSearchParams,
  router: ReturnType<typeof useRouter>,
  pathname: string,
  overrides: Record<string, FilterOverrideValue>,
) {
  router.push(buildOpdrachtenFilterHref(pathname, searchParams, overrides));
}

function toggleFilterValue(values: string[], nextValue: string) {
  return values.includes(nextValue)
    ? values.filter((value) => value !== nextValue)
    : [...values, nextValue];
}

function summarizeSelection(label: string, selectedLabels: string[]) {
  if (selectedLabels.length === 0) return label;
  if (selectedLabels.length === 1) return selectedLabels[0] ?? label;
  return `${label} (${selectedLabels.length})`;
}

function summarizeHoursRange(minValue: string, maxValue: string) {
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

function parseSearchResponse(payload: SearchResponsePayload): SearchResponse {
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

function FilterChecklist({
  idPrefix,
  options,
  selectedValues,
  onToggle,
  className,
}: {
  idPrefix: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  className?: string;
}) {
  return (
    <div className={cn("space-y-1 rounded-lg border border-border bg-background p-2", className)}>
      {options.map((option) => {
        const checked = selectedValues.includes(option.value);
        const checkboxId = `${idPrefix}-${option.value}`;

        return (
          <label
            key={option.value}
            htmlFor={checkboxId}
            className="flex min-h-11 cursor-pointer items-center gap-3 rounded-md px-2 py-2.5 text-sm hover:bg-accent/50"
          >
            <Checkbox
              id={checkboxId}
              checked={checked}
              onCheckedChange={() => onToggle(option.value)}
            />
            <span className="min-w-0 wrap-break-word text-foreground">{option.label}</span>
          </label>
        );
      })}
    </div>
  );
}

function CompactMultiSelectFilter({
  label,
  options,
  selectedValues,
  onToggle,
  buttonClassName,
  contentClassName,
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
  buttonClassName?: string;
  contentClassName?: string;
}) {
  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className={cn(
            "h-7 flex-1 justify-between border-border bg-card px-2 text-[10px] text-foreground",
            buttonClassName,
          )}
        >
          <span className="truncate">{summarizeSelection(label, selectedLabels)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className={cn("bg-card border-border", contentClassName)}>
        {options.map((option) => (
          <DropdownMenuCheckboxItem
            key={option.value}
            checked={selectedValues.includes(option.value)}
            onCheckedChange={() => onToggle(option.value)}
          >
            {option.label}
          </DropdownMenuCheckboxItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

function RadiusSliderField({
  provinceAnchor,
  radiusKm,
  onRadiusChange,
  compact = false,
}: {
  provinceAnchor: ReturnType<typeof getProvinceAnchor>;
  radiusKm: string;
  onRadiusChange: (value: string) => void;
  compact?: boolean;
}) {
  const sliderOptions = [0, ...OPDRACHTEN_RADIUS_OPTIONS];
  const sliderIndex = radiusKm ? Math.max(0, sliderOptions.indexOf(Number(radiusKm))) : 0;

  return (
    <div className={compact ? "px-4 pb-4" : undefined}>
      <div className={cn("mb-2 flex items-center justify-between gap-2", compact && "mb-2")}>
        <span
          className={cn(
            "font-medium text-foreground",
            compact ? DARK_FILTER_SECTION_LABEL_CLASS : "text-sm",
          )}
        >
          Straal
        </span>
        <button
          type="button"
          disabled={!radiusKm}
          onClick={() => onRadiusChange("")}
          className={cn(
            "font-medium text-primary disabled:cursor-not-allowed disabled:opacity-50",
            compact ? "text-sm text-white/55 hover:text-white" : "text-xs",
          )}
        >
          Reset
        </button>
      </div>

      <div
        className={cn(
          "rounded-lg border border-border bg-background p-3",
          compact &&
            "rounded-[24px] border-white/10 bg-white/[0.035] px-4 py-4 shadow-[inset_0_1px_0_rgba(255,255,255,0.04)]",
        )}
      >
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={cn("font-medium", compact ? "text-3xl text-white" : "text-sm")}>
            {radiusKm ? `${radiusKm} km` : "Geen straal"}
          </span>
          <span className={cn(compact ? "text-lg text-white/55" : "text-xs text-muted-foreground")}>
            {provinceAnchor ? provinceAnchor.label : "Eerst provincie"}
          </span>
        </div>
        <Slider
          min={0}
          max={sliderOptions.length - 1}
          step={1}
          value={[sliderIndex]}
          disabled={!provinceAnchor}
          onValueChange={([value]) => {
            const nextRadius = sliderOptions[value] ?? 0;
            onRadiusChange(nextRadius > 0 ? String(nextRadius) : "");
          }}
        />
        <div
          className={cn(
            "mt-2 flex items-center justify-between text-[10px] text-muted-foreground",
            compact && "mt-3 text-sm text-white/55",
          )}
        >
          {sliderOptions.map((value) => (
            <span key={value}>{value === 0 ? "0" : value}</span>
          ))}
        </div>
      </div>

      <p
        className={cn("mt-2 text-muted-foreground", compact ? "text-sm text-white/45" : "text-xs")}
      >
        {provinceAnchor
          ? `Straal wordt toegepast vanaf ${provinceAnchor.label} (${provinceAnchor.province}).`
          : "Kies eerst een provincie om straalfiltering te activeren."}
      </p>
    </div>
  );
}

type SearchJobsParams = {
  q: string;
  platform: string;
  endClient: string;
  vaardigheid: string;
  status: string;
  provincie: string;
  regios: string[];
  vakgebieden: string[];
  urenPerWeek: string;
  urenPerWeekMin: string;
  urenPerWeekMax: string;
  straalKm: string;
  contractType: string;
  tariefMin: string;
  tariefMax: string;
  sort: string;
  page: number;
  limit: number;
};

async function searchJobs({
  q,
  platform,
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
}: SearchJobsParams): Promise<SearchResponse> {
  const params = new URLSearchParams();
  if (q) params.set("q", q);
  if (platform) params.set("platform", platform);
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

  const res = await fetch(`/api/opdrachten/zoeken?${params.toString()}`);
  if (!res.ok) {
    throw new Error(await getSearchErrorMessage(res));
  }

  return parseSearchResponse((await res.json()) as SearchResponsePayload);
}

export function OpdrachtenSidebar({
  jobs: initialJobs,
  totalCount: initialTotal,
  platforms,
  endClients,
  categories,
  skillOptions,
}: OpdrachtenSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOverviewPage = pathname === "/vacatures" || pathname === "/opdrachten";
  const match = pathname.match(/^\/(?:vacatures|opdrachten)\/(.+)$/);
  const activeId = match?.[1] ?? null;

  // URL as source of truth for TanStack Query: key and fetch use searchParams so e.g. top-opdrachtgevers link shows correct results immediately
  const parsedFilters = parseOpdrachtenFilters(new URLSearchParams(searchParams.toString()));
  const q = parsedFilters.q ?? "";
  const platform = parsedFilters.platform ?? "";
  const endClient = parsedFilters.endClient ?? "";
  const vaardigheid = parsedFilters.escoUri ?? "";
  const status = parsedFilters.status;
  const provincie = parsedFilters.province ?? "";
  const regios = parsedFilters.regions;
  const vakgebieden = parsedFilters.categories;
  const urenPerWeek = parsedFilters.hoursPerWeek ?? "";
  const urenRangeFromBucket = parsedFilters.hoursPerWeek
    ? getHoursRangeForBucket(parsedFilters.hoursPerWeek)
    : undefined;
  const urenPerWeekMin =
    parsedFilters.hoursPerWeekMin != null
      ? String(parsedFilters.hoursPerWeekMin)
      : urenRangeFromBucket?.min != null
        ? String(urenRangeFromBucket.min)
        : "";
  const urenPerWeekMax =
    parsedFilters.hoursPerWeekMax != null
      ? String(parsedFilters.hoursPerWeekMax)
      : urenRangeFromBucket?.max != null
        ? String(urenRangeFromBucket.max)
        : "";
  const straalKm = parsedFilters.radiusKm ? String(parsedFilters.radiusKm) : "";
  const contractType = parsedFilters.contractType ?? "";
  const hasSearchQuery = q.length > 0;
  const sortOptions = hasSearchQuery
    ? OPDRACHTEN_SORT_OPTIONS
    : OPDRACHTEN_SORT_OPTIONS.filter((option) => option.value !== "relevantie");
  const sort =
    !hasSearchQuery && parsedFilters.sort === "relevantie" ? "nieuwste" : parsedFilters.sort;
  const tariefMinParam = searchParams.get("tariefMin") ?? "";
  const tariefMaxParam = searchParams.get("tariefMax") ?? "";
  const pageParam =
    Math.max(
      1,
      Number.parseInt(searchParams.get("pagina") ?? searchParams.get("page") ?? "1", 10),
    ) || 1;
  const limitParam =
    Math.min(
      MAX_OPDRACHTEN_LIMIT,
      Math.max(
        1,
        Number.parseInt(
          searchParams.get("limit") ??
            searchParams.get("perPage") ??
            String(DEFAULT_OPDRACHTEN_LIMIT),
          10,
        ),
      ),
    ) || DEFAULT_OPDRACHTEN_LIMIT;

  const [inputValue, setInputValue] = useState(q);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const provinceAnchor = getProvinceAnchor(provincie);
  const regionOptions = useMemo<FilterOption[]>(
    () =>
      OPDRACHTEN_REGION_OPTIONS.map((option) => ({
        value: option.value,
        label: option.label,
      })),
    [],
  );
  const categoryOptions = useMemo<FilterOption[]>(
    () =>
      categories.map((category) => ({
        value: category,
        label: category,
      })),
    [categories],
  );

  useEffect(() => {
    setInputValue(q);
  }, [q]);

  // Debounce search input: push to URL after 300ms so queryKey updates (only when user typed, not when we synced from URL)
  useEffect(() => {
    if (inputValue === q) {
      if (debounceRef.current) {
        clearTimeout(debounceRef.current);
        debounceRef.current = null;
      }
      return;
    }
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => {
      pushOpdrachtenParams(searchParams, router, pathname, { q: inputValue, pagina: "1" });
      debounceRef.current = null;
    }, 300);
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
    };
  }, [inputValue, pathname, q, searchParams, router]);

  const deferredTariefMin = useDeferredValue(tariefMinParam);
  const deferredTariefMax = useDeferredValue(tariefMaxParam);

  const { data, error, isFetching } = useQuery({
    queryKey: [
      "opdrachten-search",
      q,
      platform,
      endClient,
      vaardigheid,
      status,
      provincie,
      regios.join("|"),
      vakgebieden.join("|"),
      urenPerWeek,
      urenPerWeekMin,
      urenPerWeekMax,
      straalKm,
      contractType,
      deferredTariefMin,
      deferredTariefMax,
      sort,
      pageParam,
      limitParam,
    ],
    queryFn: () =>
      searchJobs({
        q,
        platform,
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
        tariefMin: deferredTariefMin,
        tariefMax: deferredTariefMax,
        sort,
        page: pageParam,
        limit: limitParam,
      }),
    placeholderData: (prev) => prev,
    initialData:
      pageParam === 1 &&
      limitParam === DEFAULT_OPDRACHTEN_LIMIT &&
      !q &&
      !platform &&
      !endClient &&
      !vaardigheid &&
      status === "open" &&
      !provincie &&
      regios.length === 0 &&
      vakgebieden.length === 0 &&
      !urenPerWeek &&
      !urenPerWeekMin &&
      !urenPerWeekMax &&
      !straalKm &&
      !contractType &&
      !deferredTariefMin &&
      !deferredTariefMax &&
      sort === "nieuwste"
        ? {
            jobs: initialJobs,
            total: initialTotal,
            page: 1,
            perPage: DEFAULT_OPDRACHTEN_LIMIT,
            totalPages: Math.ceil(initialTotal / DEFAULT_OPDRACHTEN_LIMIT),
          }
        : undefined,
  });

  const displayJobs = data?.jobs ?? initialJobs;
  const displayTotal = data?.total ?? initialTotal;
  const displayPerPage = data?.perPage ?? limitParam;
  const totalPages = data?.totalPages ?? 1;
  const searchErrorMessage = error instanceof Error ? error.message : null;
  const detailQuery = searchParams.toString();
  const shortlistCount = displayJobs.filter((job) => (job.pipelineCount ?? 0) > 0).length;
  const urgentDeadlineCount = displayJobs.filter((job) =>
    hasUrgentDeadline(job.applicationDeadline),
  ).length;
  const activeFilterCount =
    Number(Boolean(platform)) +
    Number(Boolean(endClient)) +
    Number(Boolean(vaardigheid)) +
    Number(status !== "open") +
    Number(Boolean(provincie)) +
    Number(regios.length > 0) +
    Number(vakgebieden.length > 0) +
    Number(Boolean(urenPerWeek)) +
    Number(Boolean(urenPerWeekMin || urenPerWeekMax)) +
    Number(Boolean(straalKm)) +
    Number(Boolean(contractType)) +
    Number(Boolean(tariefMinParam || tariefMaxParam)) +
    Number(sort !== "nieuwste");
  const buildDetailHref = (jobId: string) => {
    const base = "/vacatures";
    return detailQuery ? `${base}/${jobId}?${detailQuery}` : `${base}/${jobId}`;
  };

  const handleFilterChange = (paramKey: string, value: string) => {
    pushOpdrachtenParams(searchParams, router, pathname, { [paramKey]: value, pagina: "1" });
  };

  const handleToggleRegio = (value: string) => {
    pushOpdrachtenParams(searchParams, router, pathname, {
      regio: toggleFilterValue(regios, value),
      pagina: "1",
    });
  };

  const handleToggleVakgebied = (value: string) => {
    pushOpdrachtenParams(searchParams, router, pathname, {
      vakgebied: toggleFilterValue(vakgebieden, value),
      pagina: "1",
    });
  };

  const handleHoursRangeChange = (field: "urenPerWeekMin" | "urenPerWeekMax", value: string) => {
    pushOpdrachtenParams(searchParams, router, pathname, {
      urenPerWeek: "",
      [field]: value,
      pagina: "1",
    });
  };

  const handleRadiusChange = (value: string) => {
    pushOpdrachtenParams(searchParams, router, pathname, {
      straalKm: value,
      pagina: "1",
    });
  };

  const handleProvinceChange = (value: string) => {
    const nextProvince = value === "__all__" ? "" : value;
    pushOpdrachtenParams(searchParams, router, pathname, {
      provincie: nextProvince,
      straalKm: nextProvince ? straalKm : "",
      pagina: "1",
    });
  };

  const resetFilters = () => {
    router.push(getOpdrachtenBasePath(pathname));
  };

  if (!isOverviewPage) {
    return (
      <aside className="flex h-full w-full flex-col overflow-hidden bg-[#050506] text-white">
        <div className="shrink-0 px-4 pb-4 pt-5">
          <div className="relative">
            <Search className="absolute left-4 top-1/2 h-5 w-5 -translate-y-1/2 text-white/40" />
            <Input
              placeholder="Zoek vacatures..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className={cn(
                "h-14 rounded-[24px] pl-12 pr-11 text-[17px]",
                DARK_FILTER_CONTROL_CLASS,
              )}
            />
            {isFetching && (
              <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/45" />
            )}
          </div>
        </div>

        <div className="grid shrink-0 gap-3 px-4">
          <div className="grid grid-cols-2 gap-3">
            <Select
              value={platform || undefined}
              onValueChange={(v) => handleFilterChange("platform", v === "__all__" ? "" : v)}
            >
              <SelectTrigger className={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}>
                <SelectValue placeholder="Platform" />
              </SelectTrigger>
              <SelectContent className={DARK_FILTER_MENU_CLASS}>
                <SelectItem value="__all__" className="text-white">
                  Alle platforms
                </SelectItem>
                {platforms.map((p) => (
                  <SelectItem key={p} value={p} className="capitalize text-white">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>

            <SearchableCombobox
              value={endClient || undefined}
              onValueChange={(value) => handleFilterChange("endClient", value)}
              options={endClients}
              placeholder="Eindopdrachtgever"
              searchPlaceholder="Zoek eindopdrachtgever..."
              emptyText="Geen eindopdrachtgevers gevonden."
              clearLabel="Alle eindopdrachtgevers"
              buttonClassName={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}
              contentClassName={DARK_FILTER_MENU_CLASS}
              itemClassName="text-sm text-white"
            />
          </div>

          <SearchableCombobox
            value={vaardigheid || undefined}
            onValueChange={(value) => handleFilterChange("vaardigheid", value)}
            options={skillOptions}
            placeholder="Vaardigheid"
            searchPlaceholder="Zoek ESCO vaardigheid..."
            emptyText="Geen vaardigheden gevonden."
            clearLabel="Alle vaardigheden"
            buttonClassName={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}
            contentClassName={DARK_FILTER_MENU_CLASS}
            itemClassName="text-sm text-white"
            triggerId="opdrachten-esco-vaardigheid"
            ariaLabel="ESCO vaardigheid"
          />

          <div className="grid grid-cols-2 gap-3">
            <Select
              value={status}
              onValueChange={(v) => handleFilterChange("status", v === "open" ? "" : v)}
            >
              <SelectTrigger className={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}>
                <SelectValue placeholder="Status" />
              </SelectTrigger>
              <SelectContent className={DARK_FILTER_MENU_CLASS}>
                <SelectItem value="open" className="text-white">
                  Open
                </SelectItem>
                <SelectItem value="closed" className="text-white">
                  Gesloten
                </SelectItem>
                <SelectItem value="archived" className="text-white">
                  Gearchiveerd
                </SelectItem>
                <SelectItem value="all" className="text-white">
                  Alles
                </SelectItem>
              </SelectContent>
            </Select>

            <Select value={provincie || undefined} onValueChange={handleProvinceChange}>
              <SelectTrigger className={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}>
                <SelectValue placeholder="Provincie" />
              </SelectTrigger>
              <SelectContent className={DARK_FILTER_MENU_CLASS}>
                <SelectItem value="__all__" className="text-white">
                  Alle provincies
                </SelectItem>
                {OPDRACHTEN_PROVINCES.map((p) => (
                  <SelectItem key={p} value={p} className="text-white">
                    {p}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            <CompactMultiSelectFilter
              label="Regio"
              options={regionOptions}
              selectedValues={regios}
              onToggle={handleToggleRegio}
              buttonClassName={cn(
                "h-12 rounded-[20px] px-4 text-[15px] text-white",
                DARK_FILTER_PANEL_CLASS,
              )}
              contentClassName={DARK_FILTER_MENU_CLASS}
            />
            <CompactMultiSelectFilter
              label="Vakgebied"
              options={categoryOptions}
              selectedValues={vakgebieden}
              onToggle={handleToggleVakgebied}
              buttonClassName={cn(
                "h-12 rounded-[20px] px-4 text-[15px] text-white",
                DARK_FILTER_PANEL_CLASS,
              )}
              contentClassName={DARK_FILTER_MENU_CLASS}
            />
          </div>

          <div className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <span className={DARK_FILTER_SECTION_LABEL_CLASS}>Uren per week</span>
              <span className={DARK_FILTER_SECTION_VALUE_CLASS}>
                {summarizeHoursRange(urenPerWeekMin, urenPerWeekMax)}
              </span>
            </div>
            <div className="grid grid-cols-2 gap-3">
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Min"
                value={urenPerWeekMin}
                onChange={(e) => handleHoursRangeChange("urenPerWeekMin", e.target.value)}
                className={DARK_FILTER_CONTROL_CLASS}
              />
              <Input
                type="number"
                inputMode="numeric"
                min="1"
                placeholder="Max"
                value={urenPerWeekMax}
                onChange={(e) => handleHoursRangeChange("urenPerWeekMax", e.target.value)}
                className={DARK_FILTER_CONTROL_CLASS}
              />
            </div>
          </div>
        </div>

        <RadiusSliderField
          provinceAnchor={provinceAnchor}
          radiusKm={straalKm}
          onRadiusChange={handleRadiusChange}
          compact
        />

        <div className="shrink-0 px-4 pb-4">
          <Select
            value={sort}
            onValueChange={(value) => handleFilterChange("sort", value === "nieuwste" ? "" : value)}
          >
            <SelectTrigger className={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}>
              <SelectValue placeholder="Sortering" />
            </SelectTrigger>
            <SelectContent className={DARK_FILTER_MENU_CLASS}>
              {sortOptions.map((option) => (
                <SelectItem key={option.value} value={option.value} className="text-sm text-white">
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="flex shrink-0 items-center justify-between gap-3 border-y border-white/10 bg-black/30 px-4 py-4">
          <div className="min-w-0">
            <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
              {displayTotal} vacatures
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge
                variant="outline"
                className="h-7 rounded-full border-white/10 bg-white/[0.035] px-3 text-[11px] text-white/65"
              >
                {shortlistCount > 0 ? `${shortlistCount} met shortlist` : "Nog geen shortlist"}
              </Badge>
              {urgentDeadlineCount > 0 ? (
                <Badge
                  variant="outline"
                  className="h-7 rounded-full border-amber-500/20 bg-amber-500/12 px-3 text-[11px] text-amber-200"
                >
                  {urgentDeadlineCount} deadlines vragen aandacht
                </Badge>
              ) : null}
            </div>
          </div>
          <div className="flex items-center gap-2">
            <Select
              value={String(displayPerPage)}
              onValueChange={(v) =>
                pushOpdrachtenParams(searchParams, router, pathname, {
                  limit: v === String(DEFAULT_OPDRACHTEN_LIMIT) ? "" : v,
                  pagina: "1",
                })
              }
            >
              <SelectTrigger className="h-12 w-[132px] rounded-[18px] border-white/10 bg-white/[0.035] px-4 text-[15px] text-white">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className={DARK_FILTER_MENU_CLASS}>
                {OPDRACHTEN_PAGE_SIZE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)} className="text-sm text-white">
                    {value} / pg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {totalPages > 1 && (
              <p className="text-base text-white/55">
                {pageParam}/{totalPages}
              </p>
            )}
          </div>
        </div>

        {searchErrorMessage ? (
          <div className="px-4 py-3 text-sm text-red-300">{searchErrorMessage}</div>
        ) : null}

        <ScrollArea className="flex-1 bg-[#050506]">
          {displayJobs.length === 0 ? (
            <div className="px-4 py-8 text-center text-sm text-white/45">
              Geen vacatures gevonden
            </div>
          ) : (
            displayJobs.map((job) => (
              <JobListItem
                key={job.id}
                job={job}
                isActive={job.id === activeId}
                hasPipeline={job.hasPipeline}
                pipelineCount={job.pipelineCount}
                href={buildDetailHref(job.id)}
              />
            ))
          )}
        </ScrollArea>

        {totalPages > 1 && (
          <div className="flex shrink-0 items-center justify-between border-t border-white/10 px-4 py-3">
            <Button
              variant="ghost"
              size="sm"
              className="h-10 rounded-[16px] px-4 text-sm text-white/55 hover:bg-white/[0.05] hover:text-white"
              disabled={pageParam <= 1 || isFetching}
              onClick={() =>
                pushOpdrachtenParams(searchParams, router, pathname, {
                  pagina: String(pageParam - 1),
                })
              }
            >
              <ChevronLeft className="h-3.5 w-3.5 mr-1" />
              Vorige
            </Button>
            <Button
              variant="ghost"
              size="sm"
              className="h-10 rounded-[16px] px-4 text-sm text-white/55 hover:bg-white/[0.05] hover:text-white"
              disabled={pageParam >= totalPages || isFetching}
              onClick={() =>
                pushOpdrachtenParams(searchParams, router, pathname, {
                  pagina: String(pageParam + 1),
                })
              }
            >
              Volgende
              <ChevronRight className="h-3.5 w-3.5 ml-1" />
            </Button>
          </div>
        )}
      </aside>
    );
  }

  return (
    <aside className="h-full min-w-0 w-full bg-sidebar/25">
      <div className="grid h-full min-h-0 overflow-hidden lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="flex min-h-0 flex-col border-b border-border/70 px-3 py-3 sm:px-4 sm:py-5 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
            <h3 className="text-xl font-semibold tracking-tight text-foreground sm:text-2xl">
              Zoekfilter
            </h3>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex min-h-11 items-center gap-1 rounded-md px-2 text-xs font-semibold uppercase tracking-wide text-primary hover:bg-primary/5 hover:opacity-80"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Wis filters
            </button>
          </div>

          <div className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4">
            <div>
              <label
                htmlFor="opdrachten-zoekterm"
                className="mb-2 block text-sm font-medium text-foreground"
              >
                Zoekterm
              </label>
              <div className="relative">
                <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  id="opdrachten-zoekterm"
                  value={inputValue}
                  onChange={(e) => setInputValue(e.target.value)}
                  placeholder="Zoek vacature..."
                  className="h-11 rounded-lg border-border bg-background pl-10 text-sm"
                />
                {isFetching && (
                  <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
                )}
              </div>
            </div>

            <button
              type="button"
              aria-expanded={mobileFiltersOpen}
              aria-controls="opdrachten-mobile-filters"
              className="inline-flex min-h-11 w-full items-center justify-between rounded-lg border border-border bg-background px-3 text-sm font-medium text-foreground shadow-sm lg:hidden"
              onClick={() => setMobileFiltersOpen((open) => !open)}
            >
              <span className="min-w-0 truncate">
                {mobileFiltersOpen ? "Filters sluiten" : "Filters openen"}
                {activeFilterCount > 0 ? ` (${activeFilterCount} actief)` : ""}
              </span>
              <ChevronDown
                className={cn(
                  "h-4 w-4 shrink-0 text-muted-foreground transition-transform",
                  mobileFiltersOpen && "rotate-180",
                )}
              />
            </button>

            <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground lg:hidden">
              <span>{displayTotal} resultaten</span>
              {activeFilterCount > 0 ? (
                <Badge
                  variant="outline"
                  className="max-w-full whitespace-normal wrap-break-word border-primary/20 bg-primary/10 px-2 py-0.5 text-[11px] text-primary"
                >
                  {activeFilterCount} filters actief
                </Badge>
              ) : null}
            </div>

            <div
              id="opdrachten-mobile-filters"
              className={cn(
                "min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-background/60 p-3 sm:space-y-4 sm:p-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0",
                !mobileFiltersOpen && "hidden lg:block",
              )}
            >
              <div>
                <label
                  htmlFor="opdrachten-opdrachtgever"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Platform
                </label>
                <Select
                  value={platform || "__all__"}
                  onValueChange={(v) => handleFilterChange("platform", v === "__all__" ? "" : v)}
                >
                  <SelectTrigger
                    id="opdrachten-opdrachtgever"
                    className="data-[size=default]:h-11 w-full rounded-lg border-border bg-background text-left text-sm"
                  >
                    <SelectValue placeholder="Alle platforms" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="__all__" className="text-foreground">
                      Alle platforms
                    </SelectItem>
                    {platforms.map((p) => (
                      <SelectItem key={p} value={p} className="capitalize text-foreground">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <label
                  htmlFor="opdrachten-eindopdrachtgever"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Eindopdrachtgever
                </label>
                <SearchableCombobox
                  value={endClient || undefined}
                  onValueChange={(value) => handleFilterChange("endClient", value)}
                  options={endClients}
                  placeholder="Alle eindopdrachtgevers"
                  searchPlaceholder="Zoek eindopdrachtgever..."
                  emptyText="Geen eindopdrachtgevers gevonden."
                  clearLabel="Alle eindopdrachtgevers"
                  buttonClassName="h-11 rounded-lg border-border bg-background text-left text-sm"
                  triggerId="opdrachten-eindopdrachtgever"
                  ariaLabel="Eindopdrachtgever"
                />
              </div>

              <div>
                <label
                  htmlFor="opdrachten-esco-vaardigheid"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Vaardigheid
                </label>
                <SearchableCombobox
                  value={vaardigheid || undefined}
                  onValueChange={(value) => handleFilterChange("vaardigheid", value)}
                  options={skillOptions}
                  placeholder="Alle vaardigheden"
                  searchPlaceholder="Zoek ESCO vaardigheid..."
                  emptyText="Geen vaardigheden gevonden."
                  clearLabel="Alle vaardigheden"
                  buttonClassName="h-11 rounded-lg border-border bg-background text-left text-sm"
                  triggerId="opdrachten-esco-vaardigheid"
                  ariaLabel="ESCO vaardigheid"
                />
              </div>

              <div>
                <label
                  htmlFor="opdrachten-status"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Status
                </label>
                <Select
                  value={status}
                  onValueChange={(v) => handleFilterChange("status", v === "open" ? "" : v)}
                >
                  <SelectTrigger
                    id="opdrachten-status"
                    className="data-[size=default]:h-11 w-full rounded-lg border-border bg-background text-left text-sm"
                  >
                    <SelectValue placeholder="Open" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="open" className="text-foreground">
                      Open
                    </SelectItem>
                    <SelectItem value="closed" className="text-foreground">
                      Gesloten
                    </SelectItem>
                    <SelectItem value="archived" className="text-foreground">
                      Gearchiveerd
                    </SelectItem>
                    <SelectItem value="all" className="text-foreground">
                      Alles
                    </SelectItem>
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 block text-sm font-medium text-foreground">Regio</p>
                <FilterChecklist
                  idPrefix="opdrachten-regio"
                  options={regionOptions}
                  selectedValues={regios}
                  onToggle={handleToggleRegio}
                />
              </div>

              <div>
                <label
                  htmlFor="opdrachten-locatie"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Provincie
                </label>
                <Select value={provincie || "__all__"} onValueChange={handleProvinceChange}>
                  <SelectTrigger
                    id="opdrachten-locatie"
                    className="data-[size=default]:h-11 w-full rounded-lg border-border bg-background text-left text-sm"
                  >
                    <SelectValue placeholder="Alle provincies" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="__all__" className="text-foreground">
                      Alle provincies
                    </SelectItem>
                    {OPDRACHTEN_PROVINCES.map((p) => (
                      <SelectItem key={p} value={p} className="text-foreground">
                        {p}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 block text-sm font-medium text-foreground">Vakgebied</p>
                <FilterChecklist
                  idPrefix="opdrachten-vakgebied"
                  options={categoryOptions}
                  selectedValues={vakgebieden}
                  onToggle={handleToggleVakgebied}
                  className="max-h-64 overflow-y-auto"
                />
              </div>

              <div>
                <p className="mb-2 block text-sm font-medium text-foreground">Uren per week</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="Min uren"
                    value={urenPerWeekMin}
                    onChange={(e) => handleHoursRangeChange("urenPerWeekMin", e.target.value)}
                    className="h-11 rounded-lg border-border bg-background text-sm"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    min="1"
                    placeholder="Max uren"
                    value={urenPerWeekMax}
                    onChange={(e) => handleHoursRangeChange("urenPerWeekMax", e.target.value)}
                    className="h-11 rounded-lg border-border bg-background text-sm"
                  />
                </div>
                <p className="mt-2 text-xs text-muted-foreground">
                  {summarizeHoursRange(urenPerWeekMin, urenPerWeekMax)} — vacatures overlappen met
                  dit bereik.
                </p>
              </div>

              <div>
                <p className="mb-2 block text-sm font-medium text-foreground">Straal (km)</p>
                <RadiusSliderField
                  provinceAnchor={provinceAnchor}
                  radiusKm={straalKm}
                  onRadiusChange={handleRadiusChange}
                />
              </div>

              <div>
                <label
                  htmlFor="opdrachten-contracttype"
                  className="mb-2 block text-sm font-medium text-foreground"
                >
                  Contract type
                </label>
                <Select
                  value={contractType || "__all__"}
                  onValueChange={(v) =>
                    handleFilterChange("contractType", v === "__all__" ? "" : v)
                  }
                >
                  <SelectTrigger
                    id="opdrachten-contracttype"
                    className="data-[size=default]:h-11 w-full rounded-lg border-border bg-background text-left text-sm"
                  >
                    <SelectValue placeholder="Alle types" />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    <SelectItem value="__all__" className="text-foreground">
                      Alle types
                    </SelectItem>
                    {CONTRACT_TYPES.map((type) => (
                      <SelectItem key={type.value} value={type.value} className="text-foreground">
                        {type.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>

              <div>
                <p className="mb-2 block text-sm font-medium text-foreground">Tarief per uur</p>
                <div className="grid grid-cols-2 gap-2">
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Min"
                    value={tariefMinParam}
                    onChange={(e) =>
                      pushOpdrachtenParams(searchParams, router, pathname, {
                        tariefMin: e.target.value,
                        pagina: "1",
                      })
                    }
                    className="h-11 rounded-lg border-border bg-background text-sm"
                  />
                  <Input
                    type="number"
                    inputMode="numeric"
                    placeholder="Max"
                    value={tariefMaxParam}
                    onChange={(e) =>
                      pushOpdrachtenParams(searchParams, router, pathname, {
                        tariefMax: e.target.value,
                        pagina: "1",
                      })
                    }
                    className="h-11 rounded-lg border-border bg-background text-sm"
                  />
                </div>
              </div>
            </div>
          </div>
        </div>

        <div className="flex h-full min-h-0 min-w-0 flex-col px-3 py-2.5 sm:px-4 sm:py-4 md:px-5 md:py-5 lg:px-6 overflow-hidden">
          <div className="mb-2.5 flex flex-col gap-2.5 border-b border-border/70 pb-2.5 sm:mb-4 sm:gap-3 sm:pb-4">
            <div className="min-w-0 space-y-2">
              <div className="text-base font-semibold text-foreground sm:text-lg">
                {displayTotal} vacatures weergegeven
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge
                  variant="outline"
                  className="max-w-full whitespace-normal wrap-break-word text-[11px] text-muted-foreground sm:text-xs"
                >
                  {shortlistCount > 0 ? `${shortlistCount} met shortlist` : "Nog geen shortlist"}
                </Badge>
                {urgentDeadlineCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="max-w-full whitespace-normal wrap-break-word border-amber-500/20 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-300 sm:text-xs"
                  >
                    {urgentDeadlineCount} deadlines vragen aandacht
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="flex w-full flex-col gap-2 sm:flex-row sm:flex-wrap sm:items-center sm:justify-between">
              <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto sm:items-center">
                <span className="text-xs text-muted-foreground sm:text-sm">Per pagina:</span>
                <Select
                  value={String(displayPerPage)}
                  onValueChange={(v) =>
                    pushOpdrachtenParams(searchParams, router, pathname, {
                      limit: v === String(DEFAULT_OPDRACHTEN_LIMIT) ? "" : v,
                      pagina: "1",
                    })
                  }
                >
                  <SelectTrigger className="data-[size=default]:h-11 w-full rounded-lg border-border bg-background text-sm font-semibold text-foreground sm:w-[110px] sm:rounded-full sm:data-[size=default]:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {OPDRACHTEN_PAGE_SIZE_OPTIONS.map((value) => (
                      <SelectItem key={value} value={String(value)}>
                        {value}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
              <div className="grid w-full grid-cols-[auto_minmax(0,1fr)] items-center gap-2 sm:flex sm:w-auto sm:items-center">
                <span className="text-xs text-muted-foreground sm:text-sm">Sorteren:</span>
                <Select
                  value={sort}
                  onValueChange={(value) =>
                    handleFilterChange("sort", value === "nieuwste" ? "" : value)
                  }
                >
                  <SelectTrigger className="data-[size=default]:h-11 w-full rounded-lg border-primary/40 bg-background text-sm font-semibold text-primary sm:w-[210px] sm:rounded-full sm:data-[size=default]:h-10">
                    <SelectValue />
                  </SelectTrigger>
                  <SelectContent className="bg-card border-border">
                    {sortOptions.map((option) => (
                      <SelectItem key={option.value} value={option.value}>
                        {option.label}
                      </SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              </div>
            </div>
          </div>

          {searchErrorMessage ? (
            <p className="mb-3 text-sm text-destructive">{searchErrorMessage}</p>
          ) : null}

          <ScrollArea className="min-w-0 flex-1">
            {displayJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted-foreground">
                Geen vacatures gevonden voor deze filters.
              </div>
            ) : (
              <div className="space-y-3 pb-4 sm:space-y-4">
                {displayJobs.map((job) => (
                  <JobListItem
                    key={job.id}
                    job={job}
                    isActive={job.id === activeId}
                    variant="card"
                    hasPipeline={job.hasPipeline}
                    pipelineCount={job.pipelineCount}
                    href={buildDetailHref(job.id)}
                  />
                ))}
              </div>
            )}
          </ScrollArea>

          {totalPages > 1 && (
            <div className="mt-4 flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row sm:items-center sm:justify-between">
              <Button
                variant="outline"
                size="sm"
                className="h-11 w-full border-border bg-background text-foreground sm:h-9 sm:w-auto"
                disabled={pageParam <= 1 || isFetching}
                onClick={() =>
                  pushOpdrachtenParams(searchParams, router, pathname, {
                    pagina: String(pageParam - 1),
                  })
                }
              >
                <ChevronLeft className="mr-1 h-4 w-4" />
                Vorige
              </Button>
              <p className="text-center text-sm text-muted-foreground">
                Pagina {pageParam} van {totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-11 w-full border-border bg-background text-foreground sm:h-9 sm:w-auto"
                disabled={pageParam >= totalPages || isFetching}
                onClick={() =>
                  pushOpdrachtenParams(searchParams, router, pathname, {
                    pagina: String(pageParam + 1),
                  })
                }
              >
                Volgende
                <ChevronRight className="ml-1 h-4 w-4" />
              </Button>
            </div>
          )}
        </div>
      </div>
    </aside>
  );
}
