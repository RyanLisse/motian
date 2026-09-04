import { unstable_cache } from "next/cache";
import { cache } from "react";
import { db, isNull, sql } from "@/src/db";
import { candidates } from "@/src/db/schema";
import {
  type Candidate,
  countCandidates,
  listCandidates,
  searchCandidates,
} from "@/src/services/candidates";
import { getSkillsCatalogStatusCached, listSkillsForFilterOptions } from "@/src/services/esco";

// ---------------------------------------------------------------------------
// Global candidate stats — independent of search params
// ---------------------------------------------------------------------------

async function getKandidatenStatsUncached() {
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const result = await db
    .select({
      directCount: sql<number>`cast(count(*) filter (where ${candidates.availability} = 'direct') as integer)`,
      weekCount: sql<number>`cast(count(*) filter (where ${candidates.createdAt} >= ${oneWeekAgo}) as integer)`,
    })
    .from(candidates)
    .where(isNull(candidates.deletedAt));

  return {
    directCount: result[0]?.directCount ?? 0,
    weekCount: result[0]?.weekCount ?? 0,
  };
}

const getCachedKandidatenStats = unstable_cache(
  getKandidatenStatsUncached,
  ["kandidaten-stats", "v1"],
  { revalidate: 120 },
);

export const getKandidatenStats = cache(getCachedKandidatenStats);

// ---------------------------------------------------------------------------
// Skills catalog status + skills list — rarely changes
// ---------------------------------------------------------------------------

// Skill `name` values can be very long free-text strings (entire motivatie sentences).
// We truncate the visible label to keep the SSR HTML payload small for /kandidaten,
// while preserving the original text for the browser tooltip via `fullName`.
const SKILL_LABEL_MAX_LENGTH = 80;

function truncateSkillLabel(name: string): string {
  if (name.length <= SKILL_LABEL_MAX_LENGTH) return name;
  return `${name.slice(0, SKILL_LABEL_MAX_LENGTH - 1).trimEnd()}…`;
}

async function getSkillsFilterDataUncached() {
  const [catalogStatus, rawSkillOptions] = await Promise.all([
    getSkillsCatalogStatusCached(),
    listSkillsForFilterOptions(),
  ]);

  let escoCatalogMessage = "Skills-filter is tijdelijk niet beschikbaar.";
  if (catalogStatus.issue === "missing_catalog") {
    escoCatalogMessage = "Skills-catalogus ontbreekt; genereer eerst canonical skills.";
  }

  // Preserve `slug` (the filter value) untouched; truncate the `name` used as label.
  const skillOptions = rawSkillOptions.map((option) => ({
    slug: option.slug,
    name: truncateSkillLabel(option.name),
    fullName: option.name,
  }));

  return {
    escoCatalogAvailable: catalogStatus.available,
    escoCatalogMessage,
    skillOptions,
  };
}

const getCachedSkillsFilterData = unstable_cache(
  getSkillsFilterDataUncached,
  ["kandidaten-skills-filter", "v2"],
  { revalidate: 300 },
);

export const getSkillsFilterData = cache(getCachedSkillsFilterData);

// ---------------------------------------------------------------------------
// Page data loader — skills must not serialize ahead of independent reads
// ---------------------------------------------------------------------------

export type SkillsFilterData = {
  skillOptions: { slug: string; name: string; fullName: string }[];
  escoCatalogAvailable: boolean;
  escoCatalogMessage: string;
};

export const DEFAULT_SKILLS_FILTER_DATA: SkillsFilterData = {
  skillOptions: [],
  escoCatalogAvailable: false,
  escoCatalogMessage: "Vaardigheden-filter is tijdelijk niet beschikbaar.",
};

export type KandidatenPageLoadInput = {
  query: string;
  availability: string;
  skillSlug: string;
  limit: number;
  offset: number;
};

export type KandidatenPageLoadResult = {
  skillsData: SkillsFilterData;
  stats: { directCount: number; weekCount: number };
  candidateRows: Candidate[];
  totalCount: number;
};

export type KandidatenPageDataDeps = {
  getSkillsFilterData: () => Promise<SkillsFilterData>;
  getKandidatenStats: () => Promise<{ directCount: number; weekCount: number }>;
  listCandidates: typeof listCandidates;
  searchCandidates: typeof searchCandidates;
  countCandidates: typeof countCandidates;
};

/**
 * Loads /kandidaten server data without awaiting the skills-filter fetch before
 * skill-independent reads. When `skillSlug` is set, `escoCatalogAvailable` shapes
 * the search branch — so candidates are fetched only after skills (+ stats) resolve.
 */
export async function loadKandidatenPageData(
  input: KandidatenPageLoadInput,
  deps: KandidatenPageDataDeps = {
    getSkillsFilterData,
    getKandidatenStats,
    listCandidates,
    searchCandidates,
    countCandidates,
  },
): Promise<KandidatenPageLoadResult> {
  const { query, availability, skillSlug, limit, offset } = input;

  const skillsPromise = deps.getSkillsFilterData().catch((err: unknown) => {
    console.error("[Kandidaten] getSkillsFilterData failed:", err);
    return DEFAULT_SKILLS_FILTER_DATA;
  });

  // No skill filter → branch is known without ESCO; parallelize everything.
  if (!skillSlug) {
    const useSearch = Boolean(query || availability);
    const searchOptions = {
      query: query || undefined,
      availability: availability || undefined,
      limit,
      offset,
    };

    const [skillsData, stats, candidateRows, totalCount] = await Promise.all([
      skillsPromise,
      deps.getKandidatenStats(),
      useSearch ? deps.searchCandidates(searchOptions) : deps.listCandidates({ limit, offset }),
      useSearch
        ? deps.countCandidates({
            query: searchOptions.query,
            availability: searchOptions.availability,
          })
        : deps.countCandidates(),
    ]);

    return { skillsData, stats, candidateRows, totalCount };
  }

  // skillSlug present → escoCatalogAvailable feeds useSearch / escoUri; resolve
  // skills + stats first (still concurrent with each other), then branch.
  const [skillsData, stats] = await Promise.all([skillsPromise, deps.getKandidatenStats()]);
  const { escoCatalogAvailable } = skillsData;
  const useSearch = Boolean(query || availability || (skillSlug && escoCatalogAvailable));
  const searchOptions = {
    query: query || undefined,
    availability: availability || undefined,
    escoUri: escoCatalogAvailable ? skillSlug || undefined : undefined,
    limit,
    offset,
  };

  const [candidateRows, totalCount] = await Promise.all([
    useSearch ? deps.searchCandidates(searchOptions) : deps.listCandidates({ limit, offset }),
    useSearch
      ? deps.countCandidates({
          query: searchOptions.query,
          availability: searchOptions.availability,
          escoUri: searchOptions.escoUri,
        })
      : deps.countCandidates(),
  ]);

  return { skillsData, stats, candidateRows, totalCount };
}
