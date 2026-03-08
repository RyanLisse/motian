import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");
function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("Report API route", () => {
  it("route.ts exports POST handler", () => {
    const source = readFile("app/api/reports/route.ts");
    expect(source).toContain("export async function POST");
  });

  it("route.ts exports GET handler", () => {
    const source = readFile("app/api/reports/route.ts");
    expect(source).toContain("export async function GET");
  });

  it("route.ts imports generateReport", () => {
    const source = readFile("app/api/reports/route.ts");
    expect(source).toContain("generateReport");
  });

  it("route.ts imports publishReport from markdown-fast", () => {
    const source = readFile("app/api/reports/route.ts");
    expect(source).toContain("publishReport");
  });

  it("route.ts validates matchId input", () => {
    const source = readFile("app/api/reports/route.ts");
    expect(source).toContain("matchId");
  });
});

describe("Report view page", () => {
  it("reports/[id]/page.tsx exists", () => {
    const source = readFile("app/reports/[id]/page.tsx");
    expect(source).toBeDefined();
  });

  it("reports/[id]/page.tsx contains Beoordelingsrapport", () => {
    const source = readFile("app/reports/[id]/page.tsx");
    expect(source).toContain("Beoordelingsrapport");
  });

  it("reports/[id]/page.tsx uses getReport", () => {
    const source = readFile("app/reports/[id]/page.tsx");
    expect(source).toContain("getReport");
  });
});

describe("Report button component", () => {
  it("report-button.tsx exports ReportButton", () => {
    const source = readFile("components/matching/report-button.tsx");
    expect(source).toContain("export function ReportButton");
  });

  it("report-button.tsx calls /api/reports", () => {
    const source = readFile("components/matching/report-button.tsx");
    expect(source).toContain("/api/reports");
  });

  it("report-button.tsx is a client component", () => {
    const source = readFile("components/matching/report-button.tsx");
    expect(source).toContain('"use client"');
  });
});

describe("Legacy matching route redirect", () => {
  it("redirects job-scoped grading requests into the vacature detail flow", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain('import { redirect } from "next/navigation"');
    expect(source).toContain('tab === "grading"');
    expect(source).toContain("#ai-grading");
  });

  it("redirects non-job requests to professionals instead of rendering a standalone page", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("#recruiter-cockpit");
    expect(source).toContain('redirect("/professionals")');
  });
});
