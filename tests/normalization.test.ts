import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAndSaveJobs } from "../src/services/normalize";

const { mockSyncJobEscoSkills, mockIsEscoCatalogAvailable } = vi.hoisted(() => ({
  mockSyncJobEscoSkills: vi.fn().mockResolvedValue(undefined),
  mockIsEscoCatalogAvailable: vi.fn().mockResolvedValue(true),
}));

const mockValues = vi.fn().mockImplementation(() => ({
  onConflictDoUpdate: vi.fn().mockReturnThis(),
  returning: vi.fn().mockResolvedValue([{ id: "uuid-1", externalId: "ext-1", isNew: true }]),
}));

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: {
    insert: vi.fn().mockImplementation(() => ({
      values: mockValues,
    })),
  },
}));

vi.mock("../src/services/esco", () => ({
  isEscoCatalogAvailable: mockIsEscoCatalogAvailable,
  syncJobEscoSkills: mockSyncJobEscoSkills,
}));

describe("normalizeAndSaveJobs regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEscoCatalogAvailable.mockResolvedValue(true);
  });

  it("should verify HTML stripping and range clamping", async () => {
    const listings = [
      {
        externalId: "ext-1",
        externalUrl: "https://example.com/1",
        title: "<b>Software Engineer</b>",
        company: "<i>Awesome Corp</i>",
        description: "This is a very long description that should pass validation.",
        hoursPerWeek: 40,
        status: "open",
      },
      {
        externalId: "ext-2",
        externalUrl: "https://example.com/2",
        title: "Data Scientist",
        endClient: "<span>Client X</span>",
        description: "Another long enough description for validation purposes.",
        hoursPerWeek: 200, // Should be clamped to 168
        minHoursPerWeek: 0, // Should be clamped to 1
        status: "open",
      },
    ];

    const result = await normalizeAndSaveJobs("test-platform", listings);

    expect(result.errors).toHaveLength(0);
    expect(result.jobsNew).toBe(1);

    const valuesCallArr = mockValues.mock.calls.at(-1);
    const valuesCall = Array.isArray(valuesCallArr?.[0]) ? valuesCallArr[0] : [];

    // Case 1
    expect(valuesCall[0].title).toBe("Software Engineer");
    expect(valuesCall[0].company).toBe("Awesome Corp");
    expect(valuesCall[0].hoursPerWeek).toBe(40);

    // Case 2
    expect(valuesCall[1].endClient).toBe("Client X");
    expect(valuesCall[1].hoursPerWeek).toBe(168);
    expect(valuesCall[1].minHoursPerWeek).toBe(1);
  });

  it("skips ESCO sync entirely when the canonical ESCO catalog is unavailable", async () => {
    mockIsEscoCatalogAvailable.mockResolvedValue(false);

    await normalizeAndSaveJobs("test-platform", [
      {
        externalId: "ext-1",
        externalUrl: "https://example.com/1",
        title: "Software Engineer",
        description: "This is a very long description that should pass validation.",
        requirements: [{ description: "React", isKnockout: true }],
        competences: ["TypeScript"],
        status: "open",
      },
    ]);

    expect(mockIsEscoCatalogAvailable).toHaveBeenCalledTimes(1);
    expect(mockSyncJobEscoSkills).not.toHaveBeenCalled();
  });
});
