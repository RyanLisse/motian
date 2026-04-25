import { unstable_cache } from "next/cache";
import { cache } from "react";
import { db, isNull, sql } from "@/src/db";
import { candidates } from "@/src/db/schema";
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
