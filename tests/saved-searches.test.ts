import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Mock setup (vi.hoisted pattern per project convention)
// ---------------------------------------------------------------------------

const { mockDb } = vi.hoisted(() => {
  const mockDb = {
    select: vi.fn(),
    insert: vi.fn(),
    update: vi.fn(),
  };

  // Chainable query builder
  const selectChain = {
    from: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    orderBy: vi.fn().mockReturnThis(),
    limit: vi.fn().mockResolvedValue([]),
  };
  mockDb.select.mockReturnValue(selectChain);

  const insertChain = {
    values: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
  mockDb.insert.mockReturnValue(insertChain);

  const updateChain = {
    set: vi.fn().mockReturnThis(),
    where: vi.fn().mockReturnThis(),
    returning: vi.fn().mockResolvedValue([]),
  };
  mockDb.update.mockReturnValue(updateChain);

  return { mockDb };
});

vi.mock("../src/db", () => ({
  db: mockDb,
  eq: vi.fn((col: unknown, val: unknown) => ({ col, val, op: "eq" })),
  and: vi.fn((...args: unknown[]) => ({ args, op: "and" })),
  isNull: vi.fn((col: unknown) => ({ col, op: "isNull" })),
  desc: vi.fn((col: unknown) => ({ col, op: "desc" })),
  sql: vi.fn(),
}));

vi.mock("../src/db/saved-searches-schema", () => ({
  savedSearches: {
    id: "id",
    name: "name",
    filters: "filters",
    createdAt: "created_at",
    updatedAt: "updated_at",
    deletedAt: "deleted_at",
  },
}));

import {
  createSavedSearch,
  deleteSavedSearch,
  listSavedSearches,
} from "../src/services/saved-searches";

// ---------------------------------------------------------------------------
// Tests
// ---------------------------------------------------------------------------

describe("saved-searches service", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    // Reset chainable mocks
    const selectChain = {
      from: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      orderBy: vi.fn().mockReturnThis(),
      limit: vi.fn().mockResolvedValue([]),
    };
    mockDb.select.mockReturnValue(selectChain);

    const insertChain = {
      values: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    mockDb.insert.mockReturnValue(insertChain);

    const updateChain = {
      set: vi.fn().mockReturnThis(),
      where: vi.fn().mockReturnThis(),
      returning: vi.fn().mockResolvedValue([]),
    };
    mockDb.update.mockReturnValue(updateChain);
  });

  // ---- listSavedSearches ----

  describe("listSavedSearches", () => {
    it("returns non-deleted saved searches ordered by creation date", async () => {
      const mockRows = [
        {
          id: "abc-123",
          name: "Senior React",
          filters: { title: "Senior React Developer", location: "Amsterdam" },
          createdAt: new Date("2026-01-01"),
          updatedAt: new Date("2026-01-01"),
          deletedAt: null,
        },
      ];

      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue(mockRows),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await listSavedSearches();

      expect(result).toEqual(mockRows);
      expect(mockDb.select).toHaveBeenCalled();
      expect(selectChain.from).toHaveBeenCalled();
      expect(selectChain.where).toHaveBeenCalled();
      expect(selectChain.orderBy).toHaveBeenCalled();
    });

    it("returns empty array when no saved searches exist", async () => {
      const selectChain = {
        from: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        orderBy: vi.fn().mockResolvedValue([]),
      };
      mockDb.select.mockReturnValue(selectChain);

      const result = await listSavedSearches();
      expect(result).toEqual([]);
    });
  });

  // ---- createSavedSearch ----

  describe("createSavedSearch", () => {
    it("inserts a new saved search and returns it", async () => {
      const newSearch = {
        id: "new-id",
        name: "Frontend Amsterdam",
        filters: { title: "Frontend", location: "Amsterdam" },
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: null,
      };

      const insertChain = {
        values: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([newSearch]),
      };
      mockDb.insert.mockReturnValue(insertChain);

      const result = await createSavedSearch("Frontend Amsterdam", {
        title: "Frontend",
        location: "Amsterdam",
      });

      expect(result).toEqual(newSearch);
      expect(mockDb.insert).toHaveBeenCalled();
      expect(insertChain.values).toHaveBeenCalledWith(
        expect.objectContaining({
          name: "Frontend Amsterdam",
          filters: { title: "Frontend", location: "Amsterdam" },
        }),
      );
    });
  });

  // ---- deleteSavedSearch ----

  describe("deleteSavedSearch", () => {
    it("soft-deletes an existing saved search", async () => {
      const deleted = {
        id: "del-id",
        name: "Old Search",
        filters: {},
        createdAt: new Date(),
        updatedAt: new Date(),
        deletedAt: new Date(),
      };

      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([deleted]),
      };
      mockDb.update.mockReturnValue(updateChain);

      const result = await deleteSavedSearch("del-id");

      expect(result).toBe(true);
      expect(mockDb.update).toHaveBeenCalled();
      expect(updateChain.set).toHaveBeenCalledWith(
        expect.objectContaining({
          deletedAt: expect.any(Date),
        }),
      );
    });

    it("returns false when saved search is not found", async () => {
      const updateChain = {
        set: vi.fn().mockReturnThis(),
        where: vi.fn().mockReturnThis(),
        returning: vi.fn().mockResolvedValue([]),
      };
      mockDb.update.mockReturnValue(updateChain);

      const result = await deleteSavedSearch("nonexistent");
      expect(result).toBe(false);
    });
  });
});

// ---------------------------------------------------------------------------
// Zod schema tests
// ---------------------------------------------------------------------------

describe("saved-searches schemas", () => {
  // Import directly — these are pure Zod schemas, no DB dependency
  // Using dynamic import to avoid module resolution order issues
  it("validates a correct createSavedSearch payload", async () => {
    const { createSavedSearchSchema } = await import("../src/schemas/saved-searches");
    const result = createSavedSearchSchema.safeParse({
      name: "My Filter",
      filters: { title: "Developer", location: "Rotterdam" },
    });
    expect(result.success).toBe(true);
  });

  it("rejects missing name", async () => {
    const { createSavedSearchSchema } = await import("../src/schemas/saved-searches");
    const result = createSavedSearchSchema.safeParse({
      filters: { title: "Developer" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects empty name", async () => {
    const { createSavedSearchSchema } = await import("../src/schemas/saved-searches");
    const result = createSavedSearchSchema.safeParse({
      name: "",
      filters: { title: "Developer" },
    });
    expect(result.success).toBe(false);
  });

  it("rejects missing filters", async () => {
    const { createSavedSearchSchema } = await import("../src/schemas/saved-searches");
    const result = createSavedSearchSchema.safeParse({
      name: "My Filter",
    });
    expect(result.success).toBe(false);
  });

  it("accepts filters as any JSON object", async () => {
    const { createSavedSearchSchema } = await import("../src/schemas/saved-searches");
    const result = createSavedSearchSchema.safeParse({
      name: "Complex",
      filters: {
        skills: ["React", "TypeScript"],
        salaryRange: { min: 80000, max: 120000 },
        remote: true,
      },
    });
    expect(result.success).toBe(true);
  });
});
