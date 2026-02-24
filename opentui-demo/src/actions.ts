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

export type ActionOutcome = {
  title: string;
  lines: string[];
};

export type TuiAction = {
  id: "import_jobs" | "run_scoring" | "review_gdpr";
  label: string;
  description: string;
  run: () => Promise<ActionOutcome>;
};

export type TuiActionDeps = {
  importJobsFromAts: () => Promise<ImportJobsSummary>;
  runCandidateScoring: () => Promise<RunScoringSummary>;
  reviewGdprRequests: () => Promise<ReviewGdprSummary>;
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
      id: "import_jobs",
      label: "Importeer opdrachten uit ATS",
      description: "Draait scrape pipelines voor actieve platforms.",
      run: async () => {
        const summary = await deps.importJobsFromAts();
        return {
          title: "Import voltooid",
          lines: [
            `Platforms totaal: ${summary.totalPlatforms}`,
            `Succesvol: ${summary.successfulPlatforms}`,
            `Mislukt: ${summary.failedPlatforms}`,
            `Nieuwe opdrachten: ${summary.jobsNew}`,
          ],
        };
      },
    },
    {
      id: "run_scoring",
      label: "Run candidate scoring",
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
      label: "Review GDPR verzoeken",
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
  ];
}
