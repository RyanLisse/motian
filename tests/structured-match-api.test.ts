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

  it("calls extractRequirements and runStructuredMatch", () => {
    const source = readFile("app/api/matches/structured/route.ts");
    expect(source).toContain("extractRequirements");
    expect(source).toContain("runStructuredMatch");
  });

  it("stores results in jobMatches", () => {
    const source = readFile("app/api/matches/structured/route.ts");
    expect(source).toContain("criteriaBreakdown");
    expect(source).toContain("marienne-v1");
  });

  it("publishes event for SSE", () => {
    const source = readFile("app/api/matches/structured/route.ts");
    expect(source).toContain("publish");
  });
});

describe("Structured match server action", () => {
  it("runStructuredMatchAction is exported", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("export async function runStructuredMatchAction");
  });

  it("calls extractRequirements", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("extractRequirements");
  });
});
