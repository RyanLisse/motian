import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockEmbed,
  mockEmbedMany,
  mockLimit,
  mockWhere,
  mockSelect,
  mockUpdateSet,
  mockUpdate,
  mockExecute,
} = vi.hoisted(() => {
  const mockLimit = vi.fn();
  const mockWhere = vi.fn(() => ({ limit: mockLimit }));
  const mockFrom = vi.fn(() => ({ where: mockWhere }));
  const mockSelect = vi.fn(() => ({ from: mockFrom }));
  const mockUpdateWhere = vi.fn(async () => undefined);
  const mockUpdateSet = vi.fn(() => ({ where: mockUpdateWhere }));
  const mockUpdate = vi.fn(() => ({ set: mockUpdateSet }));
  const mockExecute = vi.fn(async () => ({ rows: [] }));
  return {
    mockEmbed: vi.fn(),
    mockEmbedMany: vi.fn(),
    mockLimit,
    mockWhere,
    mockSelect,
    mockUpdateSet,
    mockUpdate,
    mockExecute,
  };
});

vi.mock("@/src/lib/ai-models", () => ({
  embeddingModel: "mock-embedding-model",
  tracedEmbed: mockEmbed,
  tracedEmbedMany: mockEmbedMany,
}));

vi.mock("@/src/lib/retry", () => ({
  withRetry: async <T>(fn: () => Promise<T>) => fn(),
}));

vi.mock("@/src/db", () => ({
  db: {
    select: mockSelect,
    update: mockUpdate,
    execute: mockExecute,
  },
  and: (...args: unknown[]) => ({ type: "and", args }),
  eq: (a: unknown, b: unknown) => ({ type: "eq", a, b }),
  isNull: (col: unknown) => ({ type: "isNull", col }),
  sql: Object.assign(
    (strings: TemplateStringsArray, ...values: unknown[]) => ({
      type: "sql",
      strings,
      values,
    }),
    { join: (parts: unknown[], sep: unknown) => ({ type: "join", parts, sep }) },
  ),
}));

vi.mock("@/src/db/schema", () => ({
  candidates: {
    id: "candidates.id",
    name: "candidates.name",
    role: "candidates.role",
    skills: "candidates.skills",
    experience: "candidates.experience",
    location: "candidates.location",
    profileSummary: "candidates.profileSummary",
    notes: "candidates.notes",
    resumeRaw: "candidates.resumeRaw",
    embedding: "candidates.embedding",
    deletedAt: "candidates.deletedAt",
  },
  jobs: {
    id: "jobs.id",
    embedding: "jobs.embedding",
  },
}));

import {
  buildCandidateEmbeddingText,
  embedCandidate,
  embedCandidatesBatch,
  generateEmbedding,
} from "@/src/services/embedding";

describe("candidate embedding generation (R17)", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockEmbed.mockResolvedValue({ embedding: Array.from({ length: 512 }, (_, i) => i * 0.001) });
    mockEmbedMany.mockResolvedValue({
      embeddings: [Array.from({ length: 512 }, (_, i) => i * 0.001)],
    });
  });

  it("composes input text from role, skills, experience, location, notes, and CV", () => {
    const text = buildCandidateEmbeddingText({
      name: "Jan Jansen",
      role: "Data Engineer",
      skills: ["Python", "Spark"],
      experience: [{ description: "ETL pipelines bij Kadaster" }],
      location: "Utrecht",
      profileSummary: "Senior data engineer",
      notes: "Beschikbaar per 1 april",
      resumeRaw: "CV tekst met Python ervaring",
    });

    expect(text).toContain("Data Engineer");
    expect(text).toContain("Profiel: Senior data engineer");
    expect(text).toContain("Skills: Python, Spark");
    expect(text).toContain("Ervaring: ETL pipelines bij Kadaster");
    expect(text).toContain("Utrecht");
    expect(text).toContain("Notities: Beschikbaar per 1 april");
    expect(text).toContain("CV: CV tekst met Python ervaring");
    // Name is intentionally omitted from the embedding text composition.
    expect(text).not.toContain("Jan Jansen");
  });

  it("produces a 512-dimensional vector via the shared embedding path", async () => {
    const vector = await generateEmbedding("Data Engineer\nSkills: Python");

    expect(vector).toHaveLength(512);
    expect(mockEmbed).toHaveBeenCalledWith(
      expect.objectContaining({
        value: "Data Engineer\nSkills: Python",
        providerOptions: { openai: { dimensions: 512 } },
      }),
    );
  });

  it("persists a 512-d embedding for a candidate and skips when text is too short", async () => {
    mockLimit.mockResolvedValueOnce([
      {
        id: "cand-1",
        name: "Ada",
        role: "Backend Engineer",
        skills: ["TypeScript"],
        experience: [],
        location: "Amsterdam",
        profileSummary: null,
        notes: null,
        resumeRaw: null,
      },
    ]);

    const embedded = await embedCandidate("cand-1");
    expect(embedded).toBe(true);
    expect(mockEmbed).toHaveBeenCalledOnce();
    expect(mockUpdateSet).toHaveBeenCalledWith(
      expect.objectContaining({
        embedding: expect.stringMatching(/^\[/),
      }),
    );
    const stored = mockUpdateSet.mock.calls[0]?.[0]?.embedding as string;
    expect(stored.split(",")).toHaveLength(512);

    mockLimit.mockResolvedValueOnce([
      {
        id: "cand-2",
        name: "X",
        role: null,
        skills: [],
        experience: [],
        location: null,
        profileSummary: null,
        notes: null,
        resumeRaw: null,
      },
    ]);
    mockEmbed.mockClear();

    const skipped = await embedCandidate("cand-2");
    expect(skipped).toBe(false);
    expect(mockEmbed).not.toHaveBeenCalled();
  });

  it("batch backfill skips candidates that already have embeddings and short text rows", async () => {
    // Query already filters isNull(embedding); return only pending rows, one too-short.
    mockLimit.mockResolvedValueOnce([
      {
        id: "pending-ok",
        name: "Ok",
        role: "DevOps Engineer",
        skills: ["Kubernetes"],
        experience: [],
        location: "Den Haag",
        profileSummary: null,
        notes: null,
        resumeRaw: null,
      },
      {
        id: "pending-short",
        name: "Short",
        role: null,
        skills: [],
        experience: [],
        location: null,
        profileSummary: null,
        notes: null,
        resumeRaw: null,
      },
    ]);

    const result = await embedCandidatesBatch({ limit: 10 });

    expect(result.skipped).toBe(1);
    expect(result.embedded).toBe(1);
    expect(result.errors).toEqual([]);
    expect(mockEmbedMany).toHaveBeenCalledOnce();
    expect(mockWhere).toHaveBeenCalled();
    // Already-embedded candidates never appear in the select (isNull filter).
    const whereArg = mockWhere.mock.calls[0]?.[0] as { type: string; args: unknown[] };
    expect(whereArg.type).toBe("and");
    expect(JSON.stringify(whereArg)).toContain("isNull");
  });
});
