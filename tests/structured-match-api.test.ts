import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Structured match API route", () => {
  it("route.ts exports POST handler", () => {
    const source = readFile("app/api/matches/structured/route.ts");
    expect(source).toContain("export async function POST");
  });

  it("validates input with Zod", () => {
    const source = readFile("app/api/matches/structured/route.ts");
    expect(source).toContain("z.string().uuid()");
  });

  it("delegates the structured workflow to the shared review service", () => {
    const source = readFile("app/api/matches/structured/route.ts");
    expect(source).toContain("runStructuredMatchReview");
    expect(source).toContain("revalidateStructuredMatchViews");
  });

  it("preserves the API success response shape", () => {
    const source = readFile("app/api/matches/structured/route.ts");
    expect(source).toContain('message: "Gestructureerde beoordeling voltooid"');
    expect(source).toContain("result: outcome.result");
  });

  it("publishes event for SSE", () => {
    const source = readFile("app/api/matches/structured/route.ts");
    expect(source).toContain("publish");
  });
});

describe("Structured match server action", () => {
  it("runStructuredMatchAction is exported from shared match-review action", () => {
    const source = readFile("src/actions/match-review.ts");
    expect(source).toContain("export async function runStructuredMatchAction");
  });

  it("delegates the structured workflow to the shared review service", () => {
    const source = readFile("src/actions/match-review.ts");
    expect(source).toContain("runStructuredMatchReview(jobId, candidateId)");
    expect(source).toContain(
      "revalidateStructuredMatchViews(jobId, candidateId, { includePipeline: true })",
    );
  });

  it("preserves the server action result contract", () => {
    const source = readFile("src/actions/match-review.ts");
    expect(source).toContain("Promise<{ success: boolean; error?: string }>");
    expect(source).toContain("return { success: true }");
  });
});
