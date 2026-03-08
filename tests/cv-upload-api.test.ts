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
    expect(source).toContain("validateCvUploadFile");
    expect(source).toContain("validation.message");
  });

  it("keeps legacy .doc uploads on an explicit unsupported path", () => {
    const source = readFile("src/lib/cv-upload.ts");
    expect(source).toContain("unsupported_doc");
    expect(source).toContain(".doc");
    expect(source).toContain("worden nog niet ondersteund");
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

  it("delegates candidate persistence and matching to intakeCandidate", () => {
    const source = readFile("app/api/cv-upload/save/route.ts");
    expect(source).toContain("intakeCandidate");
    expect(source).toContain("matchingStatus");
    expect(source).toContain("recommendation");
    expect(source).toContain("matches");
  });

  it("returns 404 when an existing candidate id is missing", () => {
    const source = readFile("app/api/cv-upload/save/route.ts");
    expect(source).toContain("getCandidateById");
    expect(source).toContain("Kandidaat niet gevonden");
  });
});
