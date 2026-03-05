import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const { mockLimit, mockDb } = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockDb = {
    select: vi.fn().mockReturnValue({
      from: vi.fn().mockReturnValue({
        where: vi.fn().mockReturnValue({
          limit: mockLimit,
        }),
      }),
    }),
    insert: vi.fn().mockReturnValue({
      values: vi.fn().mockReturnValue({
        onConflictDoNothing: vi.fn().mockResolvedValue(undefined),
      }),
    }),
  };
  return { mockLimit, mockDb };
});

vi.mock("../src/db", () => ({ db: mockDb }));

import { mapSkillInput } from "../src/services/esco.js";

const baseInput = {
  rawSkill: "React",
  contextType: "candidate" as const,
  contextId: "ctx-1",
  critical: false,
};

describe("mapSkillInput", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  afterEach(() => {
    mockLimit.mockReset();
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
    const escoUri = "http://data.europa.eu/esco/skill/react";
    mockLimit.mockResolvedValueOnce([{ escoUri, confidence: 0.5 }]);

    const result = await mapSkillInput({
      ...baseInput,
      rawSkill: "react",
      critical: true,
    });

    expect(result.strategy).toBe("alias");
    expect(result.reviewRequired).toBe(true);
  });
});
