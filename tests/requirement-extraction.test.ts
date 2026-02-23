import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Requirement extraction service", () => {
  it("exports extractRequirements function", () => {
    const source = readFile("src/services/requirement-extraction.ts");
    expect(source).toContain("export async function extractRequirements");
  });

  it("uses Gemini 3.1 Pro model", () => {
    const source = readFile("src/services/requirement-extraction.ts");
    expect(source).toContain("gemini-3.1-pro");
  });

  it("uses generateObject with classifiedRequirementSchema", () => {
    const source = readFile("src/services/requirement-extraction.ts");
    expect(source).toContain("generateObject");
    expect(source).toContain("classifiedRequirementSchema");
  });

  it("uses withRetry for resilience", () => {
    const source = readFile("src/services/requirement-extraction.ts");
    expect(source).toContain("withRetry");
  });

  it("contains tier classification system prompt in Dutch", () => {
    const source = readFile("src/services/requirement-extraction.ts");
    expect(source).toContain("KNOCKOUT");
    expect(source).toContain("GUNNING");
    expect(source).toContain("PROCESS");
  });
});
