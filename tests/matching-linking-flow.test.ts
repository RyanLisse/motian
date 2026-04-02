import fs from "node:fs";
import path from "node:path";
import { afterEach, describe, expect, it, vi } from "vitest";
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

type MockApplication = {
  id: string;
  jobId: string | null;
  candidateId: string | null;
  matchId: string | null;
  stage: string;
  source: string | null;
  notes: string | null;
  createdAt: Date;
  updatedAt: Date;
  deletedAt: Date | null;
};

type Predicate =
  | { kind: "eq"; column: string; value: unknown }
  | { kind: "isNull"; column: string };

const columnToField: Record<string, keyof MockApplication> = {
  id: "id",
  job_id: "jobId",
  candidate_id: "candidateId",
  match_id: "matchId",
  stage: "stage",
  source: "source",
  notes: "notes",
  deleted_at: "deletedAt",
};

function collectPredicates(node: unknown): Predicate[] {
  if (!node || typeof node !== "object" || !("queryChunks" in node)) {
    return [];
  }

  const queryChunks = (node as { queryChunks: unknown[] }).queryChunks;
  if (!Array.isArray(queryChunks)) {
    return [];
  }

  const predicates: Predicate[] = [];
  const column = queryChunks.find(
    (chunk): chunk is { name: string } =>
      !!chunk && typeof chunk === "object" && "name" in chunk && typeof chunk.name === "string",
  );
  const param = queryChunks.find(
    (chunk): chunk is { value: unknown } =>
      !!chunk && typeof chunk === "object" && "value" in chunk && !Array.isArray(chunk.value),
  );
  const text = queryChunks
    .filter(
      (chunk): chunk is { value: string[] } =>
        !!chunk &&
        typeof chunk === "object" &&
        "value" in chunk &&
        Array.isArray(chunk.value) &&
        chunk.value.every((value) => typeof value === "string"),
    )
    .flatMap((chunk) => chunk.value)
    .join("")
    .toLowerCase();

  if (column) {
    if (param && text.includes("=")) {
      predicates.push({ kind: "eq", column: column.name, value: param.value });
    } else if (text.includes("is null")) {
      predicates.push({ kind: "isNull", column: column.name });
    }
  }

  for (const chunk of queryChunks) {
    predicates.push(...collectPredicates(chunk));
  }

  return predicates;
}

function matchesPredicates(row: MockApplication, predicates: Predicate[]) {
  return predicates.every((predicate) => {
    const field = columnToField[predicate.column];
    if (!field) {
      return true;
    }

    if (predicate.kind === "eq") {
      return row[field] === predicate.value;
    }

    return row[field] === null;
  });
}

function buildMockApplication(values: Partial<MockApplication>, index: number): MockApplication {
  const timestamp = new Date(`2026-03-08T00:00:0${index}.000Z`);

  return {
    id: values.id ?? `application-${index}`,
    jobId: values.jobId ?? null,
    candidateId: values.candidateId ?? null,
    matchId: values.matchId ?? null,
    stage: values.stage ?? "new",
    source: values.source ?? "manual",
    notes: values.notes ?? null,
    createdAt: values.createdAt ?? timestamp,
    updatedAt: values.updatedAt ?? timestamp,
    deletedAt: values.deletedAt ?? null,
  };
}

function createMockApplicationsDb(initialRows: MockApplication[] = []) {
  const state = { rows: [...initialRows] };

  const db = {
    select() {
      return {
        from() {
          return {
            where(condition: unknown) {
              const filtered = state.rows.filter((row) =>
                matchesPredicates(row, collectPredicates(condition)),
              );

              return {
                limit: async (limit: number) => filtered.slice(0, limit),
              };
            },
          };
        },
      };
    },
    insert() {
      let values: Partial<MockApplication> | undefined;
      let skipOnConflict = false;

      return {
        values(nextValues: Partial<MockApplication>) {
          values = nextValues;
          return this;
        },
        onConflictDoNothing() {
          skipOnConflict = true;
          return this;
        },
        async returning() {
          if (!values) {
            return [];
          }

          const existing = state.rows.find(
            (row) =>
              row.jobId === (values.jobId ?? null) &&
              row.candidateId === (values.candidateId ?? null) &&
              row.deletedAt === null,
          );

          if (skipOnConflict && existing) {
            return [];
          }

          const created = buildMockApplication(values, state.rows.length + 1);
          state.rows.push(created);
          return [created];
        },
      };
    },
    update() {
      let patch: Partial<MockApplication> = {};
      let condition: unknown;

      return {
        set(nextPatch: Partial<MockApplication>) {
          patch = nextPatch;
          return this;
        },
        where(nextCondition: unknown) {
          condition = nextCondition;
          return this;
        },
        async returning() {
          const updated = state.rows.filter((row) =>
            matchesPredicates(row, collectPredicates(condition)),
          );

          for (const row of updated) {
            Object.assign(row, patch);
          }

          return updated;
        },
      };
    },
  };

  return { db, state };
}

