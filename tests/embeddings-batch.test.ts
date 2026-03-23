import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("embeddings batch backfill", () => {
  it("only selects jobs with a summary or non-empty description", () => {
    const source = readFile("trigger/embeddings-batch.ts");

    expect(source).toContain("isNotNull(jobs.descriptionSummary)");
    expect(source).toContain("nullif(trim(");
  });

  it("serializes job embeddings before updating the database", () => {
    const source = readFile("src/services/embedding.ts");

    expect(source).toContain("db.update(jobs).set({ embedding: JSON.stringify(embeddings[i]) })");
  });
});
