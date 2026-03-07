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
import {
  createOrReuseApplicationForMatch,
  getApplicationByJobAndCandidate,
} from "../src/services/applications.js";

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

  it("getApplicationByJobAndCandidate is exported as a function", () => {
    expect(typeof getApplicationByJobAndCandidate).toBe("function");
  });

  it("createOrReuseApplicationForMatch is exported as a function", () => {
    expect(typeof createOrReuseApplicationForMatch).toBe("function");
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
    expect(source).toContain("createOrReuseApplicationForMatch");
  });

  it("linkCandidateToJob handles new match (atomic insert as approved)", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("db.insert(jobMatches)");
    expect(source).toContain('"Handmatige koppeling"');
    // Verify the insert includes status: "approved" directly — no intermediate pending state
    expect(source).toContain('status: "approved"');
    expect(source).toContain("createOrReuseApplicationForMatch");
  });

  it("linkCandidateToJob handles unique constraint race condition", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain("uq_job_matches_job_candidate");
  });

  it("actions.ts routes match approvals through the shared updateMatchStatus service", () => {
    const source = readFile("app/matching/actions.ts");
    expect(source).toContain('from "@/src/services/matches"');
    expect(source).toContain("updateMatchStatus as updateMatchRecordStatus");
    expect(source).toContain("updateMatchRecordStatus(matchId, status");
  });

  it("applications service can create or reuse a pipeline record for a match", () => {
    const source = readFile("src/services/applications.ts");
    expect(source).toContain("export async function createOrReuseApplicationForMatch");
    expect(source).toContain("getApplicationByJobAndCandidate");
    expect(source).toContain("matchId");
    expect(source).toContain('source: "match"');
  });

  it("match status updates create or reuse an application when approved", () => {
    const source = readFile("src/services/matches.ts");
    expect(source).toContain("createOrReuseApplicationForMatch");
    expect(source).toContain('status === "approved"');
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

  it("matching page surfaces when a recommendation is already in pipeline", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("applications");
    expect(source).toContain("alreadyInPipeline");
    expect(source).toContain("stageLabels");
  });

  it("matching page preserves jobId in filter hrefs via buildQs", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("buildQs");
    expect(source).toContain("jobId");
  });

  it("matching UI copy frames approval as adding a recommendation to pipeline", () => {
    const source = readFile("app/matching/match-actions.tsx");
    expect(source).toContain("Voeg toe aan pipeline");
  });

  it("manual linker copy indicates pipeline intake state", () => {
    const source = readFile("app/matching/candidate-linker.tsx");
    expect(source).toContain("pipeline");
    expect(source).toContain("Al in pipeline");
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
