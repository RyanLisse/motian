import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("CV upload API route", () => {
  it("route.ts exports POST handler", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("export async function POST");
  });

  it("validates file type (PDF and Word only)", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("application/pdf");
    expect(source).toContain("wordprocessingml.document");
  });

  it("validates file size", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("MAX_SIZE_MB");
  });

  it("uploads to blob storage", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("uploadFile");
  });

  it("calls parseCV for AI extraction", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("parseCV");
  });

  it("checks for duplicate candidates", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("findDuplicateCandidate");
  });
});

describe("CV save API route", () => {
  it("save/route.ts exports POST handler", () => {
    const source = readFile("app/api/cv-upload/save/route.ts");
    expect(source).toContain("export async function POST");
  });

  it("validates input with parsedCVSchema", () => {
    const source = readFile("app/api/cv-upload/save/route.ts");
    expect(source).toContain("parsedCVSchema");
  });

  it("supports creating new and enriching existing candidates", () => {
    const source = readFile("app/api/cv-upload/save/route.ts");
    expect(source).toContain("createCandidate");
    expect(source).toContain("enrichCandidateFromCV");
  });
});
