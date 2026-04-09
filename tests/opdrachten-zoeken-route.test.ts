import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRunJobPageSearch } = vi.hoisted(() => {
  return {
    mockRunJobPageSearch: vi.fn(),
  };
});

vi.mock("../src/lib/job-search-runner", () => ({
  runJobPageSearch: mockRunJobPageSearch,
}));

import { GET } from "../app/api/opdrachten/zoeken/route";

describe("GET /api/opdrachten/zoeken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockRunJobPageSearch.mockResolvedValue({
      ok: true,
      data: {
        result: {
          data: [
            {
              id: "job-1",
              title: "Manager Inhuur",
              company: "Gemeente Utrecht",
              location: "Utrecht",
              platform: "opdrachtoverheid",
              workArrangement: "hybride",
              contractType: "interim",
              applicationDeadline: null,
              hasPipeline: true,
              pipelineCount: 3,
            },
          ],
          total: 1,
        },
        page: 1,
        limit: 10,
        offset: 0,
      },
    });
  });

  it("delegates filters to the shared page runner and returns compact recruiter jobs", async () => {
    const request = {
      nextUrl: new URL(
        "http://localhost/api/opdrachten/zoeken?q=manager&platform=opdrachtoverheid&platform=indeed&endClient=Gemeente%20Utrecht&status=closed&provincie=utrecht&regio=randstad&regio=noord&vakgebied=ICT&vakgebied=Data&vaardigheid=skill:java&urenPerWeekMin=24&urenPerWeekMax=36&straalKm=25&contractType=interim&tariefMin=80&tariefMax=120&sort=deadline_desc&pagina=2&perPage=25",
      ),
    } as Parameters<typeof GET>[0];

    const response = await GET(request);
    const body = await response.json();

    expect(mockRunJobPageSearch).toHaveBeenCalledTimes(1);
    const params = mockRunJobPageSearch.mock.calls[0][0] as URLSearchParams;
    expect(params.get("q")).toBe("manager");
    expect(params.get("platform")).toBe("opdrachtoverheid");
    expect(params.getAll("platform")).toEqual(["opdrachtoverheid", "indeed"]);
    expect(params.get("vakgebied")).toBe("ICT");
    expect(params.getAll("vakgebied")).toEqual(["ICT", "Data"]);
    expect(params.get("pagina")).toBe("2");
    expect(params.get("perPage")).toBe("25");

    expect(body).toEqual({
      jobs: [
        {
          id: "job-1",
          title: "Manager Inhuur",
          company: "Gemeente Utrecht",
          location: "Utrecht",
          platform: "opdrachtoverheid",
          workArrangement: "hybride",
          contractType: "interim",
          applicationDeadline: null,
          hasPipeline: true,
          pipelineCount: 3,
        },
      ],
      total: 1,
      page: 1,
      perPage: 10,
      totalPages: 1,
    });
  });

  it("returns shared runner validation errors unchanged", async () => {
    mockRunJobPageSearch.mockResolvedValueOnce({
      ok: false,
      error: {
        status: 400,
        body: { error: "Ongeldige parameters" },
      },
    });

    const request = {
      nextUrl: new URL("http://localhost/api/opdrachten/zoeken?page=abc"),
    } as Parameters<typeof GET>[0];

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Ongeldige parameters" });
  });

  it("returns empty page rows directly from the shared page runner", async () => {
    mockRunJobPageSearch.mockResolvedValueOnce({
      ok: true,
      data: {
        result: { data: [], total: 0 },
        page: 1,
        limit: 10,
        offset: 0,
      },
    });

    const request = {
      nextUrl: new URL("http://localhost/api/opdrachten/zoeken"),
    } as Parameters<typeof GET>[0];

    const response = await GET(request);
    const body = await response.json();

    expect(body.jobs).toEqual([]);
  });
});
