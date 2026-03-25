import { beforeEach, describe, expect, it, vi } from "vitest";

// ---------------------------------------------------------------------------
// Hoisted mocks
// ---------------------------------------------------------------------------

const { mockGenerateText, mockDb, mockWithRetry, mockEmbedJob } = vi.hoisted(() => {
  const mockSelectChain = {
    from: vi.fn(),
    where: vi.fn(),
    limit: vi.fn(),
  };
  mockSelectChain.from.mockReturnValue(mockSelectChain);
  mockSelectChain.where.mockReturnValue(mockSelectChain);
  mockSelectChain.limit.mockResolvedValue([]);

  const mockUpdateChain = {
    set: vi.fn(),
    where: vi.fn(),
  };
  mockUpdateChain.set.mockReturnValue(mockUpdateChain);
  mockUpdateChain.where.mockResolvedValue(undefined);

  return {
    mockGenerateText: vi.fn(),
    mockDb: {
      select: vi.fn().mockReturnValue(mockSelectChain),
      update: vi.fn().mockReturnValue(mockUpdateChain),
      _selectChain: mockSelectChain,
      _updateChain: mockUpdateChain,
    },
    mockWithRetry: vi.fn(),
    mockEmbedJob: vi.fn(),
  };
});

// ---------------------------------------------------------------------------
// Module mocks
// ---------------------------------------------------------------------------

vi.mock("../src/lib/ai-models", () => ({
  geminiFlashLite: "mock-model",
  tracedGenerateText: mockGenerateText,
}));

vi.mock("../src/lib/retry", () => ({
  withRetry: mockWithRetry,
}));

vi.mock("../src/db", () => ({
  db: mockDb,
  eq: vi.fn((...args: unknown[]) => ({ _type: "eq", args })),
  and: vi.fn((...args: unknown[]) => ({ _type: "and", args })),
  isNull: vi.fn((col: unknown) => ({ _type: "isNull", col })),
}));

vi.mock("../src/db/schema", () => ({
  jobs: {
    id: "jobs.id",
    title: "jobs.title",
    description: "jobs.description",
    descriptionSummary: "jobs.descriptionSummary",
    educationLevel: "jobs.educationLevel",
    workExperienceYears: "jobs.workExperienceYears",
    workArrangement: "jobs.workArrangement",
    languages: "jobs.languages",
    durationMonths: "jobs.durationMonths",
    extensionPossible: "jobs.extensionPossible",
    categories: "jobs.categories",
    conditions: "jobs.conditions",
    requirements: "jobs.requirements",
    platform: "jobs.platform",
  },
}));

vi.mock("../src/services/jobs/filters", () => ({
  getVisibleVacancyCondition: vi.fn(() => "visible-condition"),
}));

vi.mock("../src/services/embedding", () => ({
  embedJob: mockEmbedJob,
}));

// ---------------------------------------------------------------------------
// Import SUT after all mocks are registered
// ---------------------------------------------------------------------------

import { enrichJobsBatch, enrichJobWithAI } from "../src/services/ai-enrichment";

// ---------------------------------------------------------------------------
// Helpers
// ---------------------------------------------------------------------------

/** Creates a job row matching the fields selected in enrichJobsBatch */
function makeDbRow(overrides: Record<string, unknown> = {}) {
  return {
    id: "job-1",
    title: "Senior Developer",
    description:
      "This is a long enough description that exceeds fifty characters for sure and should be valid input for enrichment",
    conditions: null,
    requirements: null,
    educationLevel: null,
    workExperienceYears: null,
    workArrangement: null,
    languages: null,
    durationMonths: null,
    extensionPossible: null,
    categories: null,
    ...overrides,
  };
}

const sampleEnrichmentOutput = {
  educationLevel: "HBO",
  workExperienceYears: 5,
  workArrangement: "hybride",
  languages: ["NL", "EN"],
  durationMonths: 12,
  extensionPossible: true,
  descriptionSummary: { nl: "Een senior ontwikkelaar rol.", en: "A senior developer role." },
  categories: ["ICT"],
};