afterEach(() => {
  vi.doUnmock("../src/db");
  vi.resetModules();
});

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

  it("matching page reads jobId from searchParams and redirects", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("jobId");
    expect(source).toContain("searchParams");
    expect(source).toContain("redirect");
  });

  it("matching page redirects to vacatures detail with jobId", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("/vacatures/");
    expect(source).toContain("#recruiter-cockpit");
    expect(source).toContain("#ai-grading");
  });

  it("matching page redirects to kandidaten without jobId", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain('redirect("/kandidaten")');
  });

  it("matching page supports grading tab redirect", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain('tab === "grading"');
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

  it("matching page is a redirect-only route documenting where matching UI lives", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("redirect");
    expect(source).toContain("kandidaten");
    expect(source).toContain("recruiter-cockpit");
  });

  it("matching page documents the redirect intent for legacy URL support", () => {
    const source = readFile("app/matching/page.tsx");
    expect(source).toContain("redirect page");
    expect(source).toContain("recruiter-flow");
  });

  it("wizard linking supports explicit no-match persistence", () => {
    const source = readFile("components/candidate-wizard/wizard-step-linking.tsx");
    expect(source).toContain("/geen-match");
    expect(source).toContain("markNoMatch");
  });

  it("wizard linking supports manual vacancy search and jobIds linking", () => {
    const source = readFile("components/candidate-wizard/wizard-step-linking.tsx");
    expect(source).toContain("/api/vacatures?q=");
    expect(source).toContain("jobIds");
    expect(source).toContain("recommendedMatchId");
  });

  it("candidate detail keeps report and structured detail surfaces inside the matches section", () => {
    const source = readFile("app/kandidaten/[id]/page.tsx");
    expect(source).toContain("ReportButton");
    expect(source).toContain("MatchDetail");
    expect(source).toContain('<section id="matches">');
  });

  it("opdracht detail CTA says 'Koppel aan kandidaat' (desktop)", () => {
    const source = readFile("app/vacatures/[id]/page.tsx");
    expect(source).toContain("Koppel aan kandidaat");
    expect(source).not.toContain(">Reageren<");
  });

  it("opdracht detail surfaces recruiter cockpit and grading anchors", () => {
    const source = readFile("app/vacatures/[id]/page.tsx");
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
});

describe("Matching linking flow — application helper behavior", () => {
  it("creates, reuses, and looks up an application by job and candidate", async () => {
    const { db, state } = createMockApplicationsDb();
    vi.doMock("../src/db", async () => ({ ...(await vi.importActual("../src/db")), db }));

    const { createOrReuseApplicationForMatch, getApplicationByJobAndCandidate } = await import(
      "../src/services/applications.js"
    );
    const jobId = "00000000-0000-0000-0000-000000000101";
    const candidateId = "00000000-0000-0000-0000-000000000201";
    const matchId = "00000000-0000-0000-0000-000000000301";

    const created = await createOrReuseApplicationForMatch({
      jobId,
      candidateId,
      matchId,
      stage: "screening",
    });

    expect(created.created).toBe(true);
    expect(created.application).toMatchObject({
      jobId,
      candidateId,
      matchId,
      stage: "screening",
      source: "match",
    });
    expect(state.rows).toHaveLength(1);

    const reused = await createOrReuseApplicationForMatch({
      jobId,
      candidateId,
      matchId,
      stage: "interview",
    });

    expect(reused.created).toBe(false);
    expect(reused.application.id).toBe(created.application.id);
    expect(state.rows).toHaveLength(1);

    const lookup = await getApplicationByJobAndCandidate(jobId, candidateId);
    const missing = await getApplicationByJobAndCandidate(
      jobId,
      "00000000-0000-0000-0000-000000000202",
    );

    expect(lookup).toEqual(created.application);
    expect(missing).toBeNull();
  });

  it("reuses an existing application and refreshes matchId when a new match is linked", async () => {
    const existing = buildMockApplication(
      {
        id: "application-existing",
        jobId: "00000000-0000-0000-0000-000000000111",
        candidateId: "00000000-0000-0000-0000-000000000211",
        matchId: null,
        stage: "screening",
        source: "match",
      },
      1,
    );
    const { db, state } = createMockApplicationsDb([existing]);
    vi.doMock("../src/db", async () => ({ ...(await vi.importActual("../src/db")), db }));

    const { createOrReuseApplicationForMatch } = await import("../src/services/applications.js");

    const result = await createOrReuseApplicationForMatch({
      jobId: existing.jobId ?? "",
      candidateId: existing.candidateId ?? "",
      matchId: "00000000-0000-0000-0000-000000000311",
      stage: "screening",
    });

    expect(result.created).toBe(false);
    expect(result.application.id).toBe(existing.id);
    expect(result.application.matchId).toBe("00000000-0000-0000-0000-000000000311");
    expect(state.rows).toHaveLength(1);
  });
});
