import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  applyOpdrachtenFilterOverrides,
  buildOpdrachtenFilterHref,
} from "../src/lib/opdrachten-filter-url";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  getHoursRangeForBucket,
  getOpdrachtenServiceSort,
  hasExplicitOpdrachtenSort,
  MAX_OPDRACHTEN_LIMIT,
  normalizeOpdrachtenStatus,
  OPDRACHTEN_PAGE_SIZE_OPTIONS,
  OPDRACHTEN_SORT_OPTIONS,
  parseOpdrachtenFilters,
  validateOpdrachtenQueryParams,
} from "../src/lib/opdrachten-filters";
import { parsePagination } from "../src/lib/pagination";

function readFile(...segments: string[]) {
  return readFileSync(path.join(process.cwd(), ...segments), "utf8");
}

describe("Opdrachten pagination aliases", () => {
  it("supports Dutch and English page/limit aliases", () => {
    const dutch = parsePagination(new URLSearchParams("pagina=2&limit=25"), {
      limit: DEFAULT_OPDRACHTEN_LIMIT,
      maxLimit: MAX_OPDRACHTEN_LIMIT,
    });
    const english = parsePagination(new URLSearchParams("page=3&perPage=10"), {
      limit: DEFAULT_OPDRACHTEN_LIMIT,
      maxLimit: MAX_OPDRACHTEN_LIMIT,
    });

    expect(dutch).toEqual({ page: 2, limit: 25, offset: 25 });
    expect(english).toEqual({ page: 3, limit: 10, offset: 20 });
  });

  it("defaults opdrachten pagination to 50 and caps at 100", () => {
    const defaults = parsePagination(new URLSearchParams(), {
      limit: DEFAULT_OPDRACHTEN_LIMIT,
      maxLimit: MAX_OPDRACHTEN_LIMIT,
    });
    const capped = parsePagination(new URLSearchParams("limit=999"), {
      limit: DEFAULT_OPDRACHTEN_LIMIT,
      maxLimit: MAX_OPDRACHTEN_LIMIT,
    });

    expect(defaults.limit).toBe(DEFAULT_OPDRACHTEN_LIMIT);
    expect(capped.limit).toBe(MAX_OPDRACHTEN_LIMIT);
    expect(OPDRACHTEN_PAGE_SIZE_OPTIONS).toEqual([10, 25, 50, 100]);
  });
});

describe("Opdrachten status normalization", () => {
  it("defaults invalid or missing status values to open", () => {
    expect(normalizeOpdrachtenStatus(undefined)).toBe("open");
    expect(normalizeOpdrachtenStatus(null)).toBe("open");
    expect(normalizeOpdrachtenStatus("anything-else")).toBe("open");
  });

  it("preserves closed, archived, and all status values", () => {
    expect(normalizeOpdrachtenStatus("closed")).toBe("closed");
    expect(normalizeOpdrachtenStatus("archived")).toBe("archived");
    expect(normalizeOpdrachtenStatus("all")).toBe("all");
  });
});

