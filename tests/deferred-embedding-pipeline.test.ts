import { beforeEach, describe, expect, it, vi } from "vitest";

const {
  mockTrigger,
  mockRunDeferredEmbeddingSync,
  mockRevalidatePath,
  mockRevalidateTag,
  mockLoggerInfo,
  mockLoggerError,
  mockMetadata,
} = vi.hoisted(() => {
  const mockMetadata = {
    set: vi.fn(),
  };
  mockMetadata.set.mockReturnValue(mockMetadata);

  return {
    mockTrigger: vi.fn().mockResolvedValue({ id: "queued-run-1" }),
    mockRunDeferredEmbeddingSync: vi.fn(),
    mockRevalidatePath: vi.fn(),
    mockRevalidateTag: vi.fn(),
    mockLoggerInfo: vi.fn(),
    mockLoggerError: vi.fn(),
    mockMetadata,
  };
});

vi.mock("@trigger.dev/sdk", () => ({
  tasks: { trigger: mockTrigger },
  task: <T extends Record<string, unknown>>(config: T) => config,
  logger: {
    info: mockLoggerInfo,
    error: mockLoggerError,
  },
  metadata: mockMetadata,
}));

vi.mock("next/cache", () => ({
  revalidatePath: mockRevalidatePath,
  revalidateTag: mockRevalidateTag,
}));

vi.mock("../src/services/embedding", () => ({
  runDeferredEmbeddingSync: mockRunDeferredEmbeddingSync,
}));

import { queueDeferredEmbeddingSync } from "../src/lib/event-bus";
import { deferEmbeddingSyncTask } from "../trigger/defer-embedding-sync";

describe("deferred embedding pipeline", () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockMetadata.set.mockReturnValue(mockMetadata);
    mockTrigger.mockResolvedValue({ id: "queued-run-1" });
  });

  it("queues the background embedding task through Trigger.dev", async () => {
    await queueDeferredEmbeddingSync({
      entityType: "candidate",
      entityId: "cand-123",
      source: "candidate:create",
    });

    expect(mockTrigger).toHaveBeenCalledWith("defer-embedding-sync", {
      entityType: "candidate",
      entityId: "cand-123",
      source: "candidate:create",
    });
  });

  it("swallows queue failures so the primary mutation can still return", async () => {
    mockTrigger.mockRejectedValueOnce(new Error("trigger offline"));

    await expect(
      queueDeferredEmbeddingSync({
        entityType: "job",
        entityId: "job-456",
        source: "job:update",
      }),
    ).resolves.toBeUndefined();
  });

  it("revalidates candidate surfaces after a successful deferred sync", async () => {
    mockRunDeferredEmbeddingSync.mockResolvedValueOnce({
      entityType: "candidate",
      entityId: "cand-123",
      source: "candidate:create",
      embedded: true,
      indexed: false,
      embeddingStatus: "ready",
    });

    const result = await deferEmbeddingSyncTask.run(
      {
        entityType: "candidate",
        entityId: "cand-123",
        source: "candidate:create",
      },
      { ctx: { run: { id: "task-run-1" } } },
    );

    expect(mockRunDeferredEmbeddingSync).toHaveBeenCalledWith({
      entityType: "candidate",
      entityId: "cand-123",
      source: "candidate:create",
    });
    expect(mockRevalidateTag).toHaveBeenCalledWith("candidates", "default");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/kandidaten");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/kandidaten/cand-123");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/overzicht");
    expect(result).toMatchObject({
      entityType: "candidate",
      entityId: "cand-123",
      embeddingStatus: "ready",
    });
  });

  it("revalidates vacancy surfaces after a successful deferred sync", async () => {
    mockRunDeferredEmbeddingSync.mockResolvedValueOnce({
      entityType: "job",
      entityId: "job-456",
      source: "job:update",
      embedded: true,
      indexed: false,
      embeddingStatus: "ready",
    });

    await deferEmbeddingSyncTask.run(
      {
        entityType: "job",
        entityId: "job-456",
        source: "job:update",
      },
      { ctx: { run: { id: "task-run-2" } } },
    );

    expect(mockRevalidateTag).toHaveBeenCalledWith("jobs", "default");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/vacatures");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/vacatures/job-456");
    expect(mockRevalidatePath).toHaveBeenCalledWith("/overzicht");
  });
});
