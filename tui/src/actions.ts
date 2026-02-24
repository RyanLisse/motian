export type ImportJobsSummary = {
  totalPlatforms: number;
  successfulPlatforms: number;
  failedPlatforms: number;
  jobsNew: number;
};

export type RunScoringSummary = {
  jobsProcessed: number;
  candidatesConsidered: number;
  matchesCreated: number;
  duplicateMatches: number;
  errors: number;
};

export type ReviewGdprSummary = {
  expiredCandidates: number;
  oldestRetentionDate: Date | null;
};

export type WorkspaceOverview = {
  totalCandidates: number;
  totalJobs: number;
  totalMatches: number;
  applicationStats: { total: number; byStage: Record<string, number> };
};

export type KandidatenResult = {
  candidates: { id: string; name: string; role: string | null; location: string | null }[];
  total: number;
};

export type VacaturesResult = {
  jobs: { id: string; title: string; company: string | null; location: string | null }[];
  total: number;
};

export type MatchesResult = {
  matches: {
    id: string;
    jobId: string;
    candidateId: string;
    matchScore: number;
    status: string;
  }[];
  total: number;
};

export type StatsResult = {
  total: number;
  byStage: Record<string, number>;
};

export type ActionOutcome = {
  title: string;
  lines: string[];
};

export type TuiAction = {
  id:
    | "workspace_overview"
    | "import_jobs"
    | "run_scoring"
    | "review_gdpr"
    | "zoek_kandidaten"
    | "zoek_vacatures"
    | "zoek_matches"
    | "sollicitatie_stats"
    | "auto_match_demo";
  label: string;
  description: string;
  run: () => Promise<ActionOutcome>;
};

export type TuiActionDeps = {
  importJobsFromAts: () => Promise<ImportJobsSummary>;
  runCandidateScoring: () => Promise<RunScoringSummary>;
  reviewGdprRequests: () => Promise<ReviewGdprSummary>;
  getWorkspaceOverview: () => Promise<WorkspaceOverview>;
  zoekKandidaten: () => Promise<KandidatenResult>;
  zoekVacatures: () => Promise<VacaturesResult>;
  zoekMatches: () => Promise<MatchesResult>;
  getSollicitatieStats: () => Promise<StatsResult>;
  runAutoMatchDemo: () => Promise<string[]>;
};

function formatDate(value: Date): string {
  return new Intl.DateTimeFormat("nl-NL", {
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(value);
}

export function createTuiActions(deps: TuiActionDeps): TuiAction[] {
  return [
    {
      id: "workspace_overview",
      label: "Workspace overzicht",
      description: "Toont totalen van kandidaten, vacatures, matches en sollicitaties.",
      run: async () => {
        const overview = await deps.getWorkspaceOverview();
        const stageLines = Object.entries(overview.applicationStats.byStage).map(
          ([stage, count]) => `  ${stage}: ${count}`,
        );
        return {
          title: "Workspace overzicht",
          lines: [
            `Kandidaten: ${overview.totalCandidates}`,
            `Vacatures: ${overview.totalJobs}`,
            `Matches: ${overview.totalMatches}`,
            `Sollicitaties: ${overview.applicationStats.total}`,
            ...(stageLines.length > 0 ? ["Pipeline:", ...stageLines] : []),
          ],
        };
      },
    },
    {
      id: "import_jobs",
      label: "Importeer vacatures uit ATS",
      description: "Draait scrape pipelines voor actieve platforms.",
      run: async () => {
        const summary = await deps.importJobsFromAts();
        return {
          title: "Import voltooid",
          lines: [
            `Platforms totaal: ${summary.totalPlatforms}`,
            `Succesvol: ${summary.successfulPlatforms}`,
            `Mislukt: ${summary.failedPlatforms}`,
            `Nieuwe vacatures: ${summary.jobsNew}`,
          ],
        };
      },
    },
    {
      id: "run_scoring",
      label: "Run kandidaat scoring",
      description: "Berekent matches en slaat nieuwe match records op.",
      run: async () => {
        const summary = await deps.runCandidateScoring();
        return {
          title: "Scoring voltooid",
          lines: [
            `Jobs verwerkt: ${summary.jobsProcessed}`,
            `Kandidaten bekeken: ${summary.candidatesConsidered}`,
            `Matches aangemaakt: ${summary.matchesCreated}`,
            `Duplicates overgeslagen: ${summary.duplicateMatches}`,
            `Errors: ${summary.errors}`,
          ],
        };
      },
    },
    {
      id: "review_gdpr",
      label: "Review GDPR retentie",
      description: "Toont kandidaten met verlopen retentie.",
      run: async () => {
        const summary = await deps.reviewGdprRequests();
        const oldest =
          summary.oldestRetentionDate == null ? "n.v.t." : formatDate(summary.oldestRetentionDate);

        return {
          title: "GDPR review",
          lines: [
            `Verlopen retentie kandidaten: ${summary.expiredCandidates}`,
            `Oudste retentiedatum: ${oldest}`,
          ],
        };
      },
    },
    {
      id: "zoek_kandidaten",
      label: "Bekijk recente kandidaten",
      description: "Toont de 10 meest recente kandidaten.",
      run: async () => {
        const result = await deps.zoekKandidaten();
        if (result.candidates.length === 0) {
          return { title: "Kandidaten", lines: ["Geen kandidaten gevonden."] };
        }
        return {
          title: `Kandidaten (${result.total} getoond)`,
          lines: result.candidates.map(
            (c) => `${c.name} — ${c.role ?? "geen rol"} — ${c.location ?? "onbekend"}`,
          ),
        };
      },
    },
    {
      id: "zoek_vacatures",
      label: "Bekijk recente vacatures",
      description: "Toont de 10 meest recente vacatures.",
      run: async () => {
        const result = await deps.zoekVacatures();
        if (result.jobs.length === 0) {
          return { title: "Vacatures", lines: ["Geen vacatures gevonden."] };
        }
        return {
          title: `Vacatures (${result.total} totaal)`,
          lines: result.jobs.map(
            (j) => `${j.title} — ${j.company ?? "onbekend"} — ${j.location ?? "onbekend"}`,
          ),
        };
      },
    },
    {
      id: "zoek_matches",
      label: "Bekijk recente matches",
      description: "Toont de 10 meest recente matches op score.",
      run: async () => {
        const result = await deps.zoekMatches();
        if (result.matches.length === 0) {
          return { title: "Matches", lines: ["Geen matches gevonden."] };
        }
        return {
          title: `Matches (${result.total} getoond)`,
          lines: result.matches.map(
            (m) => `Score: ${m.matchScore}% — Status: ${m.status} — ID: ${m.id.slice(0, 8)}...`,
          ),
        };
      },
    },
    {
      id: "sollicitatie_stats",
      label: "Sollicitatie pipeline",
      description: "Toont sollicitatie-statistieken per fase.",
      run: async () => {
        const stats = await deps.getSollicitatieStats();
        if (stats.total === 0) {
          return { title: "Sollicitaties", lines: ["Geen sollicitaties gevonden."] };
        }
        const stageLines = Object.entries(stats.byStage).map(
          ([stage, count]) => `  ${stage}: ${count}`,
        );
        return {
          title: `Sollicitaties (${stats.total} totaal)`,
          lines: stageLines,
        };
      },
    },
    {
      id: "auto_match_demo",
      label: "Auto-match demo",
      description: "Draait auto-match voor de eerste kandidaat als demonstratie.",
      run: async () => {
        const lines = await deps.runAutoMatchDemo();
        return {
          title: "Auto-match resultaat",
          lines,
        };
      },
    },
  ];
}
