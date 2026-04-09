import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetCandidateById, mockGetJobById } = vi.hoisted(() => ({
  mockGetCandidateById: vi.fn(),
  mockGetJobById: vi.fn(),
}));

vi.mock("../src/services/candidates", () => ({
  getCandidateById: mockGetCandidateById,
}));

vi.mock("../src/services/jobs/repository", () => ({
  getJobById: mockGetJobById,
}));

import { buildCommercialCvDraft } from "../src/services/commercial-cv-generation";

describe("buildCommercialCvDraft", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("throws when candidate missing", async () => {
    mockGetCandidateById.mockResolvedValueOnce(null);
    await expect(buildCommercialCvDraft({ candidateId: "x" })).rejects.toThrow("niet gevonden");
  });

  it("returns markdown draft with candidate name", async () => {
    mockGetCandidateById.mockResolvedValueOnce({
      id: "c1",
      name: "Test User",
      role: "Developer",
      profileSummary: "Samenvatting",
      location: "Utrecht",
      availability: "Per direct",
    });
    mockGetJobById.mockResolvedValueOnce(null);

    const draft = await buildCommercialCvDraft({ candidateId: "c1" });
    expect(draft.format).toBe("markdown");
    expect(draft.body).toContain("Test User");
    expect(draft.body).toContain("Samenvatting");
  });
});
