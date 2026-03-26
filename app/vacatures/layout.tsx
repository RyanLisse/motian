import { OpdrachtenLayoutShell } from "@/components/opdrachten-layout-shell";
import { OpdrachtenSidebar } from "@/components/opdrachten-sidebar";
import { DEFAULT_OPDRACHTEN_LIMIT } from "@/src/lib/opdrachten-filters";
import { listJobsPage } from "@/src/services/jobs/page-query";
import { getSidebarMetadata, refreshSidebarMetadata } from "@/src/services/sidebar-metadata";

export const revalidate = 60;

export default async function OpdrachtenLayout({ children }: { children: React.ReactNode }) {
  const [metadata, { data: sidebarJobs }] = await Promise.all([
    getSidebarMetadata().then((cached) => cached ?? refreshSidebarMetadata()),
    listJobsPage({ limit: DEFAULT_OPDRACHTEN_LIMIT, status: "open" }),
  ]);

  return (
    <OpdrachtenLayoutShell
      sidebar={
        <OpdrachtenSidebar
          jobs={sidebarJobs}
          totalCount={metadata.totalCount}
          platforms={metadata.platforms}
          endClients={metadata.endClients}
          categories={metadata.categories}
          skillOptions={metadata.skillOptions}
          skillEmptyText={metadata.skillEmptyText}
        />
      }
    >
      {children}
    </OpdrachtenLayoutShell>
  );
}
