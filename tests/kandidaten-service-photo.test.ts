import { beforeEach, describe, expect, it, vi } from "vitest";

const { mockDb, mockReturning, mockValues } = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockValues = vi.fn(() => ({ returning: mockReturning }));
  const mockInsert = vi.fn(() => ({ values: mockValues }));
  const mockDb = { insert: mockInsert, select: vi.fn(), update: vi.fn() };
  return { mockDb, mockReturning, mockValues, mockInsert };
});

vi.mock("../src/db", () => ({
  db: mockDb,
  eq: vi.fn(),
  and: vi.fn(),
  desc: vi.fn(),
  getTableColumns: vi.fn((table: Record<string, unknown>) => table),
  isNull: vi.fn(),
  inArray: vi.fn(),
  sql: vi.fn(),
}));

vi.mock("../src/db/schema", () => ({
  candidates: { id: "id", deletedAt: "deletedAt", createdAt: "createdAt" },
  candidateSkills: { candidateId: "candidateId", escoUri: "escoUri" },
}));

vi.mock("../src/lib/event-bus", () => ({
  queueDeferredEmbeddingSync: vi.fn(),
}));

vi.mock("../src/lib/helpers", () => ({
  caseInsensitiveContains: vi.fn(),
  escapeLike: vi.fn((s: string) => s),
  toTsQueryInput: vi.fn(),
}));

vi.mock("../src/lib/query-observability", () => ({
  LIST_SLO_MS: 500,
  SEARCH_SLO_MS: 500,
  logSlowQuery: vi.fn(),
}));

vi.mock("../src/services/agent-events", () => ({
  emitAgentEvent: vi.fn(),
}));

vi.mock("../src/services/embedding", () => ({
  withPendingEmbeddingStatus: vi.fn((c: unknown) => ({
    ...(c as Record<string, unknown>),
    embeddingStatus: "pending",
  })),
}));

vi.mock("../src/services/esco", () => ({
  syncCandidateSkills: vi.fn(),
}));


import {
  type CreateCandidateData,
  candidateReadSelection,
  createCandidate,
} from "../src/services/candidates";

describe("createCandidate photoUrl support", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("passes photoUrl to the database insert when provided", async () => {
    const fakeCandidate = {
      id: "cand-1",
      name: "Jan de Vries",
      photoUrl: "https://example.com/photo.jpg",
      skills: [],
      deletedAt: null,
    };
    mockReturning.mockResolvedValueOnce([fakeCandidate]);

    const data: CreateCandidateData = {
      name: "Jan de Vries",
      photoUrl: "https://example.com/photo.jpg",
    };

    const result = await createCandidate(data);

    const passedValues = mockValues.mock.calls[0]?.[0];
    expect(passedValues).toHaveProperty("photoUrl", "https://example.com/photo.jpg");
    expect(result).toHaveProperty("photoUrl", "https://example.com/photo.jpg");
    expect(result).toHaveProperty("embeddingStatus", "pending");
  });

  it("passes undefined photoUrl when not provided", async () => {
    const fakeCandidate = {
      id: "cand-2",
      name: "Maria Jansen",
      photoUrl: undefined,
      skills: [],
      deletedAt: null,
    };
    mockReturning.mockResolvedValueOnce([fakeCandidate]);

    const data: CreateCandidateData = {
      name: "Maria Jansen",
    };

    const result = await createCandidate(data);

    const passedValues = mockValues.mock.calls[0]?.[0];
    expect(passedValues).toHaveProperty("photoUrl", undefined);
    expect(result).toHaveProperty("name", "Maria Jansen");
  });

  it("handles null photoUrl in returned candidate gracefully", async () => {
    const fakeCandidate = {
      id: "cand-3",
      name: "Pieter Bakker",
      photoUrl: null,
      skills: ["TypeScript"],
      deletedAt: null,
    };
    mockReturning.mockResolvedValueOnce([fakeCandidate]);

    const data: CreateCandidateData = {
      name: "Pieter Bakker",
      skills: ["TypeScript"],
    };

    const result = await createCandidate(data);

    expect(result).toHaveProperty("photoUrl", null);
    expect(result).toHaveProperty("embeddingStatus", "pending");
  });

  it("includes photoUrl in the CreateCandidateData type", () => {
    const withPhoto: CreateCandidateData = {
      name: "Test",
      photoUrl: "https://example.com/img.png",
    };
    const withoutPhoto: CreateCandidateData = {
      name: "Test",
    };
    const withUndefined: CreateCandidateData = {
      name: "Test",
      photoUrl: undefined,
    };

    expect(withPhoto.photoUrl).toBe("https://example.com/img.png");
    expect(withoutPhoto.photoUrl).toBeUndefined();
    expect(withUndefined.photoUrl).toBeUndefined();
  });

  it("keeps read projections compatible when photo_url is absent in the database", () => {
    expect(candidateReadSelection).toHaveProperty("photoUrl");
    expect("photoUrl" in candidateReadSelection).toBe(true);
  });
});
