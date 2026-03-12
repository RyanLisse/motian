export type EscoRolloutMatchRow = {
  jobId: string | null;
  candidateId: string | null;
  matchScore: number;
  model: string | null;
  reasoning?: string | null;
  createdAt?: string | Date | null;
};

export type EscoSearchScenarioInput = {
  name: string;
  durationsMs: number[];
};

export type EscoSearchScenarioSummary = {
  name: string;
  runs: number;
  p50Ms: number | null;
  p95Ms: number | null;
};

export type EscoConfidenceDistribution = {
  unknown: number;
  low: number;
  medium: number;
  high: number;
};

export type EscoRolloutSnapshot = {
  generatedAt: string;
  totalMatches: number;
  byModel: Record<string, number>;
  guardrailFallbackCount: number;
  guardrailFallbackRate: number | null;
  mappingConfidenceDistribution: EscoConfidenceDistribution;
  top3ByJob: Array<{
    jobId: string;
    candidateIds: string[];
  }>;
  searchLatency: EscoSearchScenarioSummary[];
};

export type EscoLatencyRegression = {
  name: string;
  baselineP95Ms: number | null;
  latestP95Ms: number | null;
  regressionPercent: number | null;
  withinThreshold: boolean | null;
};

export function computePercentile(values: number[], percentile: number): number | null {
  if (values.length === 0) return null;

  const sorted = [...values].sort((a, b) => a - b);
  const clampedPercentile = Math.max(0, Math.min(100, percentile));
  const rankIndex = Math.max(0, Math.ceil((clampedPercentile / 100) * sorted.length) - 1);
  return sorted[rankIndex] ?? null;
}

export function summarizeSearchScenario(
  scenario: EscoSearchScenarioInput,
): EscoSearchScenarioSummary {
  return {
    name: scenario.name,
    runs: scenario.durationsMs.length,
    p50Ms: computePercentile(scenario.durationsMs, 50),
    p95Ms: computePercentile(scenario.durationsMs, 95),
  };
}

export function bucketConfidenceDistribution(
  values: Array<number | null | undefined>,
): EscoConfidenceDistribution {
  const distribution: EscoConfidenceDistribution = {
    unknown: 0,
    low: 0,
    medium: 0,
    high: 0,
  };

  for (const value of values) {
    if (typeof value !== "number" || Number.isNaN(value)) {
      distribution.unknown += 1;
      continue;
    }

    if (value < 0.7) {
      distribution.low += 1;
      continue;
    }

    if (value < 0.9) {
      distribution.medium += 1;
      continue;
    }

    distribution.high += 1;
  }

  return distribution;
}

export function buildEscoRolloutSnapshot(input: {
  generatedAt?: string;
  matches: EscoRolloutMatchRow[];
  mappingConfidences?: Array<number | null | undefined>;
  searchScenarios?: EscoSearchScenarioInput[];
}): EscoRolloutSnapshot {
  const byModel: Record<string, number> = {};
  const matchesByJob = new Map<string, EscoRolloutMatchRow[]>();

  for (const match of input.matches) {
    const model = match.model?.trim() || "unknown";
    byModel[model] = (byModel[model] ?? 0) + 1;

    if (!match.jobId) continue;
    const existing = matchesByJob.get(match.jobId) ?? [];
    existing.push(match);
    matchesByJob.set(match.jobId, existing);
  }

  const top3ByJob = [...matchesByJob.entries()]
    .sort(([jobA], [jobB]) => jobA.localeCompare(jobB))
    .map(([jobId, matches]) => ({
      jobId,
      candidateIds: [...matches]
        .sort((a, b) => b.matchScore - a.matchScore)
        .map((match) => match.candidateId)
        .filter((candidateId): candidateId is string => Boolean(candidateId))
        .slice(0, 3),
    }));

  const guardrailFallbackCount = input.matches.filter((match) =>
    match.reasoning?.includes("ESCO guardrail fallback"),
  ).length;

  return {
    generatedAt: input.generatedAt ?? new Date().toISOString(),
    totalMatches: input.matches.length,
    byModel,
    guardrailFallbackCount,
    guardrailFallbackRate:
      input.matches.length > 0 ? guardrailFallbackCount / input.matches.length : null,
    mappingConfidenceDistribution: bucketConfidenceDistribution(input.mappingConfidences ?? []),
    top3ByJob,
    searchLatency: (input.searchScenarios ?? []).map(summarizeSearchScenario),
  };
}

export function compareSearchLatencyAgainstBaseline(
  baseline: EscoRolloutSnapshot,
  latest: EscoRolloutSnapshot,
  maxRegressionPercent = 15,
): EscoLatencyRegression[] {
  const baselineByName = new Map(
    baseline.searchLatency.map((scenario) => [scenario.name, scenario]),
  );

  return latest.searchLatency.map((scenario) => {
    const baselineScenario = baselineByName.get(scenario.name);
    const baselineP95Ms = baselineScenario?.p95Ms ?? null;
    const latestP95Ms = scenario.p95Ms ?? null;

    if (baselineP95Ms === null || latestP95Ms === null || baselineP95Ms <= 0) {
      return {
        name: scenario.name,
        baselineP95Ms,
        latestP95Ms,
        regressionPercent: null,
        withinThreshold: null,
      };
    }

    const regressionPercent = Number(
      (((latestP95Ms - baselineP95Ms) / baselineP95Ms) * 100).toFixed(1),
    );

    return {
      name: scenario.name,
      baselineP95Ms,
      latestP95Ms,
      regressionPercent,
      withinThreshold: regressionPercent <= maxRegressionPercent,
    };
  });
}
