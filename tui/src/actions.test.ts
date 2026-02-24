import { describe, expect, it, mock } from "bun:test";
import {
  createTuiActions,
  type ImportJobsSummary,
  type KandidatenResult,
  type MatchesResult,
  type ReviewGdprSummary,
  type RunScoringSummary,
  type StatsResult,
  type TuiActionDeps,
  type VacaturesResult,
  type WorkspaceOverview,
} from "./actions";

function makeDefaultDeps(): TuiActionDeps {
  return {
    importJobsFromAts: mock(
      async (): Promise<ImportJobsSummary> => ({
        totalPlatforms: 0,
        successfulPlatforms: 0,
        failedPlatforms: 0,
        jobsNew: 0,
      }),
    ),
    runCandidateScoring: mock(
      async (): Promise<RunScoringSummary> => ({
        jobsProcessed: 0,
        candidatesConsidered: 0,
        matchesCreated: 0,
        duplicateMatches: 0,
        errors: 0,
      }),
    ),
    reviewGdprRequests: mock(
      async (): Promise<ReviewGdprSummary> => ({
        expiredCandidates: 0,
        oldestRetentionDate: null,
      }),
    ),
    getWorkspaceOverview: mock(
      async (): Promise<WorkspaceOverview> => ({
        totalCandidates: 0,
        totalJobs: 0,
        totalMatches: 0,
        applicationStats: { total: 0, byStage: {} },
      }),
    ),
    zoekKandidaten: mock(
      async (): Promise<KandidatenResult> => ({ candidates: [], total: 0 }),
    ),
    zoekVacatures: mock(
      async (): Promise<VacaturesResult> => ({ jobs: [], total: 0 }),
    ),
    zoekMatches: mock(
      async (): Promise<MatchesResult> => ({ matches: [], total: 0 }),
    ),
    getSollicitatieStats: mock(
      async (): Promise<StatsResult> => ({ total: 0, byStage: {} }),
    ),
    runAutoMatchDemo: mock(async (): Promise<string[]> => ["Geen kandidaten gevonden."]),
  };
}

