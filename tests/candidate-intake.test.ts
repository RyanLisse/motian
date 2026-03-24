import { afterEach, describe, expect, it, vi } from "vitest";

const {
  autoMatchCandidateToJobsMock,
  listApplicationsMock,
  updateCandidateMatchingStatusMock,
  getCandidateByIdMock,
} = vi.hoisted(() => ({
  autoMatchCandidateToJobsMock: vi.fn(),
  listApplicationsMock: vi.fn(),
  updateCandidateMatchingStatusMock: vi.fn(),
  getCandidateByIdMock: vi.fn(),
}));

vi.mock("../src/services/auto-matching", () => ({
  autoMatchCandidateToJobs: autoMatchCandidateToJobsMock,
}));

vi.mock("../src/services/applications", () => ({
  listApplications: listApplicationsMock,
}));

vi.mock("../src/services/candidates", () => ({
  createCandidate: vi.fn(),
  enrichCandidateFromCV: vi.fn(),
  getCandidateById: getCandidateByIdMock,
  isCandidateMatchingStatus: (value: string) =>
    ["open", "in_review", "matched", "no_match"].includes(value),
  updateCandidateMatchingStatus: updateCandidateMatchingStatusMock,
}));

import { reviewCandidateMatches } from "../src/services/candidate-intake";

describe("reviewCandidateMatches", () => {
  afterEach(() => {
    vi.clearAllMocks();
  });

  it("avoids overlapping application reads and candidate status updates", async () => {
    autoMatchCandidateToJobsMock.mockResolvedValue([]);
    getCandidateByIdMock.mockResolvedValue(null);

    let applicationsQueryInFlight = false;

    listApplicationsMock.mockImplementation(async () => {
      applicationsQueryInFlight = true;
      await Promise.resolve();
      applicationsQueryInFlight = false;
      return [];
    });

    updateCandidateMatchingStatusMock.mockImplementation(async () => {
      if (applicationsQueryInFlight) {
        throw new Error("Concurrent DB access");
      }

      return {
        id: "candidate-1",
        matchingStatus: "open",
        profileSummary: null,
        headline: null,
        role: "Engineer",
        skillsStructured: null,
        experience: [],
        education: [],
        certifications: [],
        languageSkills: [],
      };
    });

    await expect(
      reviewCandidateMatches("candidate-1", { topN: 5, matchingStatus: "open" }),
    ).resolves.toMatchObject({
      candidate: { id: "candidate-1", matchingStatus: "open" },
      matchingStatus: "open",
      matches: [],
      alreadyLinked: [],
    });
  });
});
