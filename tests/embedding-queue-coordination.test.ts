import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("embedding producer queue coordination", () => {
  it("defines a shared queue with the existing concurrency budget", () => {
    const source = readFile("trigger", "queues.ts");

    expect(source).toContain('EMBEDDING_PRODUCER_QUEUE_NAME = "embedding-producers"');
    expect(source).toContain("EMBEDDING_PRODUCER_CONCURRENCY_LIMIT = 2");
    expect(source).toContain("queue({");
  });

  it("routes ai enrichment through the shared queue", () => {
    const source = readFile("trigger", "ai-enrichment-batch.ts");

    expect(source).toContain('import { embeddingProducerQueue } from "./queues"');
    expect(source).toContain("queue: embeddingProducerQueue");
  });

  it("routes deferred sync through the shared queue", () => {
    const source = readFile("trigger", "defer-embedding-sync.ts");

    expect(source).toContain('import { embeddingProducerQueue } from "./queues"');
    expect(source).toContain("queue: embeddingProducerQueue");
  });
});