// ---------------------------------------------------------------------------
// Tests — enrichJobWithAI
// ---------------------------------------------------------------------------

describe("enrichJobWithAI", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithRetry.mockImplementation((fn: () => unknown) => fn());
  });

  it("returns null when description is null", async () => {
    const result = await enrichJobWithAI({
      title: "Test",
      description: null,
    });
    expect(result).toBeNull();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("returns null when description is shorter than 50 characters", async () => {
    const result = await enrichJobWithAI({
      title: "Test",
      description: "Too short",
    });
    expect(result).toBeNull();
    expect(mockGenerateText).not.toHaveBeenCalled();
  });

  it("calls generateText with correct model, schema, system, and prompt", async () => {
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    await enrichJobWithAI({
      title: "Senior Developer",
      description:
        "This is a long enough description that exceeds fifty characters for sure and should be valid",
    });

    expect(mockGenerateText).toHaveBeenCalledTimes(1);
    const callArgs = mockGenerateText.mock.calls[0][0];

    expect(callArgs.model).toBe("mock-model");
    expect(callArgs.output).toBeDefined();
    expect(callArgs.system).toContain("recruitment");
    expect(callArgs.prompt).toContain("Senior Developer");
    expect(callArgs.prompt).toContain("exceeds fifty characters");
  });

  it("includes conditions and requirements in prompt when present as arrays", async () => {
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    await enrichJobWithAI({
      title: "Developer",
      description:
        "This is a long enough description that exceeds fifty characters for sure and should be valid",
      conditions: ["Flexible hours", "Remote possible"],
      requirements: ["5+ years TypeScript", "HBO diploma"],
    });

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.prompt).toContain("Flexible hours");
    expect(callArgs.prompt).toContain("5+ years TypeScript");
  });

  it("does NOT include conditions/requirements when they are not arrays", async () => {
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    await enrichJobWithAI({
      title: "Developer",
      description:
        "This is a long enough description that exceeds fifty characters for sure and should be valid",
      conditions: "not an array",
      requirements: "also not an array",
    });

    const callArgs = mockGenerateText.mock.calls[0][0];
    expect(callArgs.prompt).not.toContain("Voorwaarden");
    expect(callArgs.prompt).not.toContain("Eisen");
  });

  it("returns the output from generateText", async () => {
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    const result = await enrichJobWithAI({
      title: "Test",
      description:
        "This is a long enough description that exceeds fifty characters for sure and should be valid",
    });
    expect(result).toEqual(sampleEnrichmentOutput);
  });

  it("wraps the generateText call with withRetry", async () => {
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    await enrichJobWithAI({
      title: "Test",
      description:
        "This is a long enough description that exceeds fifty characters for sure and should be valid",
    });

    expect(mockWithRetry).toHaveBeenCalledTimes(1);
    expect(typeof mockWithRetry.mock.calls[0][0]).toBe("function");
    expect(mockWithRetry.mock.calls[0][1]).toEqual(
      expect.objectContaining({ label: "AI Enrichment" }),
    );
  });
});

// ---------------------------------------------------------------------------
// Tests — enrichJobsBatch
// ---------------------------------------------------------------------------

