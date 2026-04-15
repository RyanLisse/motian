import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------- Mocks (hoisted) ----------

const { mockDb, mockEmitAgentEvent, mockQueueDeferredEmbeddingSync } = vi.hoisted(() => {
  const mockInsert = vi.fn();
  const mockUpdate = vi.fn();
  const mockSelect = vi.fn();

  const returningFn = vi.fn();
  const valuesFn = vi.fn().mockReturnValue({ returning: returningFn });
  const setFn = vi.fn().mockReturnValue({
    where: vi.fn().mockReturnValue({ returning: returningFn }),
  });
  const whereFn = vi.fn().mockReturnValue({ limit: vi.fn().mockReturnValue([]) });

  mockInsert.mockReturnValue({ values: valuesFn });
  mockUpdate.mockReturnValue({ set: setFn });
  mockSelect.mockReturnValue({ from: vi.fn().mockReturnValue({ where: whereFn }) });

  return {
    mockDb: {
      insert: mockInsert,
      update: mockUpdate,
      select: mockSelect,
      returning: returningFn,
    },
    mockEmitAgentEvent: vi.fn().mockResolvedValue({ id: "evt-1" }),
    mockQueueDeferredEmbeddingSync: vi.fn().mockResolvedValue(undefined),
  };
});

vi.mock("../src/db", () => ({
  db: {
    insert: mockDb.insert,
    update: mockDb.update,
    select: mockDb.select,
  },
  eq: vi.fn((...args: unknown[]) => ({ type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ type: "and", args })),
  desc: vi.fn((col: unknown) => ({ type: "desc", col })),
  isNull: vi.fn((col: unknown) => ({ type: "isNull", col })),
  inArray: vi.fn((...args: unknown[]) => ({ type: "inArray", args })),
  sql: vi.fn(() => "sql"),
  getTableColumns: vi.fn((table: Record<string, unknown>) => table),
}));

vi.mock("../src/db/schema", () => ({
  candidates: {
    id: "id",
    name: "name",
    email: "email",
    deletedAt: "deletedAt",
    createdAt: "createdAt",
    skills: "skills",
    updatedAt: "updatedAt",
  },
  candidateSkills: { candidateId: "candidateId", escoUri: "escoUri" },
}));

vi.mock("../src/services/agent-events", () => ({
  emitAgentEvent: mockEmitAgentEvent,
}));

vi.mock("../src/lib/event-bus", () => ({
  queueDeferredEmbeddingSync: mockQueueDeferredEmbeddingSync,
}));

// Mock remaining synchronous derived sync dependency as a no-op
vi.mock("../src/services/esco", () => ({
  syncCandidateSkills: vi.fn().mockResolvedValue(undefined),
}));

vi.mock("../src/lib/query-observability", () => ({
  LIST_SLO_MS: 500,
  SEARCH_SLO_MS: 1000,
  logSlowQuery: vi.fn(),
}));

vi.mock("../src/lib/helpers", () => ({
  caseInsensitiveContains: vi.fn(),
  escapeLike: vi.fn((s: string) => s),
  toTsQueryInput: vi.fn(() => null),
}));

import { createCandidate, updateCandidate } from "../src/services/candidates";

// ---------- Tests ----------

