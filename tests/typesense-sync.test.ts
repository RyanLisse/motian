import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockSelect,
  mockFrom,
  mockWhere,
  mockEnsureTypesenseCollection,
  mockTypesenseRequest,
  mockIsTypesenseEnabled,
  mockGetTypesenseConfig,
} = vi.hoisted(() => ({
  mockSelect: vi.fn(),
  mockFrom: vi.fn(),
  mockWhere: vi.fn(),
  mockEnsureTypesenseCollection: vi.fn(),
  mockTypesenseRequest: vi.fn(),
  mockIsTypesenseEnabled: vi.fn(),
  mockGetTypesenseConfig: vi.fn(),
}));

vi.mock("../src/db", () => ({
  and: vi.fn(() => "and-condition"),
  db: {
    select: mockSelect,
  },
  inArray: vi.fn(() => "in-array-condition"),
  isNull: vi.fn(() => "is-null-condition"),
}));

vi.mock("../src/lib/typesense", () => ({
  getTypesenseConfig: mockGetTypesenseConfig,
  isTypesenseEnabled: mockIsTypesenseEnabled,
}));

vi.mock("../src/services/jobs/filters", () => ({
  getVisibleVacancyCondition: vi.fn(() => "visible-vacancy-condition"),
}));

vi.mock("../src/services/search-index/typesense-client", () => ({
  ensureTypesenseCollection: mockEnsureTypesenseCollection,
  typesenseRequest: mockTypesenseRequest,
}));

import {
  deleteCandidatesByIds,
  deleteJobsByIds,
  upsertCandidatesByIds,
  upsertJobsByIds,
} from "../src/services/search-index/typesense-sync";

describe("typesense sync", () => {
  beforeEach(() => {
    vi.clearAllMocks();

    mockSelect.mockReturnValue({
      from: mockFrom,
    });
    mockFrom.mockReturnValue({
      where: mockWhere,
    });
    mockIsTypesenseEnabled.mockReturnValue(true);
    mockGetTypesenseConfig.mockReturnValue({
      url: "https://typesense.example.com",
      apiKey: "secret-key",
      collections: {
        jobs: "motian_jobs_preview",
        candidates: "motian_candidates_preview",
      },
    });
  });

  it("no-ops job upserts when typesense is disabled", async () => {
    mockIsTypesenseEnabled.mockReturnValue(false);

    await upsertJobsByIds(["job-1"]);

    expect(mockWhere).not.toHaveBeenCalled();
    expect(mockEnsureTypesenseCollection).not.toHaveBeenCalled();
    expect(mockTypesenseRequest).not.toHaveBeenCalled();
  });

  it("imports existing jobs and deletes missing ids from the jobs collection", async () => {
    mockWhere.mockResolvedValue([
      {
        id: "job-1",
        title: "Senior Java Developer",
        searchText: "Senior Java Developer",
        platform: "opdrachtoverheid",
        status: "open",
        categories: ["ICT"],
      },
    ]);

    await upsertJobsByIds(["job-1", "job-2"]);

    expect(mockEnsureTypesenseCollection).toHaveBeenCalledWith("jobs");
    expect(mockTypesenseRequest).toHaveBeenNthCalledWith(
      1,
      "/collections/motian_jobs_preview/documents/import",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        searchParams: new URLSearchParams({ action: "upsert" }),
      }),
    );
    expect(mockTypesenseRequest.mock.calls[0]?.[1]?.body).toContain('"id":"job-1"');
    expect(mockTypesenseRequest).toHaveBeenNthCalledWith(
      2,
      "/collections/motian_jobs_preview/documents/job-2",
      { method: "DELETE", skipNotFound: true },
    );
  });

  it("deletes archived jobs when they are no longer visible", async () => {
    mockWhere.mockResolvedValue([]);

    await upsertJobsByIds(["job-archived"]);

    expect(mockTypesenseRequest).toHaveBeenCalledWith(
      "/collections/motian_jobs_preview/documents/job-archived",
      { method: "DELETE", skipNotFound: true },
    );
  });

  it("imports candidates into the configured candidates collection", async () => {
    mockWhere.mockResolvedValue([
      {
        id: "candidate-1",
        name: "Jane Doe",
        role: "Recruiter",
        location: "Amsterdam",
        skills: ["sourcing"],
        matchingStatus: "open",
      },
    ]);

    await upsertCandidatesByIds(["candidate-1"]);

    expect(mockEnsureTypesenseCollection).toHaveBeenCalledWith("candidates");
    expect(mockTypesenseRequest).toHaveBeenCalledWith(
      "/collections/motian_candidates_preview/documents/import",
      expect.objectContaining({
        method: "POST",
        headers: { "Content-Type": "text/plain" },
        searchParams: new URLSearchParams({ action: "upsert" }),
      }),
    );
    expect(mockTypesenseRequest.mock.calls[0]?.[1]?.body).toContain('"id":"candidate-1"');
  });

  it("deletes ids from the correct collections", async () => {
    await deleteJobsByIds(["job-1"]);
    await deleteCandidatesByIds(["candidate-1"]);

    expect(mockTypesenseRequest).toHaveBeenNthCalledWith(
      1,
      "/collections/motian_jobs_preview/documents/job-1",
      { method: "DELETE", skipNotFound: true },
    );
    expect(mockTypesenseRequest).toHaveBeenNthCalledWith(
      2,
      "/collections/motian_candidates_preview/documents/candidate-1",
      { method: "DELETE", skipNotFound: true },
    );
  });
});
