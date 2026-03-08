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

  it("preserves closed and all status values", () => {
    expect(normalizeOpdrachtenStatus("closed")).toBe("closed");
    expect(normalizeOpdrachtenStatus("all")).toBe("all");
  });
});

describe("Opdrachten shared filter parsing", () => {
  it("normalizes multi-select recruiter filters and numeric hours ranges from URL params", () => {
    const parsed = parseOpdrachtenFilters(
      new URLSearchParams(
        "q=manager&platform=opdrachtoverheid&endClient=Gemeente%20Utrecht&status=closed&provincie=utrecht&regio=randstad,noord&vakgebied=ICT&vakgebied=Data&urenPerWeek=24_32&urenPerWeekMin=24&urenPerWeekMax=36&straalKm=25&tariefMin=80&tariefMax=120&contractType=interim&sort=deadline",
      ),
    );

    expect(parsed).toEqual({
      q: "manager",
      platform: "opdrachtoverheid",
      endClient: "Gemeente Utrecht",
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
      "/opdrachten/job-123",
      new URLSearchParams("q=java&page=2&perPage=25&endClient=Gemeente%20Utrecht"),
      { endClient: "Gemeente Amsterdam", pagina: "1" },
    );
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/opdrachten/job-123");
    expect(url.searchParams.get("q")).toBe("java");
    expect(url.searchParams.get("endClient")).toBe("Gemeente Amsterdam");
    expect(url.searchParams.get("pagina")).toBe("1");
    expect(url.searchParams.get("page")).toBeNull();
    expect(url.searchParams.get("perPage")).toBe("25");
  });

  it("removes the endClient filter cleanly when all clients are selected", () => {
    const href = buildOpdrachtenFilterHref(
      "/opdrachten",
      new URLSearchParams("endClient=Gemeente%20Utrecht&sort=deadline_desc"),
      { endClient: "" },
    );
    const url = new URL(href, "http://localhost");

    expect(url.pathname).toBe("/opdrachten");
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

    expect(source).toContain('placeholder="Platform"');
    expect(source).toContain("SearchableCombobox");
    expect(source).toContain('searchPlaceholder="Zoek eindopdrachtgever..."');
    expect(source).toContain('clearLabel="Alle eindopdrachtgevers"');
    expect(source).toContain('triggerId="opdrachten-eindopdrachtgever"');
    expect(source).toContain('placeholder="Sortering"');
    expect(source).toContain("CompactMultiSelectFilter");
    expect(source).toContain("FilterChecklist");
    expect(source).toContain("RadiusSliderField");
    expect(source).toContain("<Slider");
    expect(source).toContain("<Checkbox");
    expect(source).toContain('handleFilterChange("status"');
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
  });

  it("detail page wires a shared end-client combobox into the existing context-aware navigation", () => {
    const detailPage = readFile("app", "opdrachten", "[id]", "page.tsx");
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
    const listRoute = readFile("app", "api", "opdrachten", "route.ts");
    const searchRoute = readFile("app", "api", "opdrachten", "zoeken", "route.ts");

    expect(listRoute).toContain("validateOpdrachtenQueryParams(params)");
    expect(listRoute).toContain("parseOpdrachtenFilters(params)");
    expect(listRoute).toContain("categories: filters.categories");
    expect(listRoute).toContain("regions: filters.regions");
    expect(listRoute).toContain("hoursPerWeekBucket: filters.hoursPerWeek");
    expect(listRoute).toContain("minHoursPerWeek: filters.hoursPerWeekMin");
    expect(listRoute).toContain("maxHoursPerWeek: filters.hoursPerWeekMax");
    expect(listRoute).toContain("hasExplicitOpdrachtenSort(params)");
    expect(listRoute).toContain("DEFAULT_OPDRACHTEN_LIMIT");

    expect(searchRoute).toContain("validateOpdrachtenQueryParams(params)");
    expect(searchRoute).toContain("parseOpdrachtenFilters(params)");
    expect(searchRoute).toContain("categories: filters.categories");
    expect(searchRoute).toContain("regions: filters.regions");
    expect(searchRoute).toContain("hoursPerWeekBucket: filters.hoursPerWeek");
    expect(searchRoute).toContain("minHoursPerWeek: filters.hoursPerWeekMin");
    expect(searchRoute).toContain("maxHoursPerWeek: filters.hoursPerWeekMax");
    expect(searchRoute).toContain("radiusKm: filters.radiusKm");
    expect(searchRoute).toContain("hasExplicitOpdrachtenSort(params)");
    expect(searchRoute).toContain("sortBy,");
    expect(searchRoute).toContain("searchJobsUnified({");
    expect(searchRoute).toContain("perPage: limit");
    expect(searchRoute).toContain("DEFAULT_OPDRACHTEN_LIMIT");
    expect(searchRoute).toContain("applicationDeadline: job.applicationDeadline");
  });

  it("layout seed includes persisted end-client, deadline context, and category metadata", () => {
    const layout = readFile("app", "opdrachten", "layout.tsx");

    expect(layout).toContain('eq(jobs.status, "open")');
    expect(layout).toContain(`coalesce(\${jobs.endClient}, \${jobs.company})`);
    expect(layout).toContain("jsonb_array_elements_text");
    expect(layout).toContain("categories={categories}");
    expect(layout).toContain(".where(isNull(jobs.deletedAt))");
    expect(layout).toContain("applicationDeadline: jobs.applicationDeadline");
  });

  it("detail routes preserve sidebar context and query-aware vacature links", () => {
    const shell = readFile("components", "opdrachten-layout-shell.tsx");
    const sidebar = readFile("components", "opdrachten-sidebar.tsx");
    const listItem = readFile("components", "job-list-item.tsx");

    expect(shell).toContain('pathname.startsWith("/opdrachten/")');
    expect(shell).toContain("w-full md:w-[380px]");
    expect(shell).toContain("contents md:flex");
    expect(sidebar).toContain("const buildDetailHref = (jobId: string)");
    expect(sidebar).toContain("href={buildDetailHref(job.id)}");
    expect(sidebar).toContain("getOpdrachtenBasePath(pathname)");
    expect(sidebar).toContain("deadlines vragen aandacht");
    expect(listItem).toContain("href?: string");
    expect(listItem).toContain(`const detailHref = href ?? \`/opdrachten/\${job.id}\``);
    expect(listItem).toContain("Nog te koppelen");
    expect(listItem).toContain("Sluit vandaag");
  });
});
