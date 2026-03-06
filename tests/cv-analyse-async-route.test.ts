import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("CV analyse async flow", () => {
  it("supports async mode via query flag and Trigger task", () => {
    const source = readFile("app/api/cv-analyse/route.ts");

    expect(source).toContain('searchParams.get("async") === "1"');
    expect(source).toContain("tasks.trigger<typeof cvAnalysisPipelineTask>");
    expect(source).toContain("cv-analysis-pipeline");
    expect(source).toContain("statusUrl: `/api/cv-analyse/status/");
    expect(source).toContain("handle.id");
  });

  it("exposes a status endpoint backed by Trigger runs", () => {
    const source = readFile("app/api/cv-analyse/status/[runId]/route.ts");

    expect(source).toContain("runs.retrieve(runId)");
    expect(source).toContain("export async function GET");
  });

  it("centralizes pipeline logic in a shared service", () => {
    const source = readFile("src/services/cv-analysis-pipeline.ts");

    expect(source).toContain("export async function processStoredCV");
    expect(source).toContain("downloadFile(fileUrl)");
    expect(source).toContain("autoMatchCandidateToJobs");
  });
});
