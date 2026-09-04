import { beforeEach, describe, expect, it, vi } from "vitest";
import {
  DEFAULT_SKILLS_FILTER_DATA,
  loadKandidatenPageData,
  type SkillsFilterData,
} from "@/app/kandidaten/data";

function deferred<T>() {
  let resolve!: (value: T) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((res, rej) => {
    resolve = res;
    reject = rej;
  });
  return { promise, resolve, reject };
}

describe("kandidaten parallel page fetch (R16)", () => {
  beforeEach(() => {
    vi.restoreAllMocks();
  });

  it("starts skills-filter concurrently with stats and list reads when skillSlug is absent", async () => {
    const callOrder: string[] = [];
    const skills = deferred<SkillsFilterData>();
    const stats = deferred<{ directCount: number; weekCount: number }>();
    const list = deferred<[]>([]);
    const count = deferred<number>();

    const deps = {
      getSkillsFilterData: vi.fn(() => {
        callOrder.push("skills-start");
        return skills.promise;
      }),
      getKandidatenStats: vi.fn(() => {
        callOrder.push("stats-start");
        return stats.promise;
      }),
      listCandidates: vi.fn(() => {
        callOrder.push("list-start");
        return list.promise;
      }),
      searchCandidates: vi.fn(async () => []),
      countCandidates: vi.fn(() => {
        callOrder.push("count-start");
        return count.promise;
      }),
    };

    const pending = loadKandidatenPageData(
      { query: "", availability: "", skillSlug: "", limit: 20, offset: 0 },
      deps,
    );

    // All independent reads must have started before any resolve.
    expect(callOrder).toEqual(["skills-start", "stats-start", "list-start", "count-start"]);
    expect(deps.searchCandidates).not.toHaveBeenCalled();

    skills.resolve({
      skillOptions: [{ slug: "java", name: "Java", fullName: "Java" }],
      escoCatalogAvailable: true,
      escoCatalogMessage: "",
    });
    stats.resolve({ directCount: 2, weekCount: 1 });
    list.resolve([]);
    count.resolve(0);

    const result = await pending;
    expect(result.totalCount).toBe(0);
    expect(result.skillsData.escoCatalogAvailable).toBe(true);
    expect(result.stats.directCount).toBe(2);
  });

  it("does not await skills before stats when skillSlug requires ESCO for the branch", async () => {
    const callOrder: string[] = [];
    const skills = deferred<SkillsFilterData>();
    const stats = deferred<{ directCount: number; weekCount: number }>();
    const search = deferred<[]>([]);
    const count = deferred<number>();

    const deps = {
      getSkillsFilterData: vi.fn(() => {
        callOrder.push("skills-start");
        return skills.promise;
      }),
      getKandidatenStats: vi.fn(() => {
        callOrder.push("stats-start");
        return stats.promise;
      }),
      listCandidates: vi.fn(async () => []),
      searchCandidates: vi.fn(() => {
        callOrder.push("search-start");
        return search.promise;
      }),
      countCandidates: vi.fn(() => {
        callOrder.push("count-start");
        return count.promise;
      }),
    };

    const pending = loadKandidatenPageData(
      { query: "", availability: "", skillSlug: "java", limit: 20, offset: 0 },
      deps,
    );

    // Skills and stats start together; candidates wait for skills.
    expect(callOrder).toEqual(["skills-start", "stats-start"]);
    expect(deps.searchCandidates).not.toHaveBeenCalled();
    expect(deps.listCandidates).not.toHaveBeenCalled();

    skills.resolve({
      skillOptions: [{ slug: "java", name: "Java", fullName: "Java" }],
      escoCatalogAvailable: true,
      escoCatalogMessage: "",
    });
    stats.resolve({ directCount: 0, weekCount: 0 });

    await vi.waitFor(() => {
      expect(deps.searchCandidates).toHaveBeenCalled();
      expect(deps.countCandidates).toHaveBeenCalled();
    });

    expect(callOrder).toEqual(["skills-start", "stats-start", "search-start", "count-start"]);
    expect(deps.searchCandidates).toHaveBeenCalledWith(
      expect.objectContaining({ escoUri: "java", limit: 20, offset: 0 }),
    );

    search.resolve([]);
    count.resolve(3);

    const result = await pending;
    expect(result.totalCount).toBe(3);
    expect(deps.listCandidates).not.toHaveBeenCalled();
  });

  it("degrades to the Dutch disabled-filter message when skills-filter throws", async () => {
    const consoleError = vi.spyOn(console, "error").mockImplementation(() => {});

    const result = await loadKandidatenPageData(
      { query: "", availability: "", skillSlug: "", limit: 20, offset: 0 },
      {
        getSkillsFilterData: vi.fn(async () => {
          throw new Error("ESCO down");
        }),
        getKandidatenStats: vi.fn(async () => ({ directCount: 1, weekCount: 0 })),
        listCandidates: vi.fn(async () => []),
        searchCandidates: vi.fn(async () => []),
        countCandidates: vi.fn(async () => 0),
      },
    );

    expect(result.skillsData).toEqual(DEFAULT_SKILLS_FILTER_DATA);
    expect(result.skillsData.escoCatalogAvailable).toBe(false);
    expect(result.skillsData.escoCatalogMessage).toBe(
      "Vaardigheden-filter is tijdelijk niet beschikbaar.",
    );
    expect(consoleError).toHaveBeenCalled();
    consoleError.mockRestore();
  });

  it("falls back to listCandidates when skillSlug is set but ESCO catalog is unavailable", async () => {
    const deps = {
      getSkillsFilterData: vi.fn(async () => ({
        skillOptions: [],
        escoCatalogAvailable: false,
        escoCatalogMessage: "Vaardigheden-filter is tijdelijk niet beschikbaar.",
      })),
      getKandidatenStats: vi.fn(async () => ({ directCount: 0, weekCount: 0 })),
      listCandidates: vi.fn(async () => []),
      searchCandidates: vi.fn(async () => []),
      countCandidates: vi.fn(async () => 5),
    };

    const result = await loadKandidatenPageData(
      { query: "", availability: "", skillSlug: "java", limit: 20, offset: 0 },
      deps,
    );

    expect(deps.listCandidates).toHaveBeenCalledWith({ limit: 20, offset: 0 });
    expect(deps.searchCandidates).not.toHaveBeenCalled();
    expect(deps.countCandidates).toHaveBeenCalledWith();
    expect(result.totalCount).toBe(5);
  });
});
