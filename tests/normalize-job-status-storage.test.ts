import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDb,
  mockInsert,
  mockValues,
  mockOnConflictDoUpdate,
  mockReturning,
  mockSyncJobEscoSkills,
} = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockOnConflictDoUpdate = vi.fn();
  const mockValues = vi.fn();
  const mockInsert = vi.fn();

  mockValues.mockImplementation(() => ({
    onConflictDoUpdate: mockOnConflictDoUpdate,
  }));
  mockOnConflictDoUpdate.mockImplementation(() => ({
    returning: mockReturning,
  }));
  mockInsert.mockImplementation(() => ({ values: mockValues }));

  return {
    mockDb: { insert: mockInsert },
    mockInsert,
    mockValues,
    mockOnConflictDoUpdate,
    mockReturning,
    mockSyncJobEscoSkills: vi.fn(),
  };
});

vi.mock("../src/db", () => ({ db: mockDb }));
vi.mock("../src/services/esco", () => ({
  syncJobEscoSkills: mockSyncJobEscoSkills,
}));

import { normalizeAndSaveJobs } from "../src/services/normalize";

describe("normalizeAndSaveJobs status/endClient storage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([{ id: "job-1", externalId: "oo-123", isNew: true }]);
    mockSyncJobEscoSkills.mockResolvedValue(undefined);
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
    expect(mockSyncJobEscoSkills).toHaveBeenCalledWith(
      expect.objectContaining({
        jobId: "job-1",
        requirements: [],
        wishes: [],
        competences: [],
      }),
    );
  });
});
