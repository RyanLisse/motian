import { beforeEach, describe, expect, it, vi } from "vitest";

// Mock the database module before imports
vi.mock("@/src/db", () => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    execute: vi.fn(),
  };
  return {
    db: mockDb,
    eq: vi.fn((_col: unknown, _val: unknown) => "eq-condition"),
    sql: Object.assign((strings: TemplateStringsArray, ..._values: unknown[]) => strings.join(""), {
      raw: (s: string) => s,
    }),
  };
});

vi.mock("@/src/db/schema", () => ({
  jobs: {
    platform: "platform",
    endClient: "end_client",
    company: "company",
    categories: "categories",
    status: "status",
  },
  sidebarMetadata: {
    id: "id",
    totalCount: "total_count",
    platforms: "platforms",
    endClients: "end_clients",
    categories: "categories",
    skillOptions: "skill_options",
    skillEmptyText: "skill_empty_text",
    computedAt: "computed_at",
  },
}));

vi.mock("@motian/esco", () => ({
  getEscoCatalogStatus: vi.fn().mockResolvedValue({
    available: true,
    issue: null,
    skillCount: 100,
    aliasCount: 50,
    mappingCount: 25,
    jobSkillCount: 10,
    candidateSkillCount: 5,
    checkedAt: new Date().toISOString(),
  }),
  listEscoSkillsForFilter: vi
    .fn()
    .mockResolvedValue([
      { uri: "http://esco/skill/1", labelNl: "TypeScript", labelEn: "TypeScript" },
    ]),
}));

vi.mock("@/src/services/jobs/filters", () => ({
  getJobStatusCondition: vi.fn(() => "status = 'open'"),
}));

describe("sidebar-metadata", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe("sidebarMetadata schema", () => {
    it("should export the sidebarMetadata table from schema", async () => {
      const schema = await import("@/src/db/schema");
      expect(schema.sidebarMetadata).toBeDefined();
      expect(schema.sidebarMetadata.id).toBeDefined();
      expect(schema.sidebarMetadata.totalCount).toBeDefined();
      expect(schema.sidebarMetadata.platforms).toBeDefined();
      expect(schema.sidebarMetadata.endClients).toBeDefined();
      expect(schema.sidebarMetadata.categories).toBeDefined();
      expect(schema.sidebarMetadata.skillOptions).toBeDefined();
      expect(schema.sidebarMetadata.skillEmptyText).toBeDefined();
      expect(schema.sidebarMetadata.computedAt).toBeDefined();
    });
  });

  describe("getSidebarMetadata", () => {
    it("should return null when table is empty", async () => {
      const { db } = await import("@/src/db");
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([]),
          }),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const { getSidebarMetadata } = await import("@/src/services/sidebar-metadata");
      const result = await getSidebarMetadata();
      expect(result).toBeNull();
    });

    it("should return stale data instead of null to avoid expensive refresh", async () => {
      const { db } = await import("@/src/db");
      const staleDate = new Date(Date.now() - 11 * 60 * 1000); // 11 minutes ago
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "default",
                totalCount: 100,
                platforms: ["huxley"],
                endClients: ["ING"],
                categories: ["IT"],
                skillOptions: [],
                skillEmptyText: "Geen vaardigheden gevonden.",
                computedAt: staleDate,
              },
            ]),
          }),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const { getSidebarMetadata } = await import("@/src/services/sidebar-metadata");
      const result = await getSidebarMetadata();
      // Stale data is served intentionally — the cache-refresh task updates it every 15 min
      expect(result).not.toBeNull();
      expect(result?.totalCount).toBe(100);
    });

    it("should return metadata when data is fresh", async () => {
      const { db } = await import("@/src/db");
      const freshDate = new Date(Date.now() - 2 * 60 * 1000); // 2 minutes ago
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockReturnValue({
            limit: vi.fn().mockResolvedValue([
              {
                id: "default",
                totalCount: 34000,
                platforms: ["huxley", "yacht"],
                endClients: ["ING", "ABN AMRO"],
                categories: ["IT", "Finance"],
                skillOptions: [{ value: "ts", label: "TypeScript" }],
                skillEmptyText: "Geen vaardigheden gevonden.",
                computedAt: freshDate,
              },
            ]),
          }),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      const { getSidebarMetadata } = await import("@/src/services/sidebar-metadata");
      const result = await getSidebarMetadata();
      expect(result).not.toBeNull();
      expect(result?.totalCount).toBe(34000);
      expect(result?.platforms).toEqual(["huxley", "yacht"]);
      expect(result?.endClients).toEqual(["ING", "ABN AMRO"]);
      expect(result?.categories).toEqual(["IT", "Finance"]);
      expect(result?.skillOptions).toEqual([{ value: "ts", label: "TypeScript" }]);
      expect(result?.skillEmptyText).toBe("Geen vaardigheden gevonden.");
    });
  });

  describe("refreshSidebarMetadata", () => {
    it("should return correct shape with all required fields", async () => {
      const { db } = await import("@/src/db");

      // Mock count query
      const selectMock = vi.fn().mockReturnValue({
        from: vi.fn().mockReturnValue({
          where: vi.fn().mockResolvedValue([{ count: 500 }]),
        }),
      });
      (db.select as ReturnType<typeof vi.fn>).mockImplementation(selectMock);

      // Mock execute for categories query
      (db.execute as ReturnType<typeof vi.fn>).mockResolvedValue({
        rows: [{ category: "IT" }, { category: "Finance" }],
      });

      // Mock insert for upsert
      const onConflictMock = vi.fn().mockResolvedValue(undefined);
      (db.insert as ReturnType<typeof vi.fn>).mockReturnValue({
        values: vi.fn().mockReturnValue({
          onConflictDoUpdate: onConflictMock,
        }),
      });

      const { refreshSidebarMetadata } = await import("@/src/services/sidebar-metadata");
      const result = await refreshSidebarMetadata();

      expect(result).toHaveProperty("totalCount");
      expect(result).toHaveProperty("platforms");
      expect(result).toHaveProperty("endClients");
      expect(result).toHaveProperty("categories");
      expect(result).toHaveProperty("skillOptions");
      expect(result).toHaveProperty("skillEmptyText");
      expect(result).toHaveProperty("computedAt");
      expect(typeof result.totalCount).toBe("number");
      expect(Array.isArray(result.platforms)).toBe(true);
      expect(Array.isArray(result.endClients)).toBe(true);
      expect(Array.isArray(result.categories)).toBe(true);
      expect(Array.isArray(result.skillOptions)).toBe(true);
      expect(typeof result.skillEmptyText).toBe("string");
      expect(result.computedAt).toBeInstanceOf(Date);
    });
  });
});
