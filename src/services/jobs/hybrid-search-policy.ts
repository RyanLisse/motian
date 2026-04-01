type EnvMap = Record<string, string | undefined>;

export const HYBRID_SEARCH_POLICY_VERSION = 2;
export const HYBRID_SEARCH_FULL_CANDIDATE_HYDRATION_ENV = "HYBRID_SEARCH_FULL_CANDIDATE_HYDRATION";

const HYBRID_SEARCH_RRF_K = 60;
const HYBRID_SEARCH_VECTOR_MIN_SCORE = 0.3;
const HYBRID_SEARCH_FETCH_MULTIPLIER = 3;
const HYBRID_SEARCH_FETCH_CAP = 100;
const HYBRID_SEARCH_SHORT_QUERY_MAX_WORDS = 2;

function parseBooleanEnv(value: string | undefined): boolean {
  if (!value) return false;

  switch (value.trim().toLowerCase()) {
    case "1":
    case "true":
    case "yes":
    case "on":
      return true;
    default:
      return false;
  }
}

export type HybridSearchPolicy = {
  version: number;
  fetchSize: number;
  k: number;
  vectorMinScore: number;
  hydrationMode: "full-candidates" | "deduped-vacancy-candidates";
  shouldRunVectorSearch: boolean;
  vectorSearchSkippedReason: "short-query-text-only" | null;
};

function normalizeQueryForPolicy(query: string): string {
  return query.replace(/\s+/g, " ").trim().toLocaleLowerCase("nl-NL");
}

/**
 * Phase 2 policy:
 * - keep Phase 1 branch fetch sizing unless explicitly changed,
 * - allow an opt-in short-query text-only rollout,
 * - hydrate one representative row per deduped vacancy candidate after RRF.
 */
export function getHybridSearchPolicy(
  opts: { query: string; limit?: number; offset?: number },
  env: EnvMap = process.env,
): HybridSearchPolicy {
  const limit = Math.min(opts.limit ?? 20, 100);
  const offset = Math.max(opts.offset ?? 0, 0);
  const fetchSize = Math.min(
    Math.max(
      (offset + limit) * HYBRID_SEARCH_FETCH_MULTIPLIER,
      limit * HYBRID_SEARCH_FETCH_MULTIPLIER,
    ),
    HYBRID_SEARCH_FETCH_CAP,
  );
  const normalizedQuery = normalizeQueryForPolicy(opts.query);
  const wordCount = normalizedQuery.length > 0 ? normalizedQuery.split(" ").length : 0;
  const shortQuery = wordCount > 0 && wordCount <= HYBRID_SEARCH_SHORT_QUERY_MAX_WORDS;
  // Skip vector search for short queries (≤2 words) — keyword search handles
  // "java", "python developer" etc. perfectly. Vector search adds ~960ms latency
  // from the OpenAI embedding API call without meaningful result improvement.
  const shouldRunVectorSearch = !shortQuery;
  const hydrationMode = parseBooleanEnv(env[HYBRID_SEARCH_FULL_CANDIDATE_HYDRATION_ENV])
    ? "full-candidates"
    : "deduped-vacancy-candidates";

  return {
    version: HYBRID_SEARCH_POLICY_VERSION,
    fetchSize,
    k: HYBRID_SEARCH_RRF_K,
    vectorMinScore: HYBRID_SEARCH_VECTOR_MIN_SCORE,
    hydrationMode,
    shouldRunVectorSearch,
    vectorSearchSkippedReason: shouldRunVectorSearch ? null : "short-query-text-only",
  };
}

export function getHybridSearchVacancyDedupeKey(input: {
  dedupeTitleNormalized?: string | null;
  dedupeClientNormalized?: string | null;
  dedupeLocationNormalized?: string | null;
  fallbackId: string;
}): string {
  if (
    typeof input.dedupeTitleNormalized === "string" &&
    typeof input.dedupeClientNormalized === "string" &&
    typeof input.dedupeLocationNormalized === "string"
  ) {
    return [
      input.dedupeTitleNormalized,
      input.dedupeClientNormalized,
      input.dedupeLocationNormalized,
    ].join("\u001f");
  }

  return input.fallbackId;
}

export function collapseHydrationCandidatesByVacancy(
  rankedCandidates: Array<{ id: string; rrfScore: number; dedupeKey: string }>,
) {
  const grouped = new Map<string, { id: string; score: number; dedupeKey: string }>();

  for (const candidate of rankedCandidates) {
    const existing = grouped.get(candidate.dedupeKey);
    if (existing) {
      existing.score += candidate.rrfScore;
      continue;
    }

    grouped.set(candidate.dedupeKey, {
      id: candidate.id,
      score: candidate.rrfScore,
      dedupeKey: candidate.dedupeKey,
    });
  }

  return [...grouped.values()];
}