describe("candidate auto-match event emission", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("emits candidate.parsed when creating a candidate with skills", async () => {
    const fakeCandidate = {
      id: "cand-123",
      name: "Jan de Vries",
      skills: ["TypeScript", "React"],
      email: null,
      phone: null,
      role: "Frontend Developer",
      location: null,
      source: null,
      linkedinUrl: null,
      headline: null,
      profileSummary: null,
      hourlyRate: null,
      availability: null,
      notes: null,
      experience: null,
      education: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock: insert().values().returning() → [fakeCandidate]
    mockDb.returning.mockResolvedValueOnce([fakeCandidate]);
    await createCandidate({
      name: "Jan de Vries",
      skills: ["TypeScript", "React"],
      role: "Frontend Developer",
    });

    expect(mockQueueDeferredEmbeddingSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "candidate",
        entityId: "cand-123",
      }),
    );
    expect(mockEmitAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAgent: "intake",
        eventType: "candidate.parsed",
        candidateId: "cand-123",
      }),
    );
  });

  it("does NOT emit candidate.parsed when creating a candidate without skills", async () => {
    const fakeCandidate = {
      id: "cand-456",
      name: "Kees Bakker",
      skills: null,
      email: null,
      phone: null,
      role: null,
      location: null,
      source: null,
      linkedinUrl: null,
      headline: null,
      profileSummary: null,
      hourlyRate: null,
      availability: null,
      notes: null,
      experience: null,
      education: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDb.returning.mockResolvedValueOnce([fakeCandidate]);
    await createCandidate({ name: "Kees Bakker" });

    expect(mockQueueDeferredEmbeddingSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "candidate",
        entityId: "cand-456",
      }),
    );
    expect(mockEmitAgentEvent).not.toHaveBeenCalled();
  });

  it("does NOT emit candidate.parsed when creating a candidate with empty skills array", async () => {
    const fakeCandidate = {
      id: "cand-789",
      name: "Piet Jansen",
      skills: [],
      email: null,
      phone: null,
      role: null,
      location: null,
      source: null,
      linkedinUrl: null,
      headline: null,
      profileSummary: null,
      hourlyRate: null,
      availability: null,
      notes: null,
      experience: null,
      education: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    mockDb.returning.mockResolvedValueOnce([fakeCandidate]);
    await createCandidate({ name: "Piet Jansen", skills: [] });

    expect(mockQueueDeferredEmbeddingSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "candidate",
        entityId: "cand-789",
      }),
    );
    expect(mockEmitAgentEvent).not.toHaveBeenCalled();
  });

  it("emits candidate.parsed when updating a candidate that gains skills", async () => {
    const updatedCandidate = {
      id: "cand-100",
      name: "Sara Willems",
      skills: ["Python", "Django"],
      email: null,
      phone: null,
      role: "Backend Developer",
      location: null,
      source: null,
      linkedinUrl: null,
      headline: null,
      profileSummary: null,
      hourlyRate: null,
      availability: null,
      notes: null,
      experience: null,
      education: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    // Mock: update().set().where().returning() → [updatedCandidate]
    const updateReturningFn = vi.fn().mockResolvedValue([updatedCandidate]);
    const updateWhereFn = vi.fn().mockReturnValue({ returning: updateReturningFn });
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    mockDb.update.mockReturnValueOnce({ set: updateSetFn });

    await updateCandidate("cand-100", {
      skills: ["Python", "Django"],
      role: "Backend Developer",
    });

    expect(mockQueueDeferredEmbeddingSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "candidate",
        entityId: "cand-100",
      }),
    );
    expect(mockEmitAgentEvent).toHaveBeenCalledWith(
      expect.objectContaining({
        sourceAgent: "intake",
        eventType: "candidate.parsed",
        candidateId: "cand-100",
      }),
    );
  });

  it("does NOT emit candidate.parsed when updating a candidate that has no skills", async () => {
    const updatedCandidate = {
      id: "cand-200",
      name: "Tom Hendriks",
      skills: null,
      email: "tom@example.com",
      phone: null,
      role: null,
      location: "Amsterdam",
      source: null,
      linkedinUrl: null,
      headline: null,
      profileSummary: null,
      hourlyRate: null,
      availability: null,
      notes: null,
      experience: null,
      education: null,
      deletedAt: null,
      createdAt: new Date(),
      updatedAt: new Date(),
    };

    const updateReturningFn = vi.fn().mockResolvedValue([updatedCandidate]);
    const updateWhereFn = vi.fn().mockReturnValue({ returning: updateReturningFn });
    const updateSetFn = vi.fn().mockReturnValue({ where: updateWhereFn });
    mockDb.update.mockReturnValueOnce({ set: updateSetFn });

    await updateCandidate("cand-200", { location: "Amsterdam" });

    expect(mockQueueDeferredEmbeddingSync).toHaveBeenCalledWith(
      expect.objectContaining({
        entityType: "candidate",
        entityId: "cand-200",
      }),
    );
    expect(mockEmitAgentEvent).not.toHaveBeenCalled();
  });
});
