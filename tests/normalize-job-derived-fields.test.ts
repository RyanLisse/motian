import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockDb,
  mockInsert,
  mockOnConflictDoUpdate,
  mockReturning,
  mockValues,
  mockSyncJobEscoSkills,
} = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockOnConflictDoUpdate = vi.fn();
  const mockValues = vi.fn();
  const mockInsert = vi.fn();

  mockValues.mockImplementation(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
  mockOnConflictDoUpdate.mockImplementation(() => ({ returning: mockReturning }));
  mockInsert.mockImplementation(() => ({ values: mockValues }));

  return {
    mockDb: { insert: mockInsert },
    mockInsert,
    mockOnConflictDoUpdate,
    mockReturning,
    mockSyncJobEscoSkills: vi.fn(),
    mockValues,
  };
});

vi.mock("../src/db", () => ({ db: mockDb }));
vi.mock("../src/services/esco", () => ({ syncJobEscoSkills: mockSyncJobEscoSkills }));

import { deriveJobSearchFields, normalizeAndSaveJobs } from "../src/services/normalize";

describe("normalizeAndSaveJobs derived fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockReturning.mockResolvedValue([{ id: "job-1", externalId: "derived-1", isNew: true }]);
    mockSyncJobEscoSkills.mockResolvedValue(undefined);
  });

  it("derives normalized dedupe fields and search text from vacature content", () => {
    expect(
      deriveJobSearchFields({
        title: "  Senior React Developer!! ",
        company: "Between BV",
        endClient: "Gemeente Utrecht",
        location: "Utrecht Centrum",
        province: "Utrecht",
        description: " Bouw moderne portals. ",
      }),
    ).toEqual({
      dedupeTitleNormalized: "senior react developer",
      dedupeClientNormalized: "gemeente utrecht",
      dedupeLocationNormalized: "utrecht",
      searchText:
        "Senior React Developer!! Between BV Bouw moderne portals. Utrecht Centrum Utrecht",
    });
  });

  it("writes derived fields on insert values and upsert updates", async () => {
    const listing = {
      title: "Lead Data Engineer / Platform",
      company: "Motian Partners",
      location: "Amsterdam",
      description: "Een langdurige opdracht voor data platform modernisatie bij enterprise scale.",
      externalId: "derived-1",
      externalUrl: "https://example.com/jobs/derived-1",
      requirements: [],
      wishes: [],
      competences: [],
      conditions: [],
    };

    const result = await normalizeAndSaveJobs("opdrachtoverheid", [listing]);

    expect(result.errors).toEqual([]);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedValues = mockValues.mock.calls[0]?.[0];
    expect(insertedValues?.[0]).toMatchObject({
      dedupeTitleNormalized: "lead data engineer platform",
      dedupeClientNormalized: "motian partners",
      dedupeLocationNormalized: "amsterdam",
      searchText:
        "Lead Data Engineer / Platform Motian Partners Een langdurige opdracht voor data platform modernisatie bij enterprise scale. Amsterdam",
    });

    const conflictConfig = mockOnConflictDoUpdate.mock.calls[0]?.[0];
    expect(conflictConfig.set).toHaveProperty("dedupeTitleNormalized");
    expect(conflictConfig.set).toHaveProperty("dedupeClientNormalized");
    expect(conflictConfig.set).toHaveProperty("dedupeLocationNormalized");
    expect(conflictConfig.set).toHaveProperty("searchText");
  });
});
