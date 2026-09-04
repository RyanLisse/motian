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
    const routeSource = readFile("app/api/cv-upload/route.ts");
    const libSource = readFile("src/lib/cv-upload.ts");
    expect(routeSource).toContain("validateCvUploadBuffer");
    expect(routeSource).toContain("validation.mimeType");
    expect(libSource).toContain("application/pdf");
    expect(libSource).toContain("wordprocessingml.document");
  });

  it("validates file size", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("validateCvUploadBuffer");
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

  it("validates file content before uploading to blob storage", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    // Match the call sites (trailing "(") rather than bare identifiers so this
    // assertion is not satisfied by import statement order alone.
    expect(source.indexOf("validateCvUploadBuffer(")).toBeLessThan(source.indexOf("uploadFile("));
  });

  it("validates file metadata before reading the upload into memory", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source.indexOf("validateCvUploadFile(")).toBeLessThan(source.indexOf("arrayBuffer("));
  });

  it("calls parseCV for AI extraction", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("parseCV");
  });

  it("checks for duplicate candidates", () => {
    const source = readFile("app/api/cv-upload/route.ts");
    expect(source).toContain("findDuplicateCandidate");
  });

  it("returns a fixed Dutch R9 message without interpolating exception text", () => {
    const routeSource = readFile("app/api/cv-upload/route.ts");
    const helpersSource = readFile("app/api/_shared/cv-helpers.ts");
    expect(helpersSource).toContain("CV_PROCESSING_FAILED_MESSAGE");
    expect(helpersSource).toContain(
      "CV verwerking mislukt. Probeer het opnieuw of neem contact op met support.",
    );
    expect(routeSource).toContain("CV_PROCESSING_FAILED_MESSAGE");
    expect(routeSource).not.toMatch(/CV verwerking mislukt: \$\{/);
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
