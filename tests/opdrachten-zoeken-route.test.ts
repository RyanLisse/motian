import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockSearchJobsUnified, mockGroupBy, mockSelect } = vi.hoisted(() => {
  const mockGroupBy = vi.fn();
  const mockWhere = vi.fn(() => ({ groupBy: mockGroupBy }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));

  return {
    mockSearchJobsUnified: vi.fn(),
    mockGroupBy,
    mockSelect,
  };
});

vi.mock("../src/services/jobs", () => ({
  searchJobsUnified: mockSearchJobsUnified,
}));

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: {
    select: mockSelect,
  },
}));

vi.mock("../src/db/schema", () => ({
  applications: {
    jobId: "applications.jobId",
    deletedAt: "applications.deletedAt",
    stage: "applications.stage",
  },
}));

vi.mock("drizzle-orm", () => ({
  and: (...args: unknown[]) => ({ type: "and", args }),
  inArray: (...args: unknown[]) => ({ type: "inArray", args }),
  isNotNull: (column: unknown) => ({ type: "isNotNull", column }),
  isNull: (column: unknown) => ({ type: "isNull", column }),
  ne: (column: unknown, value: unknown) => ({ type: "ne", column, value }),
  sql: (strings: TemplateStringsArray, ...values: unknown[]) => ({ type: "sql", strings, values }),
}));

import { GET } from "../app/api/opdrachten/zoeken/route";

describe("GET /api/opdrachten/zoeken", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSearchJobsUnified.mockResolvedValue({
      data: [
        {
          id: "job-1",
          title: "Manager Inhuur",
          endClient: "Gemeente Utrecht",
          company: "Motian",
          location: "Utrecht",
          platform: "opdrachtoverheid",
          workArrangement: "hybride",
          contractType: "interim",
        },
      ],
      total: 1,
    });
    mockGroupBy.mockResolvedValue([{ jobId: "job-1", pipelineCount: 3 }]);
  });

  it("forwards the shared recruiter filter contract and returns compact recruiter jobs", async () => {
    const request = {
      nextUrl: new URL(
        "http://localhost/api/opdrachten/zoeken?q=manager&platform=opdrachtoverheid&endClient=Gemeente%20Utrecht&status=closed&provincie=utrecht&regio=randstad&regio=noord&vakgebied=ICT&vakgebied=Data&vaardigheid=skill:java&urenPerWeekMin=24&urenPerWeekMax=36&straalKm=25&contractType=interim&tariefMin=80&tariefMax=120&sort=deadline_desc&pagina=2&perPage=25",
      ),
    } as Parameters<typeof GET>[0];

    const response = await GET(request);
    const body = await response.json();

    expect(mockSearchJobsUnified).toHaveBeenCalledWith({
      q: "manager",
      platform: "opdrachtoverheid",
      endClient: "Gemeente Utrecht",
      categories: ["ICT", "Data"],
      escoUri: "skill:java",
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
          hasPipeline: true,
          pipelineCount: 3,
        },
      ],
      total: 1,
      page: 2,
      perPage: 25,
      totalPages: 1,
    });
    expect(mockSelect).toHaveBeenCalledTimes(1);
    expect(mockGroupBy).toHaveBeenCalledTimes(1);
  });

  it("preserves hybrid-search relevance when relevantie is selected", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/opdrachten/zoeken?q=manager&sort=relevantie"),
    } as Parameters<typeof GET>[0];

    await GET(request);

    expect(mockSearchJobsUnified).toHaveBeenCalledWith(
      expect.objectContaining({ q: "manager", sortBy: undefined }),
    );
  });

  it("keeps query searches on relevance when no sort param is provided", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/opdrachten/zoeken?q=manager"),
    } as Parameters<typeof GET>[0];

    await GET(request);

    expect(mockSearchJobsUnified).toHaveBeenCalledWith(
      expect.objectContaining({ q: "manager", sortBy: undefined }),
    );
  });

  it("returns 400 for malformed pagination params before hitting the service layer", async () => {
    const request = {
      nextUrl: new URL("http://localhost/api/opdrachten/zoeken?page=abc"),
    } as Parameters<typeof GET>[0];

    const response = await GET(request);
    const body = await response.json();

    expect(response.status).toBe(400);
    expect(body.error).toBe("Ongeldige parameters");
    expect(mockSearchJobsUnified).not.toHaveBeenCalled();
  });

  it("skips the applications aggregation when no jobs are returned", async () => {
    mockSearchJobsUnified.mockResolvedValueOnce({ data: [], total: 0 });

    const request = {
      nextUrl: new URL("http://localhost/api/opdrachten/zoeken"),
    } as Parameters<typeof GET>[0];

    const response = await GET(request);
    const body = await response.json();

    expect(body.jobs).toEqual([]);
    expect(mockSelect).not.toHaveBeenCalled();
    expect(mockGroupBy).not.toHaveBeenCalled();
  });
});
