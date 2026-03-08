import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearchJobsUnified, mockWithJobsCanonicalSkills } = vi.hoisted(() => ({
  mockSearchJobsUnified: vi.fn(),
  mockWithJobsCanonicalSkills: vi.fn(),
}));

vi.mock("../src/services/jobs", () => ({
  searchJobsUnified: mockSearchJobsUnified,
}));

vi.mock("../src/services/esco", () => ({
  withJobsCanonicalSkills: mockWithJobsCanonicalSkills,
}));

import { GET } from "../app/api/opdrachten/route";

describe("GET /api/opdrachten", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchJobsUnified.mockResolvedValue({ data: [], total: 0 });
    mockWithJobsCanonicalSkills.mockResolvedValue([]);
  });

  it("parses recruiter filters and pagination through the shared opdrachten contract", async () => {
    const request = new Request(
      "http://localhost/api/opdrachten?q=manager&platform=opdrachtoverheid&endClient=Gemeente%20Utrecht&status=closed&provincie=utrecht&regio=randstad&regio=noord&vakgebied=ICT&vakgebied=Data&urenPerWeekMin=24&urenPerWeekMax=36&straalKm=25&contractType=interim&tariefMin=80&tariefMax=120&sort=deadline_desc&pagina=2&perPage=25",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(mockSearchJobsUnified).toHaveBeenCalledWith({
      q: "manager",
      platform: "opdrachtoverheid",
      endClient: "Gemeente Utrecht",
      categories: ["ICT", "Data"],
      status: "closed",
      province: "Utrecht",
      regions: ["randstad", "noord"],
      rateMin: 80,
      rateMax: 120,
      contractType: "interim",
      hoursPerWeekBucket: undefined,
      minHoursPerWeek: 24,
      maxHoursPerWeek: 36,
      radiusKm: 25,
      sortBy: "deadline_desc",
      limit: 25,
      offset: 25,
    });
    expect(body.perPage).toBe(25);
    expect(body.page).toBe(2);
  });

  it("maps relevance to search-mode ranking instead of forcing a fallback sort", async () => {
    const request = new Request("http://localhost/api/opdrachten?q=manager&sort=relevantie");

    await GET(request);

    expect(mockSearchJobsUnified).toHaveBeenCalledWith(
      expect.objectContaining({ q: "manager", sortBy: undefined }),
    );
  });
});
