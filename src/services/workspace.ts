import { db, jobs, sql } from "../db";
import type { PlatformCatalogEntryView } from "./scrapers";
import { getHealth, listPlatformCatalog } from "./scrapers";

export type WorkspaceSummary = {
  jobs: { total: number; withEmbedding: number };
  candidates: { total: number };
  matches: { total: number; pending: number };
  scraperHealth: {
    overall: string;
    configuredPlatforms: number;
    pendingOnboarding: number;
    supportedPlatforms: number;
    blockers: Array<{ platform: string; blockerKind: string | null }>;
    platforms: Array<{ platform: string; status: string; lastRunAt: Date | null }>;
    catalog: Array<{
      slug: string;
      displayName: string;
      adapterKind: string;
      configured: boolean;
      currentStep: string | null;
      blockerKind: string | null;
    }>;
  };
};

/** Lightweight workspace overview for system prompt injection. */
export async function getWorkspaceSummary(): Promise<WorkspaceSummary> {
  // Single query with scalar subqueries replaces 3 separate count queries (fixes N+1)
  const [allCounts, health, catalog] = await Promise.all([
    db
      .select({
        jobsTotal: sql<number>`(select count(*)::int from jobs)`,
        jobsWithEmbedding: sql<number>`(select count(embedding)::int from jobs)`,
        candidatesTotal: sql<number>`(select count(*)::int from candidates where deleted_at is null)`,
        matchesTotal: sql<number>`(select count(*)::int from job_matches)`,
        matchesPending: sql<number>`(select count(*) filter (where status = 'pending')::int from job_matches)`,
      })
      .from(jobs)
      .limit(1),
    getHealth(),
    listPlatformCatalog(),
  ]);

  const c = allCounts[0];
  const openOnboardingStatuses = new Set([
    "draft",
    "researching",
    "config_saved",
    "waiting_for_credentials",
    "waiting_for_external_approval",
    "implementing",
    "implementation_failed",
    "validated",
    "tested",
    "active",
    "monitoring",
    "failed",
    "needs_implementation",
  ]);
  const pendingOnboarding = catalog.filter(
    (entry) => entry.latestRun?.status && openOnboardingStatuses.has(entry.latestRun.status),
  ).length;

  return {
    jobs: { total: c?.jobsTotal ?? 0, withEmbedding: c?.jobsWithEmbedding ?? 0 },
    candidates: { total: c?.candidatesTotal ?? 0 },
    matches: { total: c?.matchesTotal ?? 0, pending: c?.matchesPending ?? 0 },
    scraperHealth: {
      overall: health.overall,
      supportedPlatforms: catalog.length,
      configuredPlatforms: catalog.filter((entry) => entry.config).length,
      pendingOnboarding,
      blockers: catalog
        .filter((entry) => entry.latestRun?.blockerKind)
        .map((entry) => ({
          platform: entry.slug,
          blockerKind: entry.latestRun?.blockerKind ?? null,
        })),
      platforms: health.data.map((h) => ({
        platform: h.platform,
        status: h.status,
        lastRunAt: h.lastRunAt,
      })),
      catalog: catalog.map((entry: PlatformCatalogEntryView) => ({
        slug: entry.slug,
        displayName: entry.displayName,
        adapterKind: entry.adapterKind,
        configured: Boolean(entry.config),
        currentStep: entry.latestRun?.currentStep ?? null,
        blockerKind: entry.latestRun?.blockerKind ?? null,
      })),
    },
  };
}