describe("Opdrachten shared filter parsing", () => {
  it("normalizes multi-select recruiter filters and numeric hours ranges from URL params", () => {
    const parsed = parseOpdrachtenFilters(
      new URLSearchParams(
        "q=manager&platform=opdrachtoverheid&endClient=Gemeente%20Utrecht&status=closed&provincie=utrecht&regio=randstad,noord&vakgebied=ICT&vakgebied=Data&vaardigheid=skill:java&urenPerWeek=24_32&urenPerWeekMin=24&urenPerWeekMax=36&straalKm=25&tariefMin=80&tariefMax=120&contractType=interim&sort=deadline",
      ),
    );

    expect(parsed).toEqual({
      q: "manager",
      platform: "opdrachtoverheid",
      endClient: "Gemeente Utrecht",
      escoUri: "skill:java",
      status: "closed",
      province: "Utrecht",
      categories: ["ICT", "Data"],
      category: "ICT",
      regions: ["randstad", "noord"],
      region: "randstad",
      hoursPerWeek: "24_32",
      hoursPerWeekMin: 24,
      hoursPerWeekMax: 36,
      radiusKm: 25,
      rateMin: 80,
      rateMax: 120,
      contractType: "interim",
      sort: "deadline",
    });
  });

  it("accepts both recruiter and programmatic ESCO skill query aliases", () => {
    const recruiter = parseOpdrachtenFilters(new URLSearchParams("vaardigheid=skill:react"));
    const api = parseOpdrachtenFilters(new URLSearchParams("escoUri=skill:java"));

    expect(recruiter.escoUri).toBe("skill:react");
    expect(api.escoUri).toBe("skill:java");
    expect(
      validateOpdrachtenQueryParams(new URLSearchParams("vaardigheid=skill:react")).success,
    ).toBe(true);
    expect(validateOpdrachtenQueryParams(new URLSearchParams("escoUri=skill:java")).success).toBe(
      true,
    );
  });

  it("falls back safely for invalid province, radius, and sort params", () => {
    const parsed = parseOpdrachtenFilters(
      new URLSearchParams("provincie=unknown&straalKm=999&sort=onbekend"),
    );

    expect(parsed.province).toBeUndefined();
    expect(parsed.radiusKm).toBeUndefined();
    expect(parsed.sort).toBe("nieuwste");
  });

  it("keeps the open-ended hours bucket valid for shared query building", () => {
    expect(getHoursRangeForBucket("40_plus")).toEqual({ min: 40, max: undefined });
  });

  it("supports descending deadline and search relevance sort values", () => {
    expect(parseOpdrachtenFilters(new URLSearchParams("sort=deadline_desc")).sort).toBe(
      "deadline_desc",
    );
    expect(parseOpdrachtenFilters(new URLSearchParams("sort=relevantie")).sort).toBe("relevantie");
    expect(OPDRACHTEN_SORT_OPTIONS).toEqual([
      { value: "nieuwste", label: "Onlangs toegevoegd" },
      { value: "deadline", label: "Sluitingsdatum oplopend" },
      { value: "deadline_desc", label: "Sluitingsdatum aflopend" },
      { value: "relevantie", label: "Relevantie" },
    ]);
  });

  it("keeps missing sort distinct from explicit nieuwste for API routing", () => {
    expect(hasExplicitOpdrachtenSort(new URLSearchParams())).toBe(false);
    expect(hasExplicitOpdrachtenSort(new URLSearchParams("sort=nieuwste"))).toBe(true);
    expect(getOpdrachtenServiceSort("nieuwste", true, false)).toBeUndefined();
    expect(getOpdrachtenServiceSort("nieuwste", true, true)).toBe("nieuwste");
  });

  it("validates malformed opdrachten query params with zod", () => {
    expect(validateOpdrachtenQueryParams(new URLSearchParams("page=abc")).success).toBe(false);
    expect(validateOpdrachtenQueryParams(new URLSearchParams("page=2abc")).success).toBe(false);
    expect(validateOpdrachtenQueryParams(new URLSearchParams("page=2&perPage=25")).success).toBe(
      true,
    );
  });
});

describe("Opdrachten filter URL helpers", () => {
  it("preserves endClient params while clearing pagination aliases on detail routes", () => {
    const href = buildOpdrachtenFilterHref(
      "/vacatures/job-123",
      new URLSearchParams("q=java&page=2&perPage=25&endClient=Gemeente%20Utrecht"),
      { endClient: "Gemeente Amsterdam", pagina: "1" },
    );
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/vacatures/job-123");
    expect(url.searchParams.get("q")).toBe("java");
    expect(url.searchParams.get("endClient")).toBe("Gemeente Amsterdam");
    expect(url.searchParams.get("pagina")).toBe("1");
    expect(url.searchParams.get("page")).toBeNull();
    expect(url.searchParams.get("perPage")).toBe("25");
  });

  it("removes the endClient filter cleanly when all clients are selected", () => {
    const href = buildOpdrachtenFilterHref(
      "/vacatures",
      new URLSearchParams("endClient=Gemeente%20Utrecht&sort=deadline_desc"),
      { endClient: "" },
    );
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/vacatures");
    expect(url.searchParams.get("endClient")).toBeNull();
    expect(url.searchParams.get("sort")).toBe("deadline_desc");
  });

  it("trims and deduplicates override values before building the next URL", () => {
    const nextParams = applyOpdrachtenFilterOverrides(new URLSearchParams("page=3&region=zuid"), {
      endClient: "  Gemeente Utrecht  ",
      regio: [" randstad ", "", "randstad", " noord "],
      pagina: " 1 ",
    });

    expect(nextParams.get("endClient")).toBe("Gemeente Utrecht");
    expect(nextParams.getAll("regio")).toEqual(["randstad", "noord"]);
    expect(nextParams.get("pagina")).toBe("1");
    expect(nextParams.get("page")).toBeNull();
    expect(nextParams.get("region")).toBeNull();
  });
});

