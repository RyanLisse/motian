import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// ── Schema imports ───────────────────────────────────────────────
import { jobMatches } from "../src/db/schema.js";
// ── Service imports (no Next.js dependency) ─────────────────────
import {
  createMatch,
  getMatchByJobAndCandidate,
  getMatchesForJob,
  listMatches,
  updateMatchStatus,
} from "../src/services/matches.js";

// ── Helpers ──────────────────────────────────────────────────────
const ROOT = path.resolve(__dirname, "..");

function readFile(...segments: string[]): string {
  return fs.readFileSync(path.join(ROOT, ...segments), "utf-8");
}

// ── Tests ────────────────────────────────────────────────────────

describe("Matching linking flow — service exports compile", () => {
  it("getMatchByJobAndCandidate is exported as a function", () => {
    expect(typeof getMatchByJobAndCandidate).toBe("function");
  });

  it("createMatch is exported as a function", () => {
    expect(typeof createMatch).toBe("function");
  });

  it("updateMatchStatus is exported as a function", () => {
    expect(typeof updateMatchStatus).toBe("function");
  });

  it("getMatchesForJob is exported as a function", () => {
    expect(typeof getMatchesForJob).toBe("function");
  });

  it("listMatches is exported as a function", () => {
    expect(typeof listMatches).toBe("function");
  });
});

describe("Matching linking flow — schema structure", () => {
  it("jobMatches table has expected column names", () => {
    const columnNames = Object.keys(jobMatches);
    expect(columnNames).toContain("jobId");
    expect(columnNames).toContain("candidateId");
    expect(columnNames).toContain("status");
    expect(columnNames).toContain("matchScore");
    expect(columnNames).toContain("reviewedBy");
    expect(columnNames).toContain("reviewedAt");
  });
});

describe("Matching linking flow — structural assertions", () => {
  it("actions.ts exports linkCandidateToJob", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("export async function linkCandidateToJob");
  });

  it("linkCandidateToJob handles existing match (approve path)", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("getMatchByJobAndCandidate");
    expect(source).toContain('status: "approved"');
  });

  it("linkCandidateToJob handles new match (atomic insert as approved)", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("db.insert(jobMatches)");
    expect(source).toContain('"Handmatige koppeling"');
    // Verify the insert includes status: "approved" directly — no intermediate pending state
    expect(source).toContain('status: "approved"');
  });

  it("linkCandidateToJob handles unique constraint race condition", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("uq_job_matches_job_candidate");
  });

  it("candidate-linker.tsx exports CandidateLinker component", () => {
    const source = readFile("app/matching/candidate-linker.tsx");
    expect(source).toContain("export function CandidateLinker");
  });

  it("candidate-linker.tsx calls linkCandidateToJob", () => {
    const source = readFile("app/matching/candidate-linker.tsx");
    expect(source).toContain("linkCandidateToJob");
  });

  it("matching page reads jobId from searchParams", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("jobId");
    expect(source).toContain("params.jobId");
  });

  it("matching page includes CandidateLinker import", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain('import { CandidateLinker } from "./candidate-linker"');
  });

  it("matching page preserves jobId in filter hrefs via buildQs", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("buildQs");
    expect(source).toContain("jobId");
  });

  it("matching page is candidate-centric with inbox status tabs", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("matchingStatus");
    expect(source).toContain("Open");
    expect(source).toContain("In behandeling");
    expect(source).toContain("Gekoppeld");
    expect(source).toContain("Geen match");
    expect(source).toContain("AddCandidateWizard");
  });

  it("matching page keeps report and detail surfaces on candidate cards", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("ReportButton");
    expect(source).toContain("MatchDetail");
    expect(source).toContain("marienne-v1");
    expect(source).toContain("criteriaBreakdown");
  });

  it("wizard linking supports explicit no-match persistence", () => {
    const source = readFile("components/candidate-wizard/wizard-step-linking.tsx");
    expect(source).toContain("/geen-match");
    expect(source).toContain("markNoMatch");
  });

  it("wizard linking supports manual vacancy search and jobIds linking", () => {
    const source = readFile("components/candidate-wizard/wizard-step-linking.tsx");
    expect(source).toContain("/api/opdrachten?q=");
    expect(source).toContain("jobIds");
    expect(source).toContain("recommendedMatchId");
  });

  it("opdracht detail CTA says 'Koppel aan kandidaat' (desktop)", () => {
    const source = readFile("app/opdrachten/[id]/page.tsx");
    expect(source).toContain("Koppel aan kandidaat");
    expect(source).not.toContain(">Reageren<");
  });

  it("opdracht detail CTA links to /matching with jobId", () => {
    const source = readFile("app/opdrachten/[id]/page.tsx");
    // biome-ignore lint/suspicious/noTemplateCurlyInString: Testing that template literal exists in source
    expect(source).toContain("/matching?jobId=${job.id}");
  });
});
