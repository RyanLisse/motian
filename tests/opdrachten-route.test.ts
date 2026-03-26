import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRunVacaturesSearch, mockWithJobsCanonicalSkills } = vi.hoisted(() => ({
  mockRunVacaturesSearch: vi.fn(),
  mockWithJobsCanonicalSkills: vi.fn(),
}));

vi.mock("../src/lib/vacatures-search", () => ({
  runVacaturesSearch: mockRunVacaturesSearch,
}));

vi.mock("../src/services/esco", () => ({
  withJobsCanonicalSkills: mockWithJobsCanonicalSkills,
}));

import { GET } from "../app/api/opdrachten/route";

describe("GET /api/opdrachten", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunVacaturesSearch.mockResolvedValue({
      ok: true,
      data: {
        result: { data: [], total: 0 },
        page: 1,
        limit: 50,
        offset: 0,
      },
    });
    mockWithJobsCanonicalSkills.mockResolvedValue([]);
  });

  it("delegates the request query to the shared vacatures search runner", async () => {
    const request = new Request(
      "http://localhost/api/opdrachten?q=manager&platform=opdrachtoverheid&endClient=Gemeente%20Utrecht&status=closed&provincie=utrecht&regio=randstad&regio=noord&vakgebied=ICT&vakgebied=Data&vaardigheid=skill:java&urenPerWeekMin=24&urenPerWeekMax=36&straalKm=25&contractType=interim&tariefMin=80&tariefMax=120&sort=deadline_desc&pagina=2&perPage=25",
    );

    const response = await GET(request);
    const body = await response.json();

    expect(mockRunVacaturesSearch).toHaveBeenCalledTimes(1);
    const params = mockRunVacaturesSearch.mock.calls[0][0] as URLSearchParams;
    expect(params.get("q")).toBe("manager");
    expect(params.get("platform")).toBe("opdrachtoverheid");
    expect(params.getAll("vakgebied")).toEqual(["ICT", "Data"]);
    expect(params.get("pagina")).toBe("2");
    expect(params.get("perPage")).toBe("25");
    expect(body.perPage).toBe(50);
    expect(body.page).toBe(1);
  });

  it("returns paginated canonicalized job data from the shared runner result", async () => {
    mockRunVacaturesSearch.mockResolvedValueOnce({
      ok: true,
      data: {
        result: {
          data: [{ id: "job-1", title: "Manager Inhuur" }],
          total: 3,
        },
        page: 2,
        limit: 25,
        offset: 25,
      },
    });
    mockWithJobsCanonicalSkills.mockResolvedValueOnce([{ id: "job-1", title: "Manager Inhuur" }]);

    const request = new Request("http://localhost/api/opdrachten?q=manager&pagina=2&perPage=25");
    await GET(request);

    expect(mockWithJobsCanonicalSkills).toHaveBeenCalledWith([
      { id: "job-1", title: "Manager Inhuur" },
    ]);
  });

  it("returns runner validation errors unchanged", async () => {
    mockRunVacaturesSearch.mockResolvedValueOnce({
      ok: false,
      error: {
        status: 400,
        body: { error: "Ongeldige parameters" },
      },
    });

    const request = new Request("http://localhost/api/opdrachten?page=abc");
    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Ongeldige parameters");
  });
});
