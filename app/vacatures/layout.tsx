import { Suspense } from "react";
import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { Skeleton } from "@/components/ui/skeleton";
import { DEFAULT_OPDRACHTEN_LIMIT } from "@/src/lib/opdrachten-filters";
import { listJobsPage } from "@/src/services/jobs/page-query";
import { getSidebarMetadata, refreshSidebarMetadata } from "@/src/services/sidebar-metadata";

export const revalidate = 60;
export const maxDuration = 30;

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
        {Array.from({ length: 8 }).map((_, i) => (
          // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
          <Skeleton key={`job-${i}`} className="h-20 rounded-lg bg-card" />
        ))}
      </div>
    </div>
  );
}

async function SidebarContent() {
  // Load only 20 jobs for the initial sidebar render (user sees ~8 at once).
  // The client fetches more on scroll/filter via the /api/vacatures/zoeken endpoint.
  const SIDEBAR_INITIAL_LIMIT = 20;

  const metadata = await getSidebarMetadata().then(
    (cached) => cached ?? refreshSidebarMetadata(),
  );
  // Pass knownTotal from precomputed metadata to skip the COUNT(*) query
  const { data: sidebarJobs } = await listJobsPage({
    limit: SIDEBAR_INITIAL_LIMIT,
    status: "open",
    knownTotal: metadata.totalCount,
  });

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
