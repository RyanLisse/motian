import { unstable_cache } from "next/cache";
import { cache } from "react";
import { db, isNull, sql } from "@/src/db";
import { candidates } from "@/src/db/schema";
import { getEscoCatalogStatus, listEscoSkillsForFilter } from "@/src/services/esco";

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
// ESCO catalog status + skills list — rarely changes
// ---------------------------------------------------------------------------

async function getEscoFilterDataUncached() {
  const [catalogStatus, skillOptions] = await Promise.all([
    getEscoCatalogStatus(),
    listEscoSkillsForFilter(),
  ]);

  let escoCatalogMessage = "ESCO-filter is tijdelijk niet beschikbaar.";
  if (catalogStatus.issue === "missing_catalog" || catalogStatus.issue === "missing_skills") {
    escoCatalogMessage = "ESCO-catalogus ontbreekt; importeer eerst de dataset.";
  } else if (catalogStatus.issue === "missing_aliases") {
    escoCatalogMessage =
      "ESCO-aliases ontbreken; exacte labels werken nog wel, maar mapping is beperkt.";
  }

  return {
    escoCatalogAvailable: catalogStatus.available,
    escoCatalogMessage,
    skillOptions,
  };
}

const getCachedEscoFilterData = unstable_cache(
  getEscoFilterDataUncached,
  ["kandidaten-esco-filter", "v1"],
  { revalidate: 300 },
);

export const getEscoFilterData = cache(getCachedEscoFilterData);
