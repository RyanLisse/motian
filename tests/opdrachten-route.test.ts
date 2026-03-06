import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearchJobsUnified, mockWithJobsCanonicalSkills } = vi.hoisted(() => ({
  mockSearchJobsUnified: vi.fn(),
  mockWithJobsCanonicalSkills: vi.fn(),
}));

vi.mock("../src/services/jobs", () => ({
  searchJobsUnified: mockSearchJobsUnified,
  normalizeJobStatusFilter: (value?: string | null) => {
    if (!value || value === "all") return undefined;
    return value === "closed" ? "gesloten" : value;
  },
  normalizeListJobsSortBy: (value?: string | null) => value ?? undefined,
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

  it("parses company, status, category, sorting and perPage filters", async () => {
    const request = new Request(
      "http://localhost/api/opdrachten?q=manager&platform=opdrachtoverheid&company=Belastingdienst&status=gesloten&category=ICT&sortBy=deadline&pagina=2&perPage=25",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(mockSearchJobsUnified).toHaveBeenCalledWith({
      q: "manager",
      platform: "opdrachtoverheid",
      company: "Belastingdienst",
      status: "gesloten",
      category: "ICT",
      sortBy: "deadline",
      province: undefined,
      rateMin: undefined,
      rateMax: undefined,
      contractType: undefined,
      limit: 25,
      offset: 25,
    });
    expect(body.perPage).toBe(25);
    expect(body.page).toBe(2);
  });
});
