"use client";

/**
 * Custom hook encapsulating all filter state, URL sync, and search query logic
 * for the opdrachten sidebar.
 */
import { useQuery } from "@tanstack/react-query";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useCallback, useEffect, useMemo, useState } from "react";
import { getOpdrachtenBasePath } from "@/src/lib/opdrachten-filter-url";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  getHoursRangeForBucket,
  getProvinceAnchor,
  MAX_OPDRACHTEN_LIMIT,
  normalizeOpdrachtenSearchQuery,
  OPDRACHTEN_REGION_OPTIONS,
  OPDRACHTEN_SORT_OPTIONS,
  parseOpdrachtenFilters,
} from "@/src/lib/opdrachten-filters";
import type {
  FilterOption,
  FilterOverrideValue,
  SearchQueryKeyPayload,
  SidebarJob,
} from "./sidebar-types";
import {
  hasUrgentDeadline,
  pushOpdrachtenParams,
  searchJobs,
  toggleFilterValue,
} from "./sidebar-utils";

function useDebouncedValue<T>(value: T, delayMs = 300): T {
  const [debouncedValue, setDebouncedValue] = useState(value);

  useEffect(() => {
    const timeout = setTimeout(() => {
      setDebouncedValue(value);
    }, delayMs);

    return () => clearTimeout(timeout);
  }, [value, delayMs]);

  return debouncedValue;
}

