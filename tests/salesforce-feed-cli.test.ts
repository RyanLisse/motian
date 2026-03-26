import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockGetSalesforceFeed } = vi.hoisted(() => ({
  mockGetSalesforceFeed: vi.fn(),
}));

vi.mock("../src/services/auto-matching", () => ({
  autoMatchCandidateToJobs: vi.fn(),
  autoMatchJobToCandidates: vi.fn(),
}));

vi.mock("../src/services/candidates", () => ({
  addNoteToCandidate: vi.fn(),
  createCandidate: vi.fn(),
  deleteCandidate: vi.fn(),
  getCandidateById: vi.fn(),
  listCandidates: vi.fn(),
  searchCandidates: vi.fn(),
  updateCandidate: vi.fn(),
}));

vi.mock("../src/services/jobs", () => ({
  deleteJob: vi.fn(),
  getJobById: vi.fn(),
  getJobStats: vi.fn(),
  searchJobsUnified: vi.fn(),
  updateJob: vi.fn(),
}));

vi.mock("../src/services/matches", () => ({
  createMatch: vi.fn(),
  deleteMatch: vi.fn(),
  getMatchById: vi.fn(),
  listMatches: vi.fn(),
  updateMatchStatus: vi.fn(),
}));

vi.mock("../src/services/applications", () => ({
  createApplication: vi.fn(),
  getApplicationById: vi.fn(),
  getApplicationStats: vi.fn(),
  listApplications: vi.fn(),
  updateApplicationStage: vi.fn(),
}));

vi.mock("../src/services/interviews", () => ({
  createInterview: vi.fn(),
  listInterviews: vi.fn(),
  updateInterview: vi.fn(),
}));

vi.mock("../src/services/messages", () => ({
  createMessage: vi.fn(),
  listMessages: vi.fn(),
}));

vi.mock("../src/services/gdpr", () => ({
  eraseCandidateData: vi.fn(),
  exportCandidateData: vi.fn(),
  scrubContactData: vi.fn(),
}));

vi.mock("../src/services/operations-console", () => ({
  importJobsFromActiveScrapers: vi.fn(),
  reviewGdprRetention: vi.fn(),
  runCandidateScoringBatch: vi.fn(),
}));

vi.mock("../src/services/scrape-results", () => ({
  getHistory: vi.fn(),
}));

vi.mock("../src/services/scrapers", () => ({
  activatePlatform: vi.fn(),
  createConfig: vi.fn(),
  createPlatformCatalogEntry: vi.fn(),
  getAllConfigs: vi.fn(),
  getHealth: vi.fn(),
  getPlatformOnboardingStatus: vi.fn(),
  listPlatformCatalog: vi.fn(),
  triggerTestRun: vi.fn(),
  updateConfig: vi.fn(),
  validateConfig: vi.fn(),
}));

vi.mock("../src/services/salesforce-feed", async () => {
  const actual = await vi.importActual<typeof import("../src/services/salesforce-feed")>(
    "../src/services/salesforce-feed",
  );

  return {
    ...actual,
    getSalesforceFeed: mockGetSalesforceFeed,
  };
});

import { commands } from "../src/cli/commands";

describe("salesforce CLI command", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockGetSalesforceFeed.mockResolvedValue([]);
  });

  it("registers a Salesforce feed command that returns shared XML output", async () => {
    mockGetSalesforceFeed.mockResolvedValue([
      {
        objectType: "Application__c",
        fields: {
          Id: "app-1",
          Name: "R&D <Lead>",
          Status__c: "screening",
          LastModifiedDate: new Date("2026-03-01T00:00:00.000Z"),
        },
      },
    ]);

    const command = commands["salesforce:feed"];

    expect(command).toBeDefined();

    const result = await command.handler({
      entity: "applications",
      status: "screening",
      "updated-since": "2026-03-01T10:00:00.000Z",
      limit: "25",
      offset: "50",
    });

    const args = mockGetSalesforceFeed.mock.calls[0]?.[0];

    expect(args).toMatchObject({
      entity: "applications",
      status: "screening",
      limit: 25,
      offset: 50,
    });
    expect(args.updatedSince.toISOString()).toBe("2026-03-01T10:00:00.000Z");
    expect(result).toMatchObject({
      entity: "applications",
      count: 1,
    });
    expect(result.xml).toContain('<?xml version="1.0" encoding="UTF-8"?>');
    expect(result.xml).toContain("<type>Application__c</type>");
    expect(result.xml).toContain("<Name>R&amp;D &lt;Lead&gt;</Name>");
  });

  it("clamps CLI pagination to the same safe bounds as the API route", async () => {
    const command = commands["salesforce:feed"];

    expect(command).toBeDefined();

    await command.handler({
      entity: "jobs",
      limit: "100000",
      offset: "-5",
    });

    expect(mockGetSalesforceFeed).toHaveBeenCalledWith(
      expect.objectContaining({
        entity: "jobs",
        limit: 100,
        offset: 0,
      }),
    );
  });
});
