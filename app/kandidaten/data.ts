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

async function getSkillsFilterDataUncached() {
  const [catalogStatus, skillOptions] = await Promise.all([
    getSkillsCatalogStatusCached(),
    listSkillsForFilterOptions(),
  ]);

  let escoCatalogMessage = "Skills-filter is tijdelijk niet beschikbaar.";
  if (catalogStatus.issue === "missing_catalog") {
    escoCatalogMessage = "Skills-catalogus ontbreekt; genereer eerst canonical skills.";
  }

  return {
    escoCatalogAvailable: catalogStatus.available,
    escoCatalogMessage,
    skillOptions,
  };
}

const getCachedSkillsFilterData = unstable_cache(
  getSkillsFilterDataUncached,
  ["kandidaten-skills-filter", "v1"],
  { revalidate: 300 },
);

export const getSkillsFilterData = cache(getCachedSkillsFilterData);
