import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDb,
  mockInsert,
  mockValues,
  mockOnConflictDoUpdate,
  mockReturning,
  mockSelectWhere,
  mockUpdate,
  mockUpdateReturning,
  mockIsSkillsCatalogAvailable,
  mockSyncJobSkills,
} = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockOnConflictDoUpdate = vi.fn();
  const mockValues = vi.fn();
  const mockInsert = vi.fn();
  const mockSelectWhere = vi.fn();
  const mockFrom = vi.fn();
  const mockSelect = vi.fn();
  const mockUpdateReturning = vi.fn();
  const mockUpdateWhere = vi.fn();
  const mockSet = vi.fn();
  const mockUpdate = vi.fn();

  mockValues.mockImplementation(() => ({
    onConflictDoUpdate: mockOnConflictDoUpdate,
  }));
  mockOnConflictDoUpdate.mockImplementation(() => ({
    returning: mockReturning,
  }));
  mockInsert.mockImplementation(() => ({ values: mockValues }));
  mockFrom.mockImplementation(() => ({
    where: mockSelectWhere,
  }));
  mockSelect.mockImplementation(() => ({
    from: mockFrom,
  }));
  mockUpdateWhere.mockImplementation(() => ({
    returning: mockUpdateReturning,
  }));
  mockSet.mockImplementation(() => ({
    where: mockUpdateWhere,
  }));
  mockUpdate.mockImplementation(() => ({
    set: mockSet,
  }));

  return {
    mockDb: { insert: mockInsert, select: mockSelect, update: mockUpdate },
    mockInsert,
    mockValues,
    mockOnConflictDoUpdate,
    mockReturning,
    mockSelect,
    mockFrom,
    mockSelectWhere,
    mockUpdate,
    mockSet,
    mockUpdateWhere,
    mockUpdateReturning,
    mockIsSkillsCatalogAvailable: vi.fn().mockResolvedValue(true),
    mockSyncJobSkills: vi.fn(),
  };
});

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: mockDb,
}));
vi.mock("../src/services/esco", () => ({
  isSkillsCatalogAvailable: mockIsSkillsCatalogAvailable,
  syncJobSkills: mockSyncJobSkills,
  getSkillsCatalogStatusCached: vi.fn().mockResolvedValue({
    available: true,
    issue: null,
    skillCount: 1,
    jobSkillCount: 1,
    candidateSkillCount: 1,
    checkedAt: new Date().toISOString(),
  }),
}));

import { normalizeAndSaveJobs } from "../src/services/normalize";

describe("normalizeAndSaveJobs status/endClient storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsSkillsCatalogAvailable.mockResolvedValue(true);
    mockSelectWhere.mockResolvedValue([]);
    mockUpdateReturning.mockResolvedValue([]);
    mockReturning.mockResolvedValue([{ id: "job-1", externalId: "oo-123", isNew: true }]);
    mockSyncJobSkills.mockResolvedValue(undefined);
  });

  it("persists status and endClient on insert and upsert update", async () => {
    const listing = {
      title: "Senior Java Developer",
      company: "Between",
      endClient: "Gemeente Utrecht",
      status: "closed" as const,
      location: "Utrecht - Utrecht",
      description: "Senior Java developer gezocht voor een gemeentelijke moderniseringsopdracht.",
      externalId: "oo-123",
      externalUrl: "https://www.opdrachtoverheid.nl/opdracht/oo-123",
      requirements: [],
      wishes: [],
      competences: [],
      conditions: [],
    };

    const result = await normalizeAndSaveJobs("opdrachtoverheid", [listing]);

    expect(result.errors).toEqual([]);
    expect(mockInsert).toHaveBeenCalledTimes(1);

    const insertedValues = mockValues.mock.calls[0]?.[0];
    expect(insertedValues).toHaveLength(1);
    expect(insertedValues[0]).toMatchObject({
      platform: "opdrachtoverheid",
      company: "Between",
      endClient: "Gemeente Utrecht",
      status: "closed",
      rawPayload: listing,
    });

    const conflictConfig = mockOnConflictDoUpdate.mock.calls[0]?.[0];
    expect(conflictConfig.set).toHaveProperty("endClient");
    expect(conflictConfig.set).toHaveProperty("status");
    expect(conflictConfig.set).toHaveProperty("archivedAt");
    expect(conflictConfig.set).toHaveProperty("deletedAt");
    expect(mockSyncJobSkills).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        requirements: [],
        wishes: [],
        competences: [],
      }),
    );
  });

  it("skips canonical skill sync for existing opdrachtoverheid jobs and only refreshes scrapedAt", async () => {
    mockSelectWhere.mockResolvedValue([{ externalId: "oo-123" }]);
    mockUpdateReturning.mockResolvedValue([{ id: "job-existing-1" }]);

    const listing = {
      title: "Senior Java Developer",
      company: "Between",
      endClient: "Gemeente Utrecht",
      status: "open" as const,
      location: "Utrecht - Utrecht",
      description: "Senior Java developer gezocht voor een gemeentelijke moderniseringsopdracht.",
      externalId: "oo-123",
      externalUrl: "https://www.opdrachtoverheid.nl/opdracht/oo-123",
      requirements: [{ description: "Java", isKnockout: true }],
      wishes: [{ description: "Spring Boot" }],
      competences: ["Microservices"],
      conditions: [],
    };

    const result = await normalizeAndSaveJobs("opdrachtoverheid", [listing]);

    expect(result.errors).toEqual([]);
    expect(result.jobsNew).toBe(0);
    expect(result.duplicates).toBe(1);
    expect(result.jobIds).toEqual(["job-existing-1"]);
    expect(mockInsert).not.toHaveBeenCalled();
    expect(mockUpdate).toHaveBeenCalledTimes(1);
    expect(mockSyncJobSkills).not.toHaveBeenCalled();
  });
});