describe("createTuiActions", () => {
  it("returns nine actions in the expected order", () => {
    const actions = createTuiActions(makeDefaultDeps());

    expect(actions.map((action) => action.id)).toEqual([
      "workspace_overview",
      "import_jobs",
      "run_scoring",
      "review_gdpr",
      "zoek_kandidaten",
      "zoek_vacatures",
      "zoek_matches",
      "sollicitatie_stats",
      "auto_match_demo",
    ]);
  });

  it("wires workspace overview action to the overview dependency", async () => {
    const deps = makeDefaultDeps();
    deps.getWorkspaceOverview = mock(async () => ({
      totalCandidates: 42,
      totalJobs: 18,
      totalMatches: 95,
      applicationStats: { total: 7, byStage: { new: 3, screening: 4 } },
    }));

    const actions = createTuiActions(deps);
    const action = actions[0];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected workspace overview action");

    const result = await action.run();

    expect(deps.getWorkspaceOverview).toHaveBeenCalledTimes(1);
    expect(result.lines).toContain("Kandidaten: 42");
    expect(result.lines).toContain("Vacatures: 18");
    expect(result.lines).toContain("Matches: 95");
  });

  it("wires import action to the import dependency", async () => {
    const deps = makeDefaultDeps();
    deps.importJobsFromAts = mock(async () => ({
      totalPlatforms: 3,
      successfulPlatforms: 2,
      failedPlatforms: 1,
      jobsNew: 27,
    }));

    const actions = createTuiActions(deps);
    const action = actions[1];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected import action");

    const result = await action.run();

    expect(deps.importJobsFromAts).toHaveBeenCalledTimes(1);
    expect(result.lines).toContain("Nieuwe vacatures: 27");
  });

  it("wires scoring action to the scoring dependency", async () => {
    const deps = makeDefaultDeps();
    deps.runCandidateScoring = mock(async () => ({
      jobsProcessed: 14,
      candidatesConsidered: 122,
      matchesCreated: 34,
      duplicateMatches: 8,
      errors: 1,
    }));

    const actions = createTuiActions(deps);
    const action = actions[2];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected scoring action");

    const result = await action.run();

    expect(deps.runCandidateScoring).toHaveBeenCalledTimes(1);
    expect(result.lines).toContain("Matches aangemaakt: 34");
  });

  it("wires GDPR review action to the review dependency", async () => {
    const deps = makeDefaultDeps();
    deps.reviewGdprRequests = mock(async () => ({
      expiredCandidates: 5,
      oldestRetentionDate: new Date("2025-01-01T00:00:00.000Z"),
    }));

    const actions = createTuiActions(deps);
    const action = actions[3];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected GDPR action");

    const result = await action.run();

    expect(deps.reviewGdprRequests).toHaveBeenCalledTimes(1);
    expect(result.lines).toContain("Verlopen retentie kandidaten: 5");
    expect(result.lines.some((line) => line.includes("Oudste retentiedatum"))).toBe(true);
  });

  it("wires kandidaten action to the zoekKandidaten dependency", async () => {
    const deps = makeDefaultDeps();
    deps.zoekKandidaten = mock(async () => ({
      candidates: [
        { id: "1", name: "Jan de Vries", role: "Developer", location: "Amsterdam" },
      ],
      total: 1,
    }));

    const actions = createTuiActions(deps);
    const action = actions[4];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected kandidaten action");

    const result = await action.run();

    expect(deps.zoekKandidaten).toHaveBeenCalledTimes(1);
    expect(result.lines[0]).toContain("Jan de Vries");
  });

  it("wires vacatures action to the zoekVacatures dependency", async () => {
    const deps = makeDefaultDeps();
    deps.zoekVacatures = mock(async () => ({
      jobs: [
        { id: "1", title: "Senior Dev", company: "Acme", location: "Utrecht" },
      ],
      total: 45,
    }));

    const actions = createTuiActions(deps);
    const action = actions[5];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected vacatures action");

    const result = await action.run();

    expect(deps.zoekVacatures).toHaveBeenCalledTimes(1);
    expect(result.title).toContain("45 totaal");
    expect(result.lines[0]).toContain("Senior Dev");
  });

  it("wires matches action to the zoekMatches dependency", async () => {
    const deps = makeDefaultDeps();
    deps.zoekMatches = mock(async () => ({
      matches: [
        {
          id: "abc12345-def6-7890",
          jobId: "j1",
          candidateId: "c1",
          matchScore: 87,
          status: "pending",
        },
      ],
      total: 1,
    }));

    const actions = createTuiActions(deps);
    const action = actions[6];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected matches action");

    const result = await action.run();

    expect(deps.zoekMatches).toHaveBeenCalledTimes(1);
    expect(result.lines[0]).toContain("87%");
  });

  it("wires sollicitatie stats action to the getSollicitatieStats dependency", async () => {
    const deps = makeDefaultDeps();
    deps.getSollicitatieStats = mock(async () => ({
      total: 12,
      byStage: { new: 5, screening: 4, interview: 3 },
    }));

    const actions = createTuiActions(deps);
    const action = actions[7];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected stats action");

    const result = await action.run();

    expect(deps.getSollicitatieStats).toHaveBeenCalledTimes(1);
    expect(result.title).toContain("12 totaal");
  });

  it("wires auto-match demo action to the runAutoMatchDemo dependency", async () => {
    const deps = makeDefaultDeps();
    deps.runAutoMatchDemo = mock(async () => [
      "Kandidaat: Jan de Vries",
      "Matches gevonden: 2",
    ]);

    const actions = createTuiActions(deps);
    const action = actions[8];
    expect(action).toBeDefined();
    if (!action) throw new Error("Expected auto-match action");

    const result = await action.run();

    expect(deps.runAutoMatchDemo).toHaveBeenCalledTimes(1);
    expect(result.lines).toContain("Kandidaat: Jan de Vries");
  });
});
