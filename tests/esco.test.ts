import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLimit, mockDb } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({
    limit: mockLimit,
  });
  const mockFrom = vi.fn().mockReturnValue({
    where: mockWhere,
  });
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: mockFrom,
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoUpdate: vi.fn().mockReturnValue({
          returning: vi.fn().mockResolvedValue([{ id: "skill-1", slug: "react", name: "React" }]),
        }),
      }),
    }),
  };

  return {
    mockDb,
    mockLimit,
  };
});

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: mockDb,
}));

import {
  getEscoCatalogStatus,
  isEscoCatalogAvailable,
  mapSkillInput,
  resetEscoCatalogStatusCache,
} from "../src/services/esco.js";

const baseInput = {
  rawSkill: "React",
  contextType: "candidate" as const,
  contextId: "ctx-1",
  critical: false,
};

describe("skills compatibility facade", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEscoCatalogStatusCache();
  });

  afterEach(() => {
    mockLimit.mockReset();
    resetEscoCatalogStatusCache();
  });

  it("returns none strategy for empty skill input", async () => {
    const result = await mapSkillInput({ ...baseInput, rawSkill: "   " });
    expect(result).toEqual({
      escoUri: null,
      confidence: 0,
      strategy: "none",
      reviewRequired: false,
    });
  });

  it("returns exact strategy with a canonical slug", async () => {
    mockLimit.mockResolvedValueOnce([]);

    const result = await mapSkillInput({ ...baseInput, rawSkill: "React" });

    expect(result).toEqual({
      escoUri: "react",
      confidence: 1,
      strategy: "exact",
      reviewRequired: false,
    });
    expect(mockDb.insert).toHaveBeenCalledTimes(1);
  });

  it("reuses an existing canonical skill when found by slug", async () => {
    mockLimit.mockResolvedValueOnce([{ id: "skill-2", slug: "typescript", name: "TypeScript" }]);

    const result = await mapSkillInput({ ...baseInput, rawSkill: "TypeScript" });

    expect(result.escoUri).toBe("typescript");
    expect(mockDb.insert).not.toHaveBeenCalled();
  });

  it("reports a missing catalog when no canonical skills exist", async () => {
    mockDb.select
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([{ count: 0 }]) })
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([{ count: 0 }]) })
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([{ count: 0 }]) });

    const status = await getEscoCatalogStatus({ refresh: true });

    expect(status).toMatchObject({
      available: false,
      issue: "missing_catalog",
      skillCount: 0,
      aliasCount: 0,
      mappingCount: 0,
      jobSkillCount: 0,
      candidateSkillCount: 0,
    });
    expect(await isEscoCatalogAvailable()).toBe(false);
  });

  it("reports the catalog as available when canonical skills exist", async () => {
    mockDb.select
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([{ count: 42 }]) })
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([{ count: 7 }]) })
      .mockReturnValueOnce({ from: vi.fn().mockResolvedValue([{ count: 3 }]) });

    const status = await getEscoCatalogStatus({ refresh: true });

    expect(status).toMatchObject({
      available: true,
      issue: null,
      skillCount: 42,
      aliasCount: 0,
      mappingCount: 0,
      jobSkillCount: 7,
      candidateSkillCount: 3,
    });
  });
});
