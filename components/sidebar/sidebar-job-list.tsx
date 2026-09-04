"use client";

/**
 * Job list with ScrollArea, supporting both compact (dark) and overview (card) variants.
 */
import { JobListItem } from "@/components/job-list-item";
import { VirtualList } from "@/components/shared/virtual-list";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SidebarJob } from "./sidebar-types";

interface SidebarJobListProps {
  jobs: SidebarJob[];
  activeId: string | null;
  buildDetailHref: (jobId: string) => string;
  variant: "compact" | "overview";
  /** These rows belong to the previous query; a newer one is still in flight. */
  isStale?: boolean;
}

const VIRTUALIZATION_THRESHOLD = 18;
const COMPACT_ITEM_ESTIMATE = 112;
const OVERVIEW_ITEM_ESTIMATE = 252;

export function SidebarJobList({
  jobs,
  activeId,
  buildDetailHref,
  variant,
  isStale = false,
}: SidebarJobListProps) {
  const shouldVirtualize = jobs.length > VIRTUALIZATION_THRESHOLD;
  // Dim rather than blank: keeping the rows avoids the layout collapse the
  // placeholder exists to prevent, while no longer presenting them as answers
  // to the query the user just typed.
  const staleClass = isStale ? " opacity-50 transition-opacity duration-150" : "";

  const renderJob = (job: SidebarJob, index?: number) => (
    <JobListItem
      key={job.id}
      job={job}
      isActive={job.id === activeId}
      variant={variant === "overview" ? "card" : "compact"}
      priority={index != null && index < 3}
      hasPipeline={job.hasPipeline}
      pipelineCount={job.pipelineCount}
      href={buildDetailHref(job.id)}
    />
  );

  if (shouldVirtualize) {
    return (
      <VirtualList
        items={jobs}
        getItemKey={(job) => job.id}
        estimateSize={() =>
          variant === "overview" ? OVERVIEW_ITEM_ESTIMATE : COMPACT_ITEM_ESTIMATE
        }
        gap={variant === "overview" ? 16 : 0}
        // Compact (detail-page) sidebar scrolls as one column → virtualize against
        // the parent aside. Overview keeps its own bounded scroll inside the list column.
        scrollMode={variant === "compact" ? "parent" : "self"}
        className={`${variant === "compact" ? "bg-[#050506]" : "min-w-0"}${staleClass}`}
        renderItem={(job, index) => renderJob(job, index)}
      />
    );
  }

  if (variant === "compact") {
    // Compact sidebar already scrolls at the aside level — render a plain
    // container so we don't introduce a nested scroll region inside it.
    return (
      <div aria-busy={isStale} className={`bg-[#050506]${staleClass}`}>
        {jobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-white/45">Geen vacatures gevonden</div>
        ) : (
          jobs.map((job, index) => renderJob(job, index))
        )}
      </div>
    );
  }

  return (
    <ScrollArea aria-busy={isStale} className={`min-h-0 min-w-0 flex-1${staleClass}`}>
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted-foreground">
          Geen vacatures gevonden voor deze filters.
        </div>
      ) : (
        <div className="space-y-3 pb-4 sm:space-y-4">
          {jobs.map((job, index) => renderJob(job, index))}
        </div>
      )}
    </ScrollArea>
  );
}
