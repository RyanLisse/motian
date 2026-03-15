import { beforeEach, describe, expect, it, vi } from "vitest";
import { normalizeAndSaveJobs } from "../src/services/normalize";

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
  syncJobEscoSkills: vi.fn().mockResolvedValue(undefined),
}));

describe("normalizeAndSaveJobs regression", () => {
  beforeEach(() => {
    vi.clearAllMocks();
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
});
