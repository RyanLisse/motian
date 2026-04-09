import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";

const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]) {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

describe("vacature recruiter insights lane", () => {
  it("vacature detail page derives triage insights from the shared recruiter insights service", () => {
    const source = readFile("app/vacatures/[id]/page.tsx");
    expect(source).toContain("buildVacatureTriageScorecard");
    expect(source).toContain("VacatureTriageScorecard");
  });

  it("overview data computes pipeline health from persisted aggregate signals", () => {
    const source = readFile("app/overzicht/data.ts");
    expect(source).toContain("buildPipelineHealthSnapshot");
    expect(source).toContain("jobs.descriptionSummary");
    expect(source).toContain("jobs.embedding");
    expect(source).toContain("candidates.embedding");
    expect(source).toContain("jobMatches.criteriaBreakdown");
  });

  it("overview page renders the pipeline health card", () => {
    const source = readFile("app/overzicht/page.tsx");
    expect(source).toContain("PipelineHealthCard");
    expect(source).toContain("pipelineHealth");
    expect(source).toContain("health={pipelineHealth}");
    expect(source).not.toContain("snapshot={pipelineHealth}");
  });
});