describe("Opdrachten UI/API contracts", () => {
  it("sidebar exposes enhanced recruiter filters and URL-backed sorting", () => {
    const source = readFile("components", "opdrachten-sidebar.tsx");
    const normalizedSource = source.replace(/\s+/g, " ");
    const filtersSource = readFile("src", "lib", "opdrachten-filters.ts");
    const filterUrlSource = readFile("src", "lib", "opdrachten-filter-url.ts");
    const comboboxSource = readFile("components", "ui", "searchable-combobox.tsx");
    const toolbarFiltersSource = readFile("app", "vacatures", "filters.tsx");

    expect(source).toContain('placeholder="Platform"');
    expect(source).toContain("SearchableCombobox");
    expect(source).toContain('searchPlaceholder="Zoek eindopdrachtgever..."');
    expect(source).toContain('clearLabel="Alle eindopdrachtgevers"');
    expect(source).toContain('triggerId="opdrachten-eindopdrachtgever"');
    expect(source).toContain('searchPlaceholder="Zoek ESCO vaardigheid..."');
    expect(source).toContain('clearLabel="Alle vaardigheden"');
    expect(source).toContain('triggerId="opdrachten-esco-vaardigheid"');
    expect(source).toContain('placeholder="Sortering"');
    expect(source).toContain("CompactMultiSelectFilter");
    expect(source).toContain("FilterChecklist");
    expect(source).toContain("RadiusSliderField");
    expect(source).toContain("<Slider");
    expect(source).toContain("<Checkbox");
    expect(source).toContain('handleFilterChange("status"');
    expect(source).toContain('value="archived"');
    expect(source).toContain("Gearchiveerd");
    expect(source).toContain("handleToggleRegio");
    expect(source).toContain("handleToggleVakgebied");
    expect(source).toContain("handleHoursRangeChange");
    expect(source).toContain("handleRadiusChange");
    expect(source).toContain('handleFilterChange("sort"');
    expect(source).toContain("OPDRACHTEN_SORT_OPTIONS");
    expect(source).toContain('option.value !== "relevantie"');
    expect(normalizedSource).toContain(
      'const sort = !hasSearchQuery && parsedFilters.sort === "relevantie" ? "nieuwste" : parsedFilters.sort;',
    );
    expect(filtersSource).toContain("Sluitingsdatum oplopend");
    expect(filtersSource).toContain("Sluitingsdatum aflopend");
    expect(filtersSource).toContain("Relevantie");
    expect(source).toContain("regios.forEach((regio) => {");
    expect(source).toContain('params.append("regio", regio);');
    expect(source).toContain("vakgebieden.forEach((vakgebied) => {");
    expect(source).toContain('params.append("vakgebied", vakgebied);');
    expect(source).toContain('params.set("urenPerWeekMin", urenPerWeekMin)');
    expect(source).toContain('params.set("urenPerWeekMax", urenPerWeekMax)');
    expect(source).toContain("buildOpdrachtenFilterHref");
    expect(filterUrlSource).toContain('pagina: ["page"]');
    expect(source).toContain(
      `Straal wordt toegepast vanaf \${provinceAnchor.label} (\${provinceAnchor.province}).`,
    );
    expect(source).toContain('searchParams.get("page")');
    expect(source).toContain('searchParams.get("perPage")');
    expect(source).toContain("DEFAULT_OPDRACHTEN_LIMIT");
    expect(comboboxSource).toContain("id={triggerId}");
    expect(comboboxSource).toContain('aria-haspopup="listbox"');
    expect(toolbarFiltersSource).toContain('value="archived"');
    expect(toolbarFiltersSource).toContain("Gearchiveerd");
  });

  it("detail page wires a shared end-client combobox into the existing context-aware navigation", () => {
    const detailPage = readFile("app", "vacatures", "[id]", "page.tsx");
    const detailFilter = readFile("components", "opdracht-detail-end-client-filter.tsx");

    expect(detailPage).toContain("OpdrachtDetailEndClientFilter");
    expect(detailPage).toContain(`coalesce(\${jobs.endClient}, \${jobs.company})`);
    expect(detailPage).toContain("groupBy(persistedEndClient)");
    expect(detailFilter).toContain("SearchableCombobox");
    expect(detailFilter).toContain('searchPlaceholder="Zoek eindopdrachtgever..."');
    expect(detailFilter).toContain("Open gefilterde lijst");
    expect(detailFilter).toContain("buildOpdrachtenFilterHref");
  });

  it("API routes consume the shared opdrachten parser and preserve pagination response shape", () => {
    const listRoute = readFile("app", "api", "vacatures", "route.ts");
    const searchRoute = readFile("app", "api", "vacatures", "zoeken", "route.ts");

    expect(listRoute).toContain('import { runVacaturesSearch } from "@/src/lib/vacatures-search"');
    expect(listRoute).toContain("const out = await runVacaturesSearch(params);");
    expect(listRoute).toContain("paginatedResponse(data, result.total, { page, limit, offset })");

    expect(searchRoute).toContain('import { runJobPageSearch } from "@/src/lib/job-search-runner"');
    expect(searchRoute).toContain("const out = await runJobPageSearch(params);");
    expect(searchRoute).not.toContain("getJobPipelineSummary");
    expect(searchRoute).toContain("perPage: limit");
    expect(searchRoute).toContain("jobs: result.data");
  });

  it("layout seed includes persisted end-client, deadline context, category metadata, and shared page-query wiring", () => {
    const layout = readFile("app", "vacatures", "layout.tsx");
    const pageQuery = readFile("src", "services", "jobs", "page-query.ts");
    const deduplication = readFile("src", "services", "jobs", "deduplication.ts");

    expect(layout).toContain('listJobsPage({ limit: DEFAULT_OPDRACHTEN_LIMIT, status: "open" })');
    expect(layout).toContain('import { listJobsPage } from "@/src/services/jobs/page-query"');
    expect(layout).toContain('getJobStatusCondition("open")');
    expect(layout).toContain(`coalesce(\${jobs.endClient}, \${jobs.company})`);
    // PostgreSQL uses jsonb_array_elements_text() for JSON array iteration
    expect(layout).toContain("jsonb_array_elements_text");
    expect(layout).toContain(
      'import { getEscoCatalogStatus, listEscoSkillsForFilter } from "@/src/services/esco"',
    );
    expect(layout).toContain("await listEscoSkillsForFilter()");
    expect(layout).toContain("skillOptions={skillOptions}");
    expect(layout).toContain("jobs={sidebarJobs}");
    expect(pageQuery).toContain("loadJobPageRowsByIds");
    expect(deduplication).toContain("pipelineCount");
    expect(deduplication).toContain("leftJoin(pipelineCounts");
    expect(layout).toContain("categories={categories}");
    expect(deduplication).toContain("applicationDeadline");
  });

  it("detail routes preserve sidebar context and query-aware vacature links", () => {
    const shell = readFile("components", "opdrachten-layout-shell.tsx");
    const sidebar = readFile("components", "opdrachten-sidebar.tsx");
    const listItem = readFile("components", "job-list-item.tsx");

    expect(shell).toContain('pathname.startsWith("/opdrachten/")');
    expect(shell).toContain("w-full md:w-[380px]");
    expect(shell).toContain("hidden md:flex");
    expect(sidebar).toContain("const buildDetailHref = (jobId: string)");
    expect(sidebar).toContain("href={buildDetailHref(job.id)}");
    expect(sidebar).toContain("getOpdrachtenBasePath(pathname)");
    expect(sidebar).toContain("deadlines vragen aandacht");
    expect(listItem).toContain("href?: string");
    expect(listItem).toContain(`const detailHref = href ?? \`/vacatures/\${job.id}\``);
    expect(listItem).toContain("Nog te koppelen");
    expect(listItem).toContain("Sluit vandaag");
  });

  it("overview results controls and cards reflow cleanly on narrow widths", () => {
    const sidebar = readFile("components", "opdrachten-sidebar.tsx");
    const listItem = readFile("components", "job-list-item.tsx");

    expect(sidebar).toContain("grid-cols-[auto_minmax(0,1fr)]");
    expect(sidebar).toContain("const [mobileFiltersOpen, setMobileFiltersOpen] = useState(false)");
    expect(sidebar).toContain('aria-controls="opdrachten-mobile-filters"');
    expect(sidebar).toContain(
      "data-[size=default]:h-11 w-full rounded-lg border-border bg-background",
    );
    expect(sidebar).toContain("min-h-11 cursor-pointer items-center gap-3");
    expect(sidebar).toContain('<ScrollArea className="min-h-0 min-w-0 flex-1">');
    expect(sidebar).toContain("flex flex-col gap-2 border-t border-border/70 pt-4 sm:flex-row");
    expect(sidebar).toContain("Filters openen");
    expect(sidebar).toContain("Filters sluiten");
    expect(sidebar).toContain('id="opdrachten-mobile-filters"');
    expect(listItem).toContain("flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between");
    expect(listItem).toContain(
      "flex flex-col items-start gap-2.5 sm:flex-row sm:items-center sm:justify-between",
    );
    expect(listItem).toContain('<Link href={detailHref} className="block min-w-0">');
    expect(listItem).toContain(
      "w-full min-w-0 overflow-hidden rounded-xl border border-border/80 bg-card",
    );
    expect(listItem).toContain("line-clamp-2");
    expect(listItem).toContain("max-w-full whitespace-normal wrap-break-word");
  });

  it("uses the dark card-based filter panel as the primary sidebar UI", () => {
    const sidebar = readFile("components", "opdrachten-sidebar.tsx");
    const normalizedSidebar = sidebar.replace(/\s+/g, " ");

    expect(normalizedSidebar).toContain(
      'className="flex h-full w-full flex-col overflow-hidden bg-[#050506] text-white"',
    );
    expect(normalizedSidebar).toContain("rounded-[24px]");
    expect(normalizedSidebar).toContain("rounded-[20px]");
    expect(normalizedSidebar).toContain("bg-white/[0.035]");
    expect(normalizedSidebar).toContain("border-white/10");
    expect(normalizedSidebar).toContain("tracking-[0.22em]");
    expect(normalizedSidebar).toContain("text-white/45");
    expect(normalizedSidebar).toContain("placeholder:text-white/35");
  });

  it("keeps mobile filters inside a bounded flex/min-h-0 scroll container", () => {
    const sidebar = readFile("components", "opdrachten-sidebar.tsx");
    const normalizedSidebar = sidebar.replace(/\s+/g, " ");

    expect(normalizedSidebar).toContain(
      'className="flex min-h-0 flex-col border-b border-border/70 px-3 py-3 sm:px-4 sm:py-5 lg:border-b-0 lg:border-r lg:px-5 lg:py-6"',
    );
    expect(normalizedSidebar).toContain('className="flex min-h-0 flex-1 flex-col gap-3 sm:gap-4"');
    expect(normalizedSidebar).toContain(
      '"min-h-0 flex-1 space-y-3 overflow-y-auto rounded-xl border border-border/70 bg-background/60 p-3 sm:space-y-4 sm:p-4 lg:rounded-none lg:border-0 lg:bg-transparent lg:p-0"',
    );
  });
});
