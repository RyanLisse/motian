"use client";

import { useQuery } from "@tanstack/react-query";
import { ChevronDown, ChevronLeft, ChevronRight, Loader2, RotateCcw, Search } from "lucide-react";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useDeferredValue, useEffect, useRef, useState } from "react";
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
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { Slider } from "@/components/ui/slider";
import { cn } from "@/lib/utils";
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

interface OpdrachtenSidebarProps {
  jobs: SidebarJob[];
  totalCount: number;
  platforms: string[];
  endClients: string[];
  categories: string[];
}

const CONTRACT_TYPES = [
  { value: "freelance", label: "Freelance" },
  { value: "interim", label: "Interim" },
  { value: "vast", label: "Vast" },
  { value: "opdracht", label: "Opdracht" },
];

const DAY_IN_MS = 24 * 60 * 60 * 1000;
const PARAM_ALIASES: Record<string, string[]> = {
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
  const p = new URLSearchParams(searchParams);
  for (const [k, v] of Object.entries(overrides)) {
    p.delete(k);

    for (const alias of PARAM_ALIASES[k] ?? []) {
      p.delete(alias);
    }

    if (Array.isArray(v)) {
      v.filter(Boolean).forEach((item) => {
        p.append(k, item);
      });
    } else if (v) {
      p.set(k, v);
    } else {
      p.delete(k);
    }
  }
  const query = p.toString();
  const basePath = pathname.startsWith("/opdrachten/") ? pathname : "/opdrachten";
  router.push(query ? `${basePath}?${query}` : basePath);
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
            className="flex cursor-pointer items-center gap-3 rounded-md px-2 py-2 text-sm hover:bg-accent/50"
          >
            <Checkbox
              id={checkboxId}
              checked={checked}
              onCheckedChange={() => onToggle(option.value)}
            />
            <span className="text-foreground">{option.label}</span>
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
}: {
  label: string;
  options: FilterOption[];
  selectedValues: string[];
  onToggle: (value: string) => void;
}) {
  const selectedLabels = options
    .filter((option) => selectedValues.includes(option.value))
    .map((option) => option.label);

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button
          variant="outline"
          className="h-7 flex-1 justify-between border-border bg-card px-2 text-[10px] text-foreground"
        >
          <span className="truncate">{summarizeSelection(label, selectedLabels)}</span>
          <ChevronDown className="h-3.5 w-3.5 text-muted-foreground" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="start" className="bg-card border-border">
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
    <div className={compact ? "px-3 pb-2" : undefined}>
      <div className={cn("mb-2 flex items-center justify-between gap-2", compact && "mb-1")}>
        <span
          className={cn(
            "font-medium text-foreground",
            compact ? "text-[10px] uppercase tracking-wide text-muted-foreground" : "text-sm",
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
            compact ? "text-[10px]" : "text-xs",
          )}
        >
          Reset
        </button>
      </div>

      <div className={cn("rounded-lg border border-border bg-background p-3", compact && "p-2")}>
        <div className="mb-2 flex items-center justify-between gap-2">
          <span className={cn("font-medium text-foreground", compact ? "text-xs" : "text-sm")}>
            {radiusKm ? `${radiusKm} km` : "Geen straal"}
          </span>
          <span className={cn("text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>
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
        <div className="mt-2 flex items-center justify-between text-[10px] text-muted-foreground">
          {sliderOptions.map((value) => (
            <span key={value}>{value === 0 ? "0" : value}</span>
          ))}
        </div>
      </div>

      <p className={cn("mt-2 text-muted-foreground", compact ? "text-[10px]" : "text-xs")}>
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
  if (!res.ok) throw new Error("Search failed");
  return res.json();
}

export function OpdrachtenSidebar({
  jobs: initialJobs,
  totalCount: initialTotal,
  platforms,
  endClients,
  categories,
}: OpdrachtenSidebarProps) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOverviewPage = pathname === "/opdrachten";
  const match = pathname.match(/^\/opdrachten\/(.+)$/);
  const activeId = match?.[1] ?? null;

  // URL as source of truth for TanStack Query: key and fetch use searchParams so e.g. top-opdrachtgevers link shows correct results immediately
  const parsedFilters = parseOpdrachtenFilters(new URLSearchParams(searchParams.toString()));
  const q = parsedFilters.q ?? "";
  const platform = parsedFilters.platform ?? "";
  const endClient = parsedFilters.endClient ?? "";
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
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const provinceAnchor = getProvinceAnchor(provincie);
  const regionOptions: FilterOption[] = OPDRACHTEN_REGION_OPTIONS.map((option) => ({
    value: option.value,
    label: option.label,
  }));
  const categoryOptions: FilterOption[] = categories.map((category) => ({
    value: category,
    label: category,
  }));

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

  const { data, isFetching } = useQuery({
    queryKey: [
      "opdrachten-search",
      q,
      platform,
      endClient,
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
  const detailQuery = searchParams.toString();
  const shortlistCount = displayJobs.filter((job) => (job.pipelineCount ?? 0) > 0).length;
  const urgentDeadlineCount = displayJobs.filter((job) =>
    hasUrgentDeadline(job.applicationDeadline),
  ).length;
  const buildDetailHref = (jobId: string) =>
    detailQuery ? `/opdrachten/${jobId}?${detailQuery}` : `/opdrachten/${jobId}`;

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
    const basePath = pathname.startsWith("/opdrachten/") ? pathname : "/opdrachten";
    router.push(basePath);
  };

  if (!isOverviewPage) {
    return (
      <aside className="flex h-full w-full flex-col">
        <div className="px-3 pt-3 pb-2 shrink-0">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
            <Input
              placeholder="Zoek vacatures..."
              value={inputValue}
              onChange={(e) => setInputValue(e.target.value)}
              className="pl-8 h-8 bg-card border-border text-xs text-foreground placeholder:text-muted-foreground focus-visible:ring-1 focus-visible:ring-primary focus-visible:ring-offset-0"
            />
            {isFetching && (
              <Loader2 className="absolute right-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground animate-spin" />
            )}
          </div>
        </div>

        <div className="px-3 pb-2 flex items-center gap-1.5 shrink-0">
          <Select
            value={platform || undefined}
            onValueChange={(v) => handleFilterChange("platform", v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="flex-1 h-7 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Platform" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="__all__" className="text-foreground text-xs">
                Alle platforms
              </SelectItem>
              {platforms.map((p) => (
                <SelectItem key={p} value={p} className="capitalize text-foreground text-xs">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>

          <Select
            value={endClient || undefined}
            onValueChange={(v) => handleFilterChange("endClient", v === "__all__" ? "" : v)}
          >
            <SelectTrigger className="flex-1 h-7 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Eindopdrachtgever" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="__all__" className="text-foreground text-xs">
                Alle eindopdrachtgevers
              </SelectItem>
              {endClients.map((client) => (
                <SelectItem key={client} value={client} className="text-foreground text-xs">
                  {client}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="px-3 pb-2 flex items-center gap-1.5 shrink-0">
          <Select
            value={status}
            onValueChange={(v) => handleFilterChange("status", v === "open" ? "" : v)}
          >
            <SelectTrigger className="flex-1 h-7 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Status" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="open" className="text-foreground text-xs">
                Open
              </SelectItem>
              <SelectItem value="closed" className="text-foreground text-xs">
                Gesloten
              </SelectItem>
              <SelectItem value="all" className="text-foreground text-xs">
                Alles
              </SelectItem>
            </SelectContent>
          </Select>

          <Select value={provincie || undefined} onValueChange={handleProvinceChange}>
            <SelectTrigger className="flex-1 h-7 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Provincie" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              <SelectItem value="__all__" className="text-foreground text-xs">
                Alle provincies
              </SelectItem>
              {OPDRACHTEN_PROVINCES.map((p) => (
                <SelectItem key={p} value={p} className="text-foreground text-xs">
                  {p}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="px-3 pb-2 flex items-center gap-1.5 shrink-0">
          <CompactMultiSelectFilter
            label="Regio"
            options={regionOptions}
            selectedValues={regios}
            onToggle={handleToggleRegio}
          />
          <CompactMultiSelectFilter
            label="Vakgebied"
            options={categoryOptions}
            selectedValues={vakgebieden}
            onToggle={handleToggleVakgebied}
          />
        </div>

        <div className="px-3 pb-2 shrink-0">
          <div className="mb-1 flex items-center justify-between gap-2">
            <span className="text-[10px] font-medium uppercase tracking-wide text-muted-foreground">
              Uren per week
            </span>
            <span className="text-[10px] text-muted-foreground">
              {summarizeHoursRange(urenPerWeekMin, urenPerWeekMax)}
            </span>
          </div>
          <div className="grid grid-cols-2 gap-1.5">
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Min"
              value={urenPerWeekMin}
              onChange={(e) => handleHoursRangeChange("urenPerWeekMin", e.target.value)}
              className="h-8 border-border bg-card text-xs"
            />
            <Input
              type="number"
              inputMode="numeric"
              min="1"
              placeholder="Max"
              value={urenPerWeekMax}
              onChange={(e) => handleHoursRangeChange("urenPerWeekMax", e.target.value)}
              className="h-8 border-border bg-card text-xs"
            />
          </div>
        </div>

        <RadiusSliderField
          provinceAnchor={provinceAnchor}
          radiusKm={straalKm}
          onRadiusChange={handleRadiusChange}
          compact
        />

        <div className="px-3 pb-2 flex items-center gap-1.5 shrink-0">
          <Select
            value={sort}
            onValueChange={(value) => handleFilterChange("sort", value === "nieuwste" ? "" : value)}
          >
            <SelectTrigger className="h-7 flex-1 bg-card border-border text-foreground text-[10px] px-2">
              <SelectValue placeholder="Sortering" />
            </SelectTrigger>
            <SelectContent className="bg-card border-border">
              {sortOptions.map((option) => (
                <SelectItem
                  key={option.value}
                  value={option.value}
                  className="text-foreground text-xs"
                >
                  {option.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
        </div>

        <div className="px-4 py-2 border-t border-b border-border shrink-0 flex items-center justify-between gap-3">
          <div className="min-w-0">
            <p className="text-[10px] font-medium text-muted-foreground uppercase tracking-wider">
              {displayTotal} vacatures
            </p>
            <div className="mt-1 flex flex-wrap gap-1.5">
              <Badge variant="outline" className="h-4 px-1.5 text-[9px] text-muted-foreground">
                {shortlistCount > 0 ? `${shortlistCount} met shortlist` : "Nog geen shortlist"}
              </Badge>
              {urgentDeadlineCount > 0 ? (
                <Badge
                  variant="outline"
                  className="h-4 border-amber-500/20 bg-amber-500/10 px-1.5 text-[9px] text-amber-700 dark:text-amber-300"
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
              <SelectTrigger className="h-7 w-[76px] bg-card border-border text-foreground text-[10px] px-2">
                <SelectValue />
              </SelectTrigger>
              <SelectContent className="bg-card border-border">
                {OPDRACHTEN_PAGE_SIZE_OPTIONS.map((value) => (
                  <SelectItem key={value} value={String(value)} className="text-foreground text-xs">
                    {value} / pg
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
            {totalPages > 1 && (
              <p className="text-[10px] text-muted-foreground">
                {pageParam}/{totalPages}
              </p>
            )}
          </div>
        </div>

        <ScrollArea className="flex-1">
          {displayJobs.length === 0 ? (
            <div className="px-4 py-8 text-center text-xs text-muted-foreground">
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
          <div className="px-3 py-2 border-t border-border shrink-0 flex items-center justify-between">
            <Button
              variant="ghost"
              size="sm"
              className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-accent text-xs"
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
              className="h-7 px-2 text-muted-foreground hover:text-foreground hover:bg-accent text-xs"
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
    <aside className="h-full w-full bg-sidebar/25">
      <div className="grid h-full min-h-0 lg:grid-cols-[300px_minmax(0,1fr)]">
        <div className="border-b border-border/70 px-4 py-5 lg:border-b-0 lg:border-r lg:px-5 lg:py-6">
          <div className="mb-4 flex items-center justify-between">
            <h3 className="text-2xl font-semibold tracking-tight text-foreground">Zoekfilter</h3>
            <button
              type="button"
              onClick={resetFilters}
              className="inline-flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-primary hover:opacity-80"
            >
              <RotateCcw className="h-3.5 w-3.5" />
              Wis filters
            </button>
          </div>

          <div className="space-y-4">
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
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
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
              <Select
                value={endClient || "__all__"}
                onValueChange={(v) => handleFilterChange("endClient", v === "__all__" ? "" : v)}
              >
                <SelectTrigger
                  id="opdrachten-eindopdrachtgever"
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
                >
                  <SelectValue placeholder="Alle eindopdrachtgevers" />
                </SelectTrigger>
                <SelectContent className="bg-card border-border">
                  <SelectItem value="__all__" className="text-foreground">
                    Alle eindopdrachtgevers
                  </SelectItem>
                  {endClients.map((client) => (
                    <SelectItem key={client} value={client} className="text-foreground">
                      {client}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
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
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
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
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
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
                {summarizeHoursRange(urenPerWeekMin, urenPerWeekMax)} — opdrachten overlappen met
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
                onValueChange={(v) => handleFilterChange("contractType", v === "__all__" ? "" : v)}
              >
                <SelectTrigger
                  id="opdrachten-contracttype"
                  className="h-11 rounded-lg border-border bg-background text-left text-sm"
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

        <div className="flex min-h-0 flex-col px-4 py-4 sm:px-6 sm:py-5">
          <div className="mb-4 flex flex-wrap items-center gap-3 border-b border-border/70 pb-4">
            <div className="space-y-2">
              <div className="text-lg font-semibold text-foreground">
                {displayTotal} opdrachten weergegeven
              </div>
              <div className="flex flex-wrap gap-2">
                <Badge variant="outline" className="text-xs text-muted-foreground">
                  {shortlistCount > 0 ? `${shortlistCount} met shortlist` : "Nog geen shortlist"}
                </Badge>
                {urgentDeadlineCount > 0 ? (
                  <Badge
                    variant="outline"
                    className="border-amber-500/20 bg-amber-500/10 text-xs text-amber-700 dark:text-amber-300"
                  >
                    {urgentDeadlineCount} deadlines vragen aandacht
                  </Badge>
                ) : null}
              </div>
            </div>
            <div className="ml-auto flex items-center gap-2">
              <span className="text-sm text-muted-foreground">Per pagina:</span>
              <Select
                value={String(displayPerPage)}
                onValueChange={(v) =>
                  pushOpdrachtenParams(searchParams, router, pathname, {
                    limit: v === String(DEFAULT_OPDRACHTEN_LIMIT) ? "" : v,
                    pagina: "1",
                  })
                }
              >
                <SelectTrigger className="h-10 w-[110px] rounded-full border-border bg-background text-sm font-semibold text-foreground">
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
              <span className="text-sm text-muted-foreground">Sorteren:</span>
              <Select
                value={sort}
                onValueChange={(value) =>
                  handleFilterChange("sort", value === "nieuwste" ? "" : value)
                }
              >
                <SelectTrigger className="h-10 w-[210px] rounded-full border-primary/40 bg-background text-sm font-semibold text-primary">
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

          <ScrollArea className="flex-1">
            {displayJobs.length === 0 ? (
              <div className="rounded-xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted-foreground">
                Geen vacatures gevonden voor deze filters.
              </div>
            ) : (
              <div className="space-y-4 pb-4 pr-1">
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
            <div className="mt-4 flex items-center justify-between border-t border-border/70 pt-4">
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-border bg-background text-foreground"
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
              <p className="text-sm text-muted-foreground">
                Pagina {pageParam} van {totalPages}
              </p>
              <Button
                variant="outline"
                size="sm"
                className="h-9 border-border bg-background text-foreground"
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
