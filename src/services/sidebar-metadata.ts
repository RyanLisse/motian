import { getEscoCatalogStatus, listEscoSkillsForFilter } from "@motian/esco";
import { cache } from "react";
import { db, eq, sql } from "@/src/db";
import { jobs, sidebarMetadata } from "@/src/db/schema";
import { getJobStatusCondition } from "@/src/services/jobs/filters";

const DEFAULT_SKILL_EMPTY_TEXT = "Geen vaardigheden gevonden.";

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
  if (issue === "missing_catalog" || issue === "missing_skills") {
    return "ESCO-catalogus ontbreekt. Importeer eerst de dataset.";
  }
  if (issue === "missing_aliases") {
    return "ESCO-aliases ontbreken. Mapping is tijdelijk beperkt.";
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
);

/**
 * Runs the 5 heavy aggregate queries on the jobs table,
 * upserts the result into sidebar_metadata, and returns the data.
 */
export const refreshSidebarMetadata = cache(
  async function refreshSidebarMetadata(): Promise<SidebarMetadataRow> {
    const activeJobsCondition = getJobStatusCondition("open");
    const persistedEndClient = sql<string | null>`coalesce(${jobs.endClient}, ${jobs.company})`;

    const escoCatalogStatusPromise = getEscoCatalogStatus().catch((error) => {
      console.error("[SidebarMetadata] getEscoCatalogStatus failed:", error);
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

    const escoSkillRowsPromise = listEscoSkillsForFilter().catch((error) => {
      console.error("[SidebarMetadata] listEscoSkillsForFilter failed:", error);
      return [];
    });

    const [countResult, metaResult, categoryResult, escoCatalogStatus, escoSkillRows] =
      await Promise.all([
        db.select({ count: sql<number>`count(*)::int` }).from(jobs).where(activeJobsCondition),
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
        escoCatalogStatusPromise,
        escoSkillRowsPromise,
      ]);

    const totalCount = countResult[0]?.count ?? 0;

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

    const skillOptions = escoSkillRows.map((skill) => ({
      value: skill.uri,
      label: skill.labelNl ?? skill.labelEn,
    }));

    const skillEmptyText = resolveSkillEmptyText(escoCatalogStatus.issue);
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
