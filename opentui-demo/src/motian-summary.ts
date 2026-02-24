import type { ImportJobsSummary } from "./actions";

export type ScrapePipelineSummary = {
  jobsNew: number;
  duplicates: number;
  errors: string[];
};

export function summarizeImportResults(
  results: PromiseSettledResult<ScrapePipelineSummary>[],
): ImportJobsSummary {
  let successfulPlatforms = 0;
  let failedPlatforms = 0;
  let jobsNew = 0;

  for (const result of results) {
    if (result.status === "rejected") {
      failedPlatforms += 1;
      continue;
    }

    jobsNew += result.value.jobsNew;
    if (result.value.errors.length > 0) {
      failedPlatforms += 1;
    } else {
      successfulPlatforms += 1;
    }
  }

  return {
    totalPlatforms: results.length,
    successfulPlatforms,
    failedPlatforms,
    jobsNew,
  };
}

export function computeOldestRetentionDate(rows: Array<{ dataRetentionUntil: Date }>): Date | null {
  if (rows.length === 0) return null;
  const first = rows[0];
  if (!first) return null;

  return rows.reduce(
    (oldest, row) =>
      row.dataRetentionUntil.getTime() < oldest.getTime() ? row.dataRetentionUntil : oldest,
    first.dataRetentionUntil,
  );
}
