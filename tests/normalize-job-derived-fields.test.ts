import { beforeEach, describe, expect, it, vi } from "vitest";
import { unifiedJobSchema } from "../src/schemas/job";

const {
  mockDb,
  mockInsert,
  mockOnConflictDoUpdate,
  mockReturning,
  mockValues,
  mockIsEscoCatalogAvailable,
  mockSyncJobEscoSkills,
} = vi.hoisted(() => {
  const mockReturning = vi.fn();
  const mockOnConflictDoUpdate = vi.fn();
  const mockValues = vi.fn();
  const mockInsert = vi.fn();

  mockValues.mockImplementation(() => ({ onConflictDoUpdate: mockOnConflictDoUpdate }));
  mockOnConflictDoUpdate.mockImplementation(() => ({ returning: mockReturning }));
  mockInsert.mockImplementation(() => ({ values: mockValues }));

  return {
    mockDb: { insert: mockInsert },
    mockInsert,
    mockOnConflictDoUpdate,
    mockReturning,
    mockIsEscoCatalogAvailable: vi.fn().mockResolvedValue(true),
    mockSyncJobEscoSkills: vi.fn(),
    mockValues,
  };
});

vi.mock("../src/db", async (importOriginal) => ({
  ...(await importOriginal()),
  db: mockDb,
}));
vi.mock("@motian/esco", () => ({
  isEscoCatalogAvailable: mockIsEscoCatalogAvailable,
  syncJobEscoSkills: mockSyncJobEscoSkills,
}));

import {
  chunkJobInsertBatches,
  deriveJobSearchFields,
  normalizeAndSaveJobs,
} from "../src/services/normalize";

describe("normalizeAndSaveJobs derived fields", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockIsEscoCatalogAvailable.mockResolvedValue(true);
    mockReturning.mockResolvedValue([{ id: "job-1", externalId: "derived-1", isNew: true }]);
    mockSyncJobEscoSkills.mockResolvedValue(undefined);
  });

  it("derives normalized dedupe fields and search text from vacature content", () => {
    expect(
      deriveJobSearchFields({
        title: "  Senior React Developer!! ",
        company: "Between BV",
        endClient: "Gemeente Utrecht",
        location: "Utrecht Centrum",
        province: "Utrecht",
        description: " Bouw moderne portals. ",
      }),
    ).toEqual({
      dedupeTitleNormalized: "senior react developer",
      dedupeClientNormalized: "gemeente utrecht",
      dedupeLocationNormalized: "utrecht",
      searchText:
        "Senior React Developer!! Between BV Bouw moderne portals. Utrecht Centrum Utrecht",
    });
  });

  it("writes derived fields on insert values and upsert updates", async () => {
    const listing = {
      title: "Lead Data Engineer / Platform",
      company: "Motian Partners",
      location: "Amsterdam",
      description: "Een langdurige opdracht voor data platform modernisatie bij enterprise scale.",
      externalId: "derived-1",
      externalUrl: "https://example.com/jobs/derived-1",
      requirements: [],
      wishes: [],
      competences: [],
      conditions: [],
    };

    const result = await normalizeAndSaveJobs("opdrachtoverheid", [listing]);

    expect(result.errors).toEqual([]);
    expect(mockInsert).toHaveBeenCalledTimes(1);
    const insertedValues = mockValues.mock.calls[0]?.[0];
    expect(insertedValues?.[0]).toMatchObject({
      dedupeTitleNormalized: "lead data engineer platform",
      dedupeClientNormalized: "motian partners",
      dedupeLocationNormalized: "amsterdam",
      searchText:
        "Lead Data Engineer / Platform Motian Partners Een langdurige opdracht voor data platform modernisatie bij enterprise scale. Amsterdam",
    });

    const conflictConfig = mockOnConflictDoUpdate.mock.calls[0]?.[0];
    expect(conflictConfig.set).toHaveProperty("dedupeTitleNormalized");
    expect(conflictConfig.set).toHaveProperty("dedupeClientNormalized");
    expect(conflictConfig.set).toHaveProperty("dedupeLocationNormalized");
    expect(conflictConfig.set).toHaveProperty("searchText");
  });
});

describe("chunkJobInsertBatches", () => {
  it("splits on the configured row limit", () => {
    const validItems = [
      {
        parsed: unifiedJobSchema.parse({
          title: "A",
          externalId: "a",
          externalUrl: "https://example.com/a",
          description: "Een valide vacaturebeschrijving voor A.",
        }),
        raw: { id: "a" },
      },
      {
        parsed: unifiedJobSchema.parse({
          title: "B",
          externalId: "b",
          externalUrl: "https://example.com/b",
          description: "Een valide vacaturebeschrijving voor B.",
        }),
        raw: { id: "b" },
      },
      {
        parsed: unifiedJobSchema.parse({
          title: "C",
          externalId: "c",
          externalUrl: "https://example.com/c",
          description: "Een valide vacaturebeschrijving voor C.",
        }),
        raw: { id: "c" },
      },
    ];

    const batches = chunkJobInsertBatches(validItems, "striive", {
      maxRows: 2,
      maxBytes: 1_000_000,
    });

    expect(batches).toHaveLength(2);
    expect(batches[0].items).toHaveLength(2);
    expect(batches[1].items).toHaveLength(1);
  });

  it("splits on the configured byte budget", () => {
    const oversizedPayload = "x".repeat(200);
    const validItems = [
      {
        parsed: unifiedJobSchema.parse({
          title: "Oversized A",
          externalId: "oa",
          externalUrl: "https://example.com/oa",
          description: "Een valide vacaturebeschrijving voor oversized A.",
        }),
        raw: { blob: oversizedPayload },
      },
      {
        parsed: unifiedJobSchema.parse({
          title: "Oversized B",
          externalId: "ob",
          externalUrl: "https://example.com/ob",
          description: "Een valide vacaturebeschrijving voor oversized B.",
        }),
        raw: { blob: oversizedPayload },
      },
    ];

    const batches = chunkJobInsertBatches(validItems, "striive", {
      maxRows: 50,
      maxBytes: 250,
    });

    expect(batches).toHaveLength(2);
    expect(batches[0].items).toHaveLength(1);
    expect(batches[1].items).toHaveLength(1);
  });
});
