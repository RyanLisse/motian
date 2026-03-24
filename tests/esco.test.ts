import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLimit, mockDb } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn().mockReturnValue({
    limit: mockLimit,
  });
  const mockOrderBy = vi.fn().mockReturnValue({
    where: mockWhere,
    limit: mockLimit,
  });
  const mockFrom = vi.fn().mockReturnValue({
    where: mockWhere,
    orderBy: mockOrderBy,
    limit: mockLimit,
  });
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: mockFrom,
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };

  return {
    mockDb,
    mockLimit,
  };
});

vi.mock("@motian/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: mockDb,
  candidateSkills: {},
  escoSkills: {
    uri: "escoSkills.uri",
    preferredLabelEn: "escoSkills.preferredLabelEn",
    preferredLabelNl: "escoSkills.preferredLabelNl",
  },
  jobSkills: {},
  skillAliases: {
    escoUri: "skillAliases.escoUri",
    confidence: "skillAliases.confidence",
    normalizedAlias: "skillAliases.normalizedAlias",
    language: "skillAliases.language",
  },
  skillMappings: {},
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

describe("mapSkillInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    resetEscoCatalogStatusCache();
  });

  afterEach(() => {
    mockLimit.mockReset();
    resetEscoCatalogStatusCache();
  });

  it("returns none strategy and zero confidence for empty/whitespace rawSkill", async () => {
    const result = await mapSkillInput({
      ...baseInput,
      rawSkill: "   ",
    });
    expect(result).toEqual({
      escoUri: null,
      confidence: 0,
      strategy: "none",
      reviewRequired: false,
    });
    expect(mockLimit).not.toHaveBeenCalled();
    expect(mockDb.insert).toHaveBeenCalled();
  });

  it("returns alias strategy with expected escoUri and confidence when normalized rawSkill matches alias", async () => {
    const escoUri = "http://data.europa.eu/esco/skill/react";
    mockLimit.mockResolvedValueOnce([{ escoUri, confidence: 0.9 }]);

    const result = await mapSkillInput({
      ...baseInput,
      rawSkill: "  react  ",
    });

    expect(result.strategy).toBe("alias");
    expect(result.escoUri).toBe(escoUri);
    expect(result.confidence).toBe(0.9);
    expect(result.reviewRequired).toBe(false);
    expect(mockLimit).toHaveBeenCalledTimes(1);
  });

  it("returns exact strategy when rawSkill trim matches preferred label (no alias hit)", async () => {
    const uri = "http://data.europa.eu/esco/skill/typescript";
    mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([{ uri }]);

    const result = await mapSkillInput({
      ...baseInput,
      rawSkill: "TypeScript",
    });

    expect(result.strategy).toBe("exact");
    expect(result.escoUri).toBe(uri);
    expect(result.confidence).toBe(0.95);
    expect(mockLimit).toHaveBeenCalledTimes(2);
  });

  it("returns none strategy when neither alias nor exact match", async () => {
    mockLimit.mockResolvedValueOnce([]).mockResolvedValueOnce([]);

    const result = await mapSkillInput({
      ...baseInput,
      rawSkill: "UnknownSkillXYZ",
    });

    expect(result.strategy).toBe("none");
    expect(result.escoUri).toBe(null);
    expect(result.confidence).toBe(0);
    expect(result.reviewRequired).toBe(false);
    expect(mockLimit).toHaveBeenCalledTimes(2);
  });

  it("sets reviewRequired when critical and alias confidence below threshold", async () => {
    const escoUri = "http://data.europa.eu/esco/skill/vue";
    mockLimit.mockResolvedValueOnce([{ escoUri, confidence: 0.5 }]);

    const result = await mapSkillInput({
      ...baseInput,
      rawSkill: "vue",
      critical: true,
    });

    expect(result.strategy).toBe("alias");
    expect(result.reviewRequired).toBe(true);
  });

  it("reuses cached alias lookups for repeated raw skills while persisting each mapping event", async () => {
    const escoUri = "http://data.europa.eu/esco/skill/redux";
    mockLimit.mockResolvedValueOnce([{ escoUri, confidence: 0.9 }]);

    const first = await mapSkillInput({
      ...baseInput,
      rawSkill: "Redux",
      contextId: "job-1",
      contextType: "job",
    });
    const second = await mapSkillInput({
      ...baseInput,
      rawSkill: "Redux",
      contextId: "job-2",
      contextType: "job",
    });

    expect(first).toEqual({
      escoUri,
      confidence: 0.9,
      strategy: "alias",
      reviewRequired: false,
    });
    expect(second).toEqual(first);
    expect(mockLimit).toHaveBeenCalledTimes(1);
    expect(mockDb.insert).toHaveBeenCalledTimes(2);
  });

  it("reports a missing catalog when skills and aliases are both absent", async () => {
    mockLimit
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 12 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 0 }]);

    const status = await getEscoCatalogStatus({ refresh: true });

    expect(status).toMatchObject({
      available: false,
      issue: "missing_catalog",
      skillCount: 0,
      aliasCount: 0,
      mappingCount: 12,
      jobSkillCount: 0,
      candidateSkillCount: 0,
    });
    expect(await isEscoCatalogAvailable()).toBe(false);
  });

  it("keeps the catalog available but flags missing aliases when only canonical skills exist", async () => {
    mockLimit
      .mockResolvedValueOnce([{ count: 42 }])
      .mockResolvedValueOnce([{ count: 0 }])
      .mockResolvedValueOnce([{ count: 5 }])
      .mockResolvedValueOnce([{ count: 7 }])
      .mockResolvedValueOnce([{ count: 3 }]);

    const status = await getEscoCatalogStatus({ refresh: true });

    expect(status).toMatchObject({
      available: true,
      issue: "missing_aliases",
      skillCount: 42,
      aliasCount: 0,
      mappingCount: 5,
      jobSkillCount: 7,
      candidateSkillCount: 3,
    });
  });
});
