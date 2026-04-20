import { cache } from "react";
import { and, db, eq, isNull, sql } from "@/src/db";
import { jobs, sidebarMetadata } from "@/src/db/schema";
import { cachedQuery } from "@/src/lib/upstash";
import { countDedupedOpenJobs } from "@/src/services/jobs/deduplication";
import { getJobStatusCondition } from "@/src/services/jobs/filters";
import { getSkillsCatalogStatusCached, listSkillsForFilterOptions } from "./esco";

const DEFAULT_SKILL_EMPTY_TEXT = "Geen skills gevonden.";

export type SidebarMetadataRow = {
  totalCount: number;
  platforms: string[];
  endClients: string[];
  categories: string[];
  skillOptions: { value: string; label: string }[];
  skillEmptyText: string;
  computedAt: Date;
};

function resolveSkillEmptyText(issue: string | null | undefined): string {
  if (issue === "missing_catalog") {
    return "Skills-catalogus ontbreekt. Genereer eerst de canonical skills.";
  }
  return DEFAULT_SKILL_EMPTY_TEXT;
}

/**
 * Reads precomputed sidebar metadata from the database.
 * Returns null only if no row exists at all.
 *
 * Note: we intentionally serve stale data here rather than falling through
 * to refreshSidebarMetadata() which runs 5 heavy aggregate queries and adds
 * 5-8s to the first page load. The cache-refresh Trigger.dev task updates
 * this every 15 minutes, so staleness is bounded.
 */
export const getSidebarMetadata = cache(
  async function getSidebarMetadata(): Promise<SidebarMetadataRow | null> {
    return cachedQuery(
      "sidebar-metadata",
      async () => {
        const rows = await db
          .select()
          .from(sidebarMetadata)
          .where(eq(sidebarMetadata.id, "default"))
          .limit(1);

        if (rows.length === 0) return null;

        const row = rows[0];

        return {
          totalCount: row.totalCount,
          platforms: row.platforms as string[],
          endClients: row.endClients as string[],
          categories: row.categories as string[],
          skillOptions: row.skillOptions as { value: string; label: string }[],
          skillEmptyText: row.skillEmptyText,
          computedAt: row.computedAt,
        };
      },
      600, // 10 min TTL — Trigger.dev refreshes every 15 min anyway
    );
  },
);

/**
 * Runs the 5 heavy aggregate queries on the jobs table,
 * upserts the result into sidebar_metadata, and returns the data.
 */
export const refreshSidebarMetadata = cache(
  async function refreshSidebarMetadata(): Promise<SidebarMetadataRow> {
    const activeJobsCondition = and(getJobStatusCondition("open"), isNull(jobs.deletedAt));
    const persistedEndClient = sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`;

    const skillsCatalogStatusPromise = getSkillsCatalogStatusCached().catch((error) => {
      console.error("[SidebarMetadata] getSkillsCatalogStatusCached failed:", error);
      return {
        available: false,
        issue: "missing_catalog" as const,
        skillCount: 0,
        aliasCount: 0,
        mappingCount: 0,
        jobSkillCount: 0,
        candidateSkillCount: 0,
        checkedAt: new Date().toISOString(),
      };
    });

    const skillsRowsPromise = listSkillsForFilterOptions().catch((error) => {
      console.error("[SidebarMetadata] listSkillsForFilterOptions failed:", error);
      return [];
    });

    const [dedupedCount, metaResult, categoryResult, skillsCatalogStatus, skillsRows] =
      await Promise.all([
        countDedupedOpenJobs(db),
        db
          .select({
            platforms: sql<string | null>`json_agg(distinct ${jobs.platform})`,
            endClients: sql<string | null>`json_agg(distinct ${persistedEndClient})`,
          })
          .from(jobs)
          .where(activeJobsCondition),
        db.execute(sql`
        SELECT DISTINCT je.value AS category
        FROM ${jobs}, LATERAL jsonb_array_elements_text(coalesce(${jobs.categories}::jsonb, '[]'::jsonb)) AS je(value)
        WHERE ${activeJobsCondition} AND je.value IS NOT NULL
        ORDER BY category ASC
      `),
        skillsCatalogStatusPromise,
        skillsRowsPromise,
      ]);

    const totalCount = dedupedCount;

    const platformsRaw = metaResult[0]?.platforms;
    const endClientsRaw = metaResult[0]?.endClients;
    const platforms = (
      Array.isArray(platformsRaw)
        ? platformsRaw
        : platformsRaw
          ? JSON.parse(platformsRaw as string)
          : []
    ).filter(Boolean) as string[];

    const endClients = (
      Array.isArray(endClientsRaw)
        ? endClientsRaw
        : endClientsRaw
          ? JSON.parse(endClientsRaw as string)
          : []
    ).filter(Boolean) as string[];

    const categoryRows = (categoryResult.rows ?? []) as { category: string }[];
    const categories = categoryRows
      .map((row) => row.category?.trim())
      .filter((value): value is string => Boolean(value && value.length > 0));

    const skillOptions = skillsRows.map((skill) => ({
      value: skill.slug,
      label: skill.name,
    }));

    const skillEmptyText = resolveSkillEmptyText(skillsCatalogStatus.issue);
    const computedAt = new Date();

    await db
      .insert(sidebarMetadata)
      .values({
        id: "default",
        totalCount,
        platforms,
        endClients,
        categories,
        skillOptions,
        skillEmptyText,
        computedAt,
      })
      .onConflictDoUpdate({
        target: sidebarMetadata.id,
        set: {
          totalCount,
          platforms,
          endClients,
          categories,
          skillOptions,
          skillEmptyText,
          computedAt,
        },
      });

    return {
      totalCount,
      platforms,
      endClients,
      categories,
      skillOptions,
      skillEmptyText,
      computedAt,
    };
  },
);
