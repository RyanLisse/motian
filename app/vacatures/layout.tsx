import { unstable_cache } from "next/cache";
import { Suspense } from "react";
import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import type { OpdrachtenSidebarProps } from "@/components/sidebar/sidebar-types";
import { Skeleton } from "@/components/ui/skeleton";
import { listJobsPage } from "@/src/services/jobs/page-query";
import { getSidebarMetadata, refreshSidebarMetadata } from "@/src/services/sidebar-metadata";

export const dynamic = "force-dynamic";
export const maxDuration = 30;

const SIDEBAR_INITIAL_LIMIT = 12;

const getCachedSidebarInitialJobs = unstable_cache(
  async (knownTotal: number) =>
    listJobsPage({
      limit: SIDEBAR_INITIAL_LIMIT,
      status: "open",
      knownTotal,
    }),
  ["vacatures-sidebar-initial-jobs", "v1"],
  { revalidate: 60 },
);

const EMPTY_SIDEBAR_METADATA: Omit<OpdrachtenSidebarProps, "jobs"> = {
  totalCount: 0,
  platforms: [],
  endClients: [],
  categories: [],
  skillOptions: [],
  skillEmptyText: "Filters tijdelijk niet beschikbaar.",
};

function SidebarSkeleton() {
  return (
    <div className="flex h-full flex-col space-y-3 p-3">
      <Skeleton className="h-9 w-full rounded-lg bg-muted" />
      <div className="flex flex-wrap gap-2">
        {Array.from({ length: 4 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`filter-${i}`} className="h-7 w-20 rounded-md bg-muted" />
        ))}
      </div>
      <Skeleton className="h-4 w-32 bg-muted" />
      <div className="flex-1 space-y-2">
        {Array.from({ length: 5 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`job-${i}`} className="h-20 rounded-lg bg-card" />
        ))}
      </div>
    </div>
  );
}

async function SidebarContent() {
  const metadata = await getSidebarMetadata()
    .then((cached) => cached ?? refreshSidebarMetadata())
    .catch((error) => {
      console.error("[VacaturesLayout] Sidebar metadata unavailable, using empty fallback:", error);
      return EMPTY_SIDEBAR_METADATA;
    });
  // Pass knownTotal from precomputed metadata to skip the COUNT(*) query
  const { data: sidebarJobs } = await getCachedSidebarInitialJobs(metadata.totalCount).catch(
    (error) => {
      console.error("[VacaturesLayout] Sidebar jobs unavailable, using empty fallback:", error);
      return { data: [], total: metadata.totalCount };
    },
  );

  return (
    <OpdrachtenSidebar
      jobs={sidebarJobs}
      totalCount={metadata.totalCount}
      platforms={metadata.platforms}
      endClients={metadata.endClients}
      categories={metadata.categories}
      skillOptions={metadata.skillOptions}
      skillEmptyText={metadata.skillEmptyText}
    />
  );
}

export default function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
  return (
    <OpdrachtenLayoutShell
      sidebar={
        <Suspense fallback={<SidebarSkeleton />}>
          <SidebarContent />
        </Suspense>
      }
    >
      {children}
    </OpdrachtenLayoutShell>
  );
}
