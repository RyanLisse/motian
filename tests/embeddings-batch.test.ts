import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("embeddings batch backfill", () => {
  it("selects all jobs without embeddings via the visible vacancy condition", () => {
    const source = readFile("trigger/embeddings-batch.ts");

    expect(source).toContain("getVisibleVacancyCondition()");
    expect(source).toContain("isNull(jobs.embedding)");
  });

  it("serializes job embeddings before updating the database", () => {
    const source = readFile("src/services/embedding.ts");

    expect(source).toContain("embeddings[i].join");
    expect(source).not.toContain("JSON.stringify(embeddings[i])");
  });
});