describe("enrichJobsBatch", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockWithRetry.mockImplementation((fn: () => unknown) => fn());
    mockEmbedJob.mockResolvedValue(undefined);
  });

  function setupDbSelect(rows: Record<string, unknown>[]) {
    const chain = mockDb._selectChain;
    chain.from.mockReturnValue(chain);
    chain.where.mockReturnValue(chain);
    chain.limit.mockResolvedValue(rows);
    mockDb.select.mockReturnValue(chain);
  }

  it("returns zero counts when no unenriched jobs are found", async () => {
    setupDbSelect([]);

    const result = await enrichJobsBatch({});

    expect(result).toEqual({ enriched: 0, skipped: 0, errors: [] });
  });

  it("enriches a job and writes only null fields", async () => {
    const row = makeDbRow();
    setupDbSelect([row]);
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    const result = await enrichJobsBatch({});

    expect(result.enriched).toBe(1);
    expect(result.errors).toEqual([]);
    expect(mockDb.update).toHaveBeenCalled();

    const setArg = mockDb._updateChain.set.mock.calls[0][0];
    // descriptionSummary is always written (it's the "enriched" marker)
    expect(setArg).toHaveProperty("descriptionSummary");
    expect(setArg).toHaveProperty("educationLevel");
    expect(setArg).toHaveProperty("workArrangement");
  });

  it("never overwrites existing scraper data", async () => {
    const row = makeDbRow({
      educationLevel: "WO",
      workExperienceYears: 10,
      workArrangement: null,
      languages: ["NL"],
      durationMonths: null,
      extensionPossible: true,
      categories: ["ICT", "Finance"],
    });
    setupDbSelect([row]);
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    await enrichJobsBatch({});

    expect(mockDb.update).toHaveBeenCalled();
    const setArg = mockDb._updateChain.set.mock.calls[0][0];

    // Fields already set should NOT be overwritten
    expect(setArg).not.toHaveProperty("educationLevel");
    expect(setArg).not.toHaveProperty("workExperienceYears");
    expect(setArg).not.toHaveProperty("extensionPossible");
    // languages had content, should NOT be overwritten
    expect(setArg).not.toHaveProperty("languages");
    // categories had content, should NOT be overwritten
    expect(setArg).not.toHaveProperty("categories");

    // Null fields SHOULD be written
    expect(setArg).toHaveProperty("workArrangement");
    expect(setArg).toHaveProperty("durationMonths");
    // descriptionSummary is always written
    expect(setArg).toHaveProperty("descriptionSummary");
  });

  it("skips jobs where enrichJobWithAI returns null", async () => {
    const rows = [
      makeDbRow({ id: "job-1", description: null }),
      makeDbRow({ id: "job-2", description: "Short" }),
      makeDbRow({ id: "job-3" }),
    ];
    setupDbSelect(rows);
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    const result = await enrichJobsBatch({});

    // job-1 and job-2 skip (null / <50 chars), job-3 enriches
    expect(result.skipped).toBe(2);
    expect(result.enriched).toBe(1);
  });

  it("counts errors as array entries and continues processing", async () => {
    const rows = [makeDbRow({ id: "job-1" }), makeDbRow({ id: "job-2" })];
    setupDbSelect(rows);

    mockWithRetry
      .mockRejectedValueOnce(new Error("AI model timeout"))
      .mockImplementationOnce((fn: () => unknown) => fn());
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    const result = await enrichJobsBatch({});

    expect(result.errors).toHaveLength(1);
    expect(result.errors[0]).toContain("job-1");
    expect(result.enriched).toBe(1);
  });

  it("calls embedJob for enriched jobs in chunks", async () => {
    const row = makeDbRow();
    setupDbSelect([row]);
    mockGenerateText.mockResolvedValue({ output: sampleEnrichmentOutput });

    await enrichJobsBatch({});

    expect(mockEmbedJob).toHaveBeenCalledTimes(1);
  });

  it("respects limit parameter", async () => {
    setupDbSelect([]);

    await enrichJobsBatch({ limit: 50 });

    const chain = mockDb._selectChain;
    expect(chain.limit).toHaveBeenCalledWith(50);
  });

  it("caps limit at 200 when a higher value is passed", async () => {
    setupDbSelect([]);

    await enrichJobsBatch({ limit: 500 });

    const chain = mockDb._selectChain;
    expect(chain.limit).toHaveBeenCalledWith(200);
  });
});
