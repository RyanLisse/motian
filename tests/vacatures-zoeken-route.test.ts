import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockRunJobPageSearch } = vi.hoisted(() => ({
  mockRunJobPageSearch: vi.fn(),
}));

vi.mock("../src/lib/job-search-runner", () => ({
  runJobPageSearch: mockRunJobPageSearch,
}));

import { GET } from "../app/api/vacatures/zoeken/route";

describe("GET /api/vacatures/zoeken", () => {
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
        page: 2,
        limit: 25,
        offset: 25,
      },
    });
  });

  it("delegates filters to the shared page runner and returns compact vacatures rows", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/vacatures/zoeken?q=manager&pagina=2&perPage=25"),
    } as Parameters<typeof GET>[0];

    const response = await GET(request);
    const body = await response.json();

    expect(mockRunJobPageSearch).toHaveBeenCalledTimes(1);
    const params = mockRunJobPageSearch.mock.calls[0][0] as URLSearchParams;
    expect(params.get("q")).toBe("manager");
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
      page: 2,
      perPage: 25,
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
      nextUrl: new URL("http://localhost/api/vacatures/zoeken?page=abc"),
    } as Parameters<typeof GET>[0];

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body).toEqual({ error: "Ongeldige parameters" });
  });
});
