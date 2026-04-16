import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("embeddings batch backfill", () => {
  it("selects all jobs without embeddings for backfill", () => {
    const source = readFile("trigger/embeddings-batch.ts");

    // embedJob() now falls back to title + categories + requirements,
    // so the batch task picks up ALL jobs without embeddings.
    expect(source).toContain("isNull(jobs.embedding)");
    expect(source).toContain("getVisibleVacancyCondition()");
  });

  it("caps concurrent task instances while preserving the per-run worker pool", () => {
    const source = readFile("trigger/embeddings-batch.ts");

    expect(source).toContain("queue: {");
    expect(source).toContain("concurrencyLimit: 2");
    expect(source).toContain("const EMBEDDING_CONCURRENCY = 5");
  });

  it("serializes job embeddings before updating the database", () => {
    const source = readFile("src/services/embedding.ts");

    expect(source).toContain("embeddings[i].join");
    expect(source).not.toContain("JSON.stringify(embeddings[i])");
  });
});
