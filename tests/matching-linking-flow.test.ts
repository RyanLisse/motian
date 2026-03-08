import fs from "node:fs";
import path from "node:path";
import { describe, expect, it } from "vitest";
// ── Schema imports ───────────────────────────────────────────────
import { jobMatches } from "../src/db/schema.js";
// ── Service imports (no Next.js dependency) ─────────────────────
import {
  createOrReuseApplicationForMatch,
  getApplicationByJobAndCandidate,
} from "../src/services/applications.js";
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
  it("shared match-linking action exports linkCandidateToJob", () => {
    const source = readFile("src/actions/match-linking.ts");
    expect(source).toContain("export async function linkCandidateToJob");
  });

  it("linkCandidateToJob handles existing match (approve path)", () => {
    const source = readFile("src/actions/match-linking.ts");
    expect(source).toContain("getMatchByJobAndCandidate");
    expect(source).toContain('updateMatchStatus(existing.id, "approved", "system")');
    expect(source).toContain("createOrReuseApplicationForMatch");
  });

  it("linkCandidateToJob handles new match (atomic insert as approved)", () => {
    const source = readFile("src/actions/match-linking.ts");
    expect(source).toContain(".insert(jobMatches)");
    expect(source).toContain('"Handmatige koppeling"');
    expect(source).toContain('status: "approved"');
    expect(source).toContain("createOrReuseApplicationForMatch");
  });

  it("linkCandidateToJob handles unique constraint race condition", () => {
    const source = readFile("src/actions/match-linking.ts");
    expect(source).toContain("uq_job_matches_job_candidate");
  });

  it("shared match-linking action revalidates recruiter and candidate surfaces", () => {
    const source = readFile("src/actions/match-linking.ts");
    expect(source).toContain('revalidatePath("/professionals")');
    expect(source).toContain('revalidatePath("/opdrachten")');
    expect(source).toContain('revalidatePath("/pipeline")');
    expect(source).toContain('revalidatePath("/overzicht")');
  });

  it("shared match-review action routes match approvals through the shared updateMatchStatus service", () => {
    const source = readFile("src/actions/match-review.ts");
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

  it("candidate detail keeps report and structured detail surfaces inside the matches section", () => {
    const source = readFile("app/professionals/[id]/page.tsx");
    expect(source).toContain("ReportButton");
    expect(source).toContain("MatchDetail");
    expect(source).toContain('<section id="matches">');
  });

  it("legacy matching route redirects job-scoped requests into vacancy detail anchors", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("jobId");
    expect(source).toContain('tab === "grading"');
    expect(source).toContain("#ai-grading");
    expect(source).toContain("#recruiter-cockpit");
    expect(source).toContain('redirect("/professionals")');
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

  it("opdracht detail surfaces recruiter cockpit and grading anchors", () => {
    const source = readFile("app/opdrachten/[id]/page.tsx");
    expect(source).toContain('id="recruiter-cockpit"');
    expect(source).toContain('id="ai-grading"');
    expect(source).toContain("const gradingHref =");
    expect(source).toContain("#ai-grading");
    expect(source).toContain("AI Grading");
  });

  it("link candidates dialog points to recruiter cockpit and grading instead of standalone matching", () => {
    const source = readFile("components/link-candidates-dialog.tsx");
    expect(source).toContain("const recruiterCockpitHref =");
    expect(source).toContain("const gradingHref =");
    expect(source).toContain("#recruiter-cockpit");
    expect(source).toContain("#ai-grading");
    expect(source).toContain("Recruiter cockpit");
    expect(source).toContain("AI Grading");
    expect(source).not.toContain("/matching");
  });

  it("chat and auto-match UI route users back into candidate or vacancy context", () => {
    const cardSource = readFile("components/chat/genui/match-card.tsx");
    const autoMatchSource = readFile("components/auto-match-results.tsx");

    expect(cardSource).toContain("#matches");
    expect(cardSource).toContain("#recruiter-cockpit");
    expect(cardSource).toContain("Open matchkansen →");
    expect(cardSource).toContain("Open vacaturecontext →");
    expect(cardSource).not.toContain("/matching");

    expect(autoMatchSource).toContain("href={`/professionals/");
    expect(autoMatchSource).toContain("#matches`}");
    expect(autoMatchSource).toContain("Bekijk matchkansen");
  });
});
