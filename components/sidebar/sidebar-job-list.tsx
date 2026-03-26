"use client";

/**
 * Job list with ScrollArea, supporting both compact (dark) and overview (card) variants.
 */
import { JobListItem } from "@/components/job-list-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import type { SidebarJob } from "./sidebar-types";

interface SidebarJobListProps {
  jobs: SidebarJob[];
  activeId: string | null;
  buildDetailHref: (jobId: string) => string;
  variant: "compact" | "overview";
}

export function SidebarJobList({ jobs, activeId, buildDetailHref, variant }: SidebarJobListProps) {
  if (variant === "compact") {
    return (
      <ScrollArea className="min-h-0 flex-1 bg-[#050506]">
        {jobs.length === 0 ? (
          <div className="px-4 py-8 text-center text-sm text-white/45">Geen vacatures gevonden</div>
        ) : (
          jobs.map((job) => (
            <JobListItem
              key={job.id}
              job={job}
              isActive={job.id === activeId}
              hasPipeline={job.hasPipeline}
              pipelineCount={job.pipelineCount}
              href={buildDetailHref(job.id)}
            />
          ))
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
        <div className="space-y-3 pb-4 sm:space-y-4">
          {jobs.map((job) => (
            <JobListItem
              key={job.id}
              job={job}
              isActive={job.id === activeId}
              variant="card"
              hasPipeline={job.hasPipeline}
              pipelineCount={job.pipelineCount}
              href={buildDetailHref(job.id)}
            />
          ))}
        </div>
      )}
    </ScrollArea>
  );
}