export function useSidebarFilters({
  initialJobs,
  initialTotal,
  categories,
}: {
  initialJobs: SidebarJob[];
  initialTotal: number;
  categories: string[];
}) {
  const pathname = usePathname();
  const router = useRouter();
  const searchParams = useSearchParams();
  const isOverviewPage = pathname === "/vacatures";
  const match = pathname.match(/^\/(?:vacatures|opdrachten)\/(.+)$/);
  const activeId = match?.[1] ?? null;

  // URL as source of truth for TanStack Query
  const parsedFilters = parseOpdrachtenFilters(new URLSearchParams(searchParams.toString()));
  const q = parsedFilters.q ?? "";
  const committedSearchQuery = normalizeOpdrachtenSearchQuery(q) ?? "";
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
  const hasSearchQuery = committedSearchQuery.length > 0;
  const sortOptions = hasSearchQuery
    ? OPDRACHTEN_SORT_OPTIONS
    : OPDRACHTEN_SORT_OPTIONS.filter((option) => option.value !== "relevantie");
  const sort =
    !hasSearchQuery && parsedFilters.sort === "relevantie" ? "nieuwste" : parsedFilters.sort;
  const tariefMinParamFromUrl = parsedFilters.rateMin != null ? String(parsedFilters.rateMin) : "";
  const tariefMaxParamFromUrl = parsedFilters.rateMax != null ? String(parsedFilters.rateMax) : "";
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

  // Local filter state — updated immediately on user interaction.
  // The TanStack Query key reads from these local values, not from useSearchParams(),
  // because router.push defers URL updates via startTransition and useSearchParams
  // doesn't reflect changes in time for the query key to change.
  // URL push remains a side effect for bookmarking.
  const [localStatus, setLocalStatus] = useState(status);
  const [localPlatform, setLocalPlatform] = useState(platform);
  const [localEndClient, setLocalEndClient] = useState(endClient);
  const [localVaardigheid, setLocalVaardigheid] = useState(vaardigheid);
  const [localProvincie, setLocalProvincie] = useState(provincie);
  const [localContractType, setLocalContractType] = useState(contractType);
  const [localSort, setLocalSort] = useState(sort);
  const [localRegios, setLocalRegios] = useState(regios);
  const [localVakgebieden, setLocalVakgebieden] = useState(vakgebieden);
  const [localPage, setLocalPage] = useState(pageParam);

  const [inputValue, setInputValue] = useState(q);
  const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false);
  const [hoursMinInput, setHoursMinInput] = useState(urenPerWeekMin);
  const [hoursMaxInput, setHoursMaxInput] = useState(urenPerWeekMax);
  const [radiusKmInput, setRadiusKmInput] = useState(straalKm);
  const [rateMinInput, setRateMinInput] = useState(tariefMinParamFromUrl);
  const [rateMaxInput, setRateMaxInput] = useState(tariefMaxParamFromUrl);
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

  // Sync URL → local state when URL actually changes (browser back/forward, external navigation).
  // Skip resetting inputValue if the URL query matches what we already debounced —
  // this prevents the search bar from "jumping" while the user is still typing.
  // biome-ignore lint/correctness/useExhaustiveDependencies: sync from URL on searchParams change only
  useEffect(() => {
    const normalizedUrlQ = normalizeOpdrachtenSearchQuery(q) ?? "";
    const normalizedLocal = normalizeOpdrachtenSearchQuery(inputValue) ?? "";
    if (normalizedUrlQ !== normalizedLocal) {
      setInputValue(q);
    }
    setLocalStatus(status);
    setLocalPlatform(platform);
    setLocalEndClient(endClient);
    setLocalVaardigheid(vaardigheid);
    setLocalProvincie(provincie);
    setLocalContractType(contractType);
    setLocalSort(sort);
    setLocalRegios(regios);
    setLocalVakgebieden(vakgebieden);
    setLocalPage(pageParam);
    setHoursMinInput(urenPerWeekMin);
    setHoursMaxInput(urenPerWeekMax);
    setRadiusKmInput(straalKm);
    setRateMinInput(tariefMinParamFromUrl);
    setRateMaxInput(tariefMaxParamFromUrl);
  }, [searchParams]);

  const debouncedHoursMin = useDebouncedValue(hoursMinInput);
  const debouncedHoursMax = useDebouncedValue(hoursMaxInput);
  const debouncedRadiusKm = useDebouncedValue(radiusKmInput);
  const debouncedRateMin = useDebouncedValue(rateMinInput);
  const debouncedRateMax = useDebouncedValue(rateMaxInput);
  const debouncedSearchInput = useDebouncedValue(inputValue);
  const debouncedSearchQuery = normalizeOpdrachtenSearchQuery(debouncedSearchInput) ?? "";
  const debouncedHoursHasManualInput = useMemo(
    () => debouncedHoursMin !== urenPerWeekMin || debouncedHoursMax !== urenPerWeekMax,
    [debouncedHoursMin, debouncedHoursMax, urenPerWeekMin, urenPerWeekMax],
  );
  const effectiveHoursPerWeekBucket = debouncedHoursHasManualInput ? "" : urenPerWeek;
  const sortedRegios = useMemo(
    () => [...localRegios].sort((a, b) => a.localeCompare(b)),
    [localRegios],
  );
  const sortedVakgebieden = useMemo(
    () => [...localVakgebieden].sort((a, b) => a.localeCompare(b)),
    [localVakgebieden],
  );

  // Use debouncedSearchQuery (from local input) instead of committedSearchQuery
  // (from URL) as the query key. This ensures the fetch fires immediately when
  // the user types, without waiting for the router.push → useSearchParams round-trip.
  // The URL push remains a side effect for bookmarking/sharing.
  const searchQueryKey = useMemo<SearchQueryKeyPayload>(
    () => ({
      q: debouncedSearchQuery,
      platform: localPlatform,
      endClient: localEndClient,
      vaardigheid: localVaardigheid,
      status: localStatus,
      provincie: localProvincie,
      regios: sortedRegios,
      vakgebieden: sortedVakgebieden,
      urenPerWeek: effectiveHoursPerWeekBucket,
      urenPerWeekMin: debouncedHoursMin,
      urenPerWeekMax: debouncedHoursMax,
      straalKm: debouncedRadiusKm,
      contractType: localContractType,
      tariefMin: debouncedRateMin,
      tariefMax: debouncedRateMax,
      sort: localSort,
      page: localPage,
      limit: limitParam,
    }),
    [
      debouncedSearchQuery,
      localPlatform,
      localEndClient,
      localVaardigheid,
      localStatus,
      localProvincie,
      sortedRegios,
      sortedVakgebieden,
      effectiveHoursPerWeekBucket,
      debouncedHoursMin,
      debouncedHoursMax,
      debouncedRadiusKm,
      localContractType,
      debouncedRateMin,
      debouncedRateMax,
      localSort,
      localPage,
      limitParam,
    ],
  );

  useEffect(() => {
    const shouldPushHours = debouncedHoursHasManualInput;
    const shouldPushRadius = debouncedRadiusKm !== straalKm;
    const shouldPushRateMin = debouncedRateMin !== tariefMinParamFromUrl;
    const shouldPushRateMax = debouncedRateMax !== tariefMaxParamFromUrl;

    if (!shouldPushHours && !shouldPushRadius && !shouldPushRateMin && !shouldPushRateMax) return;

    pushOpdrachtenParams(searchParams, router, pathname, {
      urenPerWeek: shouldPushHours ? "" : urenPerWeek,
      urenPerWeekMin: debouncedHoursMin,
      urenPerWeekMax: debouncedHoursMax,
      straalKm: debouncedRadiusKm,
      tariefMin: debouncedRateMin,
      tariefMax: debouncedRateMax,
      pagina: "1",
    });
  }, [
    debouncedHoursHasManualInput,
    debouncedHoursMin,
    debouncedHoursMax,
    debouncedRadiusKm,
    debouncedRateMin,
    debouncedRateMax,
    straalKm,
    tariefMinParamFromUrl,
    tariefMaxParamFromUrl,
    urenPerWeek,
    router,
    pathname,
    searchParams,
  ]);

  useEffect(() => {
    if (debouncedSearchQuery === committedSearchQuery) return;

    pushOpdrachtenParams(searchParams, router, pathname, {
      q: debouncedSearchQuery,
      pagina: "1",
    });
  }, [debouncedSearchQuery, committedSearchQuery, pathname, searchParams, router]);

  const { data, error, isFetching } = useQuery({
    queryKey: ["opdrachten-search", searchQueryKey],
    queryFn: ({ signal }) =>
      searchJobs({
        q: debouncedSearchQuery,
        platform: localPlatform,
        endClient: localEndClient,
        vaardigheid: localVaardigheid,
        status: localStatus,
        provincie: localProvincie,
        regios: sortedRegios,
        vakgebieden: sortedVakgebieden,
        urenPerWeek: effectiveHoursPerWeekBucket,
        urenPerWeekMin: debouncedHoursMin,
        urenPerWeekMax: debouncedHoursMax,
        straalKm: debouncedRadiusKm,
        contractType: localContractType,
        tariefMin: debouncedRateMin,
        tariefMax: debouncedRateMax,
        sort: localSort,
        page: localPage,
        limit: limitParam,
        signal,
      }),
    staleTime: 30_000,
    placeholderData: (prev) => prev,
    initialData:
      localPage === 1 &&
      limitParam === DEFAULT_OPDRACHTEN_LIMIT &&
      !debouncedSearchQuery &&
      !localPlatform &&
      !localEndClient &&
      !localVaardigheid &&
      localStatus === "open" &&
      !localProvincie &&
      localRegios.length === 0 &&
      localVakgebieden.length === 0 &&
      !debouncedHoursMin &&
      !debouncedHoursMax &&
      !debouncedRadiusKm &&
      !localContractType &&
      !debouncedRateMin &&
      !debouncedRateMax &&
      localSort === "nieuwste"
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
    Number(Boolean(hoursMinInput || hoursMaxInput)) +
    Number(Boolean(radiusKmInput)) +
    Number(Boolean(contractType)) +
    Number(Boolean(rateMinInput || rateMaxInput)) +
    Number(sort !== "nieuwste");

  const buildDetailHref = useCallback(
    (jobId: string) => {
      const base = "/vacatures";
      return detailQuery ? `${base}/${jobId}?${detailQuery}` : `${base}/${jobId}`;
    },
    [detailQuery],
  );

  const pushParams = useCallback(
    (overrides: Record<string, FilterOverrideValue>) => {
      pushOpdrachtenParams(searchParams, router, pathname, overrides);
    },
    [searchParams, router, pathname],
  );

  const handleFilterChange = useCallback(
    (paramKey: string, value: string) => {
      // Update local state immediately so TanStack Query key changes now
      if (paramKey === "status")
        setLocalStatus(value === "" ? "open" : (value as typeof localStatus));
      else if (paramKey === "platform") setLocalPlatform(value);
      else if (paramKey === "endClient") setLocalEndClient(value);
      else if (paramKey === "vaardigheid") setLocalVaardigheid(value);
      else if (paramKey === "contractType") setLocalContractType(value);
      else if (paramKey === "sort") setLocalSort((value || "nieuwste") as typeof localSort);
      setLocalPage(1);
      pushParams({ [paramKey]: value, pagina: "1" });
    },
    [pushParams],
  );

  const handleToggleRegio = useCallback(
    (value: string) => {
      const next = toggleFilterValue(localRegios, value) as typeof localRegios;
      setLocalRegios(next);
      setLocalPage(1);
      pushParams({ regio: next, pagina: "1" });
    },
    [pushParams, localRegios],
  );

  const handleToggleVakgebied = useCallback(
    (value: string) => {
      const next = toggleFilterValue(localVakgebieden, value);
      setLocalVakgebieden(next);
      setLocalPage(1);
      pushParams({ vakgebied: next, pagina: "1" });
    },
    [pushParams, localVakgebieden],
  );

  const handleHoursRangeChange = useCallback(
    (field: "urenPerWeekMin" | "urenPerWeekMax", value: string) => {
      if (field === "urenPerWeekMin") {
        setHoursMinInput(value);
      } else {
        setHoursMaxInput(value);
      }
    },
    [],
  );

  const handleRadiusChange = useCallback((value: string) => {
    setRadiusKmInput(value);
  }, []);

  const handleProvinceChange = useCallback(
    (value: string) => {
      const nextProvince = value === "__all__" ? "" : value;
      setLocalProvincie(nextProvince);
      setLocalPage(1);
      if (!nextProvince) {
        setRadiusKmInput("");
      }
      pushParams(
        nextProvince
          ? { provincie: nextProvince, pagina: "1" }
          : { provincie: "", straalKm: "", pagina: "1" },
      );
    },
    [pushParams],
  );

  const resetFilters = useCallback(() => {
    setLocalStatus("open");
    setLocalPlatform("");
    setLocalEndClient("");
    setLocalVaardigheid("");
    setLocalProvincie("");
    setLocalContractType("");
    setLocalSort("nieuwste");
    setLocalRegios([]);
    setLocalVakgebieden([]);
    setLocalPage(1);
    setInputValue("");
    setHoursMinInput("");
    setHoursMaxInput("");
    setRadiusKmInput("");
    setRateMinInput("");
    setRateMaxInput("");
    router.push(getOpdrachtenBasePath(pathname));
  }, [router, pathname]);

  return {
    // Routing state
    isOverviewPage,
    activeId,

    // Filter values
    platform,
    endClient,
    vaardigheid,
    status,
    provincie,
    regios,
    vakgebieden,
    contractType,
    sort,
    sortOptions,
    provinceAnchor,
    regionOptions,
    categoryOptions,

    // Input state
    inputValue,
    setInputValue,
    hoursMinInput,
    hoursMaxInput,
    radiusKmInput,
    setRadiusKmInput,
    rateMinInput,
    setRateMinInput,
    rateMaxInput,
    setRateMaxInput,
    mobileFiltersOpen,
    setMobileFiltersOpen,

    // Display data
    displayJobs,
    displayTotal,
    displayPerPage,
    totalPages,
    pageParam,
    searchErrorMessage,
    isFetching,
    shortlistCount,
    urgentDeadlineCount,
    activeFilterCount,

    // Actions
    buildDetailHref,
    pushParams,
    handleFilterChange,
    handleToggleRegio,
    handleToggleVakgebied,
    handleHoursRangeChange,
    handleRadiusChange,
    handleProvinceChange,
    resetFilters,
  };
}
