import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockListJobs, mockWithJobsCanonicalSkills } = vi.hoisted(() => ({
  mockListJobs: vi.fn(),
  mockWithJobsCanonicalSkills: vi.fn(),
}));

vi.mock("../src/services/jobs", () => ({
  listJobs: mockListJobs,
}));

vi.mock("../src/services/esco", () => ({
  withJobsCanonicalSkills: mockWithJobsCanonicalSkills,
}));

import { GET } from "../app/api/opdrachten/route";

describe("GET /api/opdrachten", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListJobs.mockResolvedValue({ data: [], total: 0 });
    mockWithJobsCanonicalSkills.mockResolvedValue([]);
  });

  it("parses endClient, status, and pagination filters", async () => {
    const request = new Request(
      "http://localhost/api/opdrachten?q=manager&platform=opdrachtoverheid&endClient=Gemeente%20Utrecht&status=closed&provincie=Utrecht&contractType=interim&tariefMin=80&tariefMax=120&pagina=2&perPage=25",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(mockListJobs).toHaveBeenCalledWith({
      q: "manager",
      platform: "opdrachtoverheid",
      endClient: "Gemeente Utrecht",
      status: "closed",
      province: "Utrecht",
      rateMin: 80,
      rateMax: 120,
      contractType: "interim",
      limit: 25,
      offset: 25,
    });
    expect(body.perPage).toBe(25);
    expect(body.page).toBe(2);
  });
});
