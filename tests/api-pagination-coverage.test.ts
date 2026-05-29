import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockListScreeningCalls,
  mockCountScreeningCalls,
  mockGetRecentEvents,
  mockCountRecentEvents,
  mockGetHistory,
  mockCountHistory,
  mockListPlatformCatalogPage,
  mockListScraperConfigsPage,
  mockListSkillsForFilterOptions,
  mockCountSkillFilterOptions,
} = vi.hoisted(() => ({
  mockListScreeningCalls: vi.fn(),
  mockCountScreeningCalls: vi.fn(),
  mockGetRecentEvents: vi.fn(),
  mockCountRecentEvents: vi.fn(),
  mockGetHistory: vi.fn(),
  mockCountHistory: vi.fn(),
  mockListPlatformCatalogPage: vi.fn(),
  mockListScraperConfigsPage: vi.fn(),
  mockListSkillsForFilterOptions: vi.fn(),
  mockCountSkillFilterOptions: vi.fn(),
}));

vi.mock("@/src/services/screening-calls", () => ({
  listScreeningCalls: mockListScreeningCalls,
  countScreeningCalls: mockCountScreeningCalls,
  createScreeningCall: vi.fn(),
}));

vi.mock("@/src/services/agent-events", () => ({
  getRecentEvents: mockGetRecentEvents,
  countRecentEvents: mockCountRecentEvents,
}));

vi.mock("@/src/services/scrape-results", () => ({
  getHistory: mockGetHistory,
  countHistory: mockCountHistory,
}));

vi.mock("@/src/services/scrapers", () => ({
  listPlatformCatalogPage: mockListPlatformCatalogPage,
  listScraperConfigsPage: mockListScraperConfigsPage,
  createPlatformCatalogEntry: vi.fn(),
  createConfig: vi.fn(),
}));

vi.mock("@/src/services/esco", () => ({
  listSkillsForFilterOptions: mockListSkillsForFilterOptions,
  countSkillFilterOptions: mockCountSkillFilterOptions,
}));

import { GET as getAgentEvents } from "../app/api/agent-events/route";
import { GET as getPlatforms } from "../app/api/platforms/route";
import { GET as getScrapeResults } from "../app/api/scrape-resultaten/route";
import { GET as getScraperConfigs } from "../app/api/scraper-configuraties/route";
import { GET as getScreeningCalls } from "../app/api/screening-calls/route";
import { GET as getSkills } from "../app/api/vaardigheden/route";

describe("API pagination coverage", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockListScreeningCalls.mockResolvedValue([{ id: "call-1" }]);
    mockCountScreeningCalls.mockResolvedValue(9);
    mockGetRecentEvents.mockResolvedValue([{ id: "evt-1" }]);
    mockCountRecentEvents.mockResolvedValue(7);
    mockGetHistory.mockResolvedValue([{ id: "run-1" }]);
    mockCountHistory.mockResolvedValue(12);
    mockListPlatformCatalogPage.mockResolvedValue({
      data: [{ slug: "example-platform" }],
      total: 6,
    });
    mockListScraperConfigsPage.mockResolvedValue({
      data: [{ id: "cfg-1", platform: "striive" }],
      total: 11,
    });
    mockListSkillsForFilterOptions.mockResolvedValue([{ slug: "react", name: "React" }]);
    mockCountSkillFilterOptions.mockResolvedValue(13);
  });

  it("paginates screening calls with Dutch aliases", async () => {
    const response = await getScreeningCalls(
      new Request("http://localhost/api/screening-calls?candidateId=cand-1&pagina=2&perPage=5"),
    );
    const body = await response.json();

    expect(mockListScreeningCalls).toHaveBeenCalledWith({
      candidateId: "cand-1",
      limit: 5,
      offset: 5,
    });
    expect(mockCountScreeningCalls).toHaveBeenCalledWith("cand-1");
    expect(body).toMatchObject({ total: 9, page: 2, perPage: 5, totalPages: 2 });
  });

  it("keeps screening calls validation when candidateId is missing", async () => {
    const response = await getScreeningCalls(new Request("http://localhost/api/screening-calls"));

    expect(response.status).toBe(400);
    expect(mockListScreeningCalls).not.toHaveBeenCalled();
  });

  it("paginates agent events with shared parsing", async () => {
    const response = await getAgentEvents(
      new Request(
        "http://localhost/api/agent-events?sourceAgent=planner&eventType=task&page=3&limit=20",
      ),
    );
    const body = await response.json();

    expect(mockGetRecentEvents).toHaveBeenCalledWith({
      limit: 20,
      offset: 40,
      sourceAgent: "planner",
      eventType: "task",
    });
    expect(mockCountRecentEvents).toHaveBeenCalledWith({
      sourceAgent: "planner",
      eventType: "task",
    });
    expect(body).toMatchObject({ total: 7, page: 3, perPage: 20, totalPages: 1 });
  });

  it("paginates scrape results with total parity", async () => {
    const response = await getScrapeResults(
      new Request("http://localhost/api/scrape-resultaten?platform=striive&page=2&limit=10"),
    );
    const body = await response.json();

    expect(mockGetHistory).toHaveBeenCalledWith({ platform: "striive", limit: 10, offset: 10 });
    expect(mockCountHistory).toHaveBeenCalledWith({ platform: "striive" });
    expect(body).toMatchObject({ total: 12, page: 2, perPage: 10, totalPages: 2 });
  });

  it("paginates scraper configuration responses", async () => {
    const response = await getScraperConfigs(
      new Request("http://localhost/api/scraper-configuraties?pagina=2&perPage=5"),
    );
    const body = await response.json();

    expect(mockListScraperConfigsPage).toHaveBeenCalledWith({ limit: 5, offset: 5 });
    expect(body).toMatchObject({ total: 11, page: 2, perPage: 5, totalPages: 3 });
  });

  it("paginates recruiter skill filter responses when requested", async () => {
    const response = await getSkills(
      new Request("http://localhost/api/vaardigheden?q=react&page=3&limit=2"),
    );
    const body = await response.json();

    expect(mockListSkillsForFilterOptions).toHaveBeenCalledWith("react", {
      limit: 2,
      offset: 4,
    });
    expect(mockCountSkillFilterOptions).toHaveBeenCalledWith("react");
    expect(body).toMatchObject({ total: 13, page: 3, perPage: 2, totalPages: 7 });
  });

  it("paginates platform catalog responses", async () => {
    const response = await getPlatforms(
      new Request("http://localhost/api/platforms?pagina=2&perPage=3"),
    );
    const body = await response.json();

    expect(mockListPlatformCatalogPage).toHaveBeenCalledWith({ limit: 3, offset: 3 });
    expect(body).toMatchObject({ total: 6, page: 2, perPage: 3, totalPages: 2 });
  });
});
