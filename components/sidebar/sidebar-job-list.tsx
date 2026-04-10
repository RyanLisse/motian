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
}

const VIRTUALIZATION_THRESHOLD = 18;
const COMPACT_ITEM_ESTIMATE = 112;
const OVERVIEW_ITEM_ESTIMATE = 252;

export function SidebarJobList({ jobs, activeId, buildDetailHref, variant }: SidebarJobListProps) {
  const shouldVirtualize = jobs.length > VIRTUALIZATION_THRESHOLD;

  const renderJob = (job: SidebarJob) => (
    <JobListItem
      key={job.id}
      job={job}
      isActive={job.id === activeId}
      variant={variant === "overview" ? "card" : "compact"}
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
        scrollMode="self"
        className={variant === "compact" ? "bg-[#050506]" : "min-w-0"}
        renderItem={(job) => renderJob(job)}
      />
    );
  }

  if (variant === "compact") {
    return (
      <ScrollArea className="min-h-0 flex-1 bg-[#050506]">
        {jobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-white/45">Geen vacatures gevonden</div>
        ) : (
          jobs.map((job) => renderJob(job))
        )}
      </ScrollArea>
    );
  }

  return (
    <ScrollArea className="min-h-0 min-w-0 flex-1">
      {jobs.length === 0 ? (
        <div className="rounded-xl border border-dashed border-border bg-background px-5 py-10 text-center text-sm text-muted-foreground">
          Geen vacatures gevonden voor deze filters.
        </div>
      ) : (
        <div className="space-y-3 pb-4 sm:space-y-4">{jobs.map((job) => renderJob(job))}</div>
      )}
    </ScrollArea>
  );
}
