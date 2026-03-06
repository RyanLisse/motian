import { readFileSync } from "node:fs";
import * as path from "node:path";
import { describe, expect, it } from "vitest";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  MAX_OPDRACHTEN_LIMIT,
  normalizeOpdrachtenStatus,
  OPDRACHTEN_PAGE_SIZE_OPTIONS,
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

describe("Opdrachten UI/API contracts", () => {
  it("sidebar exposes platform, endClient, status, and limit controls", () => {
    const source = readFile("components", "opdrachten-sidebar.tsx");

    expect(source).toContain('placeholder="Platform"');
    expect(source).toContain('placeholder="Eindopdrachtgever"');
    expect(source).toContain('handleFilterChange("status"');
    expect(source).toContain('searchParams.get("page")');
    expect(source).toContain('searchParams.get("perPage")');
    expect(source).toContain("DEFAULT_OPDRACHTEN_LIMIT");
  });

  it("API routes accept status and endClient filters with opdrachten defaults", () => {
    const listRoute = readFile("app", "api", "opdrachten", "route.ts");
    const searchRoute = readFile("app", "api", "opdrachten", "zoeken", "route.ts");

    expect(listRoute).toContain('params.get("status")');
    expect(listRoute).toContain('params.get("endClient")');
    expect(listRoute).toContain("DEFAULT_OPDRACHTEN_LIMIT");

    expect(searchRoute).toContain('params.get("status")');
    expect(searchRoute).toContain('params.get("endClient")');
    expect(searchRoute).toContain("perPage: limit");
    expect(searchRoute).toContain("DEFAULT_OPDRACHTEN_LIMIT");
  });

  it("layout seed uses persisted job status and end-client metadata", () => {
    const layout = readFile("app", "opdrachten", "layout.tsx");

    expect(layout).toContain('eq(jobs.status, "open")');
    expect(layout).toContain(`coalesce(\${jobs.endClient}, \${jobs.company})`);
    expect(layout).toContain(".where(isNull(jobs.deletedAt))");
    expect(layout).not.toContain("applicationDeadline");
  });
});
