"use client";

import { useCallback, useMemo, useState } from "react";
/**
 * Job list with ScrollArea, supporting both compact (dark) and overview (card) variants.
 */
import { JobListItem } from "@/components/job-list-item";
import { ScrollArea } from "@/components/ui/scroll-area";
import { useIsMobile } from "@/hooks/use-mobile";
import type { SidebarJob } from "./sidebar-types";

interface SidebarJobListProps {
  jobs: SidebarJob[];
  activeId: string | null;
  buildDetailHref: (jobId: string) => string;
  variant: "compact" | "overview";
}

const COMPACT_ITEM_HEIGHT = 110;
const OVERVIEW_ITEM_HEIGHT = 260;
const OVERSCAN = 6;

function MobileVirtualizedJobList({
  jobs,
  activeId,
  buildDetailHref,
  variant,
}: SidebarJobListProps) {
  const itemHeight = variant === "compact" ? COMPACT_ITEM_HEIGHT : OVERVIEW_ITEM_HEIGHT;
  const [scrollTop, setScrollTop] = useState(0);
  const [viewportHeight, setViewportHeight] = useState(0);

  const onScroll = useCallback((event: React.UIEvent<HTMLDivElement>) => {
    const target = event.currentTarget;
    setScrollTop(target.scrollTop);
    setViewportHeight(target.clientHeight);
  }, []);

  const { topOffset, visibleJobs } = useMemo(() => {
    const firstVisible = Math.floor(scrollTop / itemHeight);
    const visibleCount = Math.ceil((viewportHeight || itemHeight) / itemHeight);
    const start = Math.max(0, firstVisible - OVERSCAN);
    const end = Math.min(jobs.length, firstVisible + visibleCount + OVERSCAN);

    return {
      topOffset: start * itemHeight,
      visibleJobs: jobs.slice(start, end),
    };
  }, [jobs, itemHeight, scrollTop, viewportHeight]);

  const totalHeight = jobs.length * itemHeight;
  const wrapperClassName =
    variant === "compact"
      ? "min-h-0 flex-1 overflow-y-auto bg-[#050506]"
      : "min-h-0 flex-1 overflow-y-auto";

  return (
    <div className={wrapperClassName} onScroll={onScroll}>
      <div style={{ height: totalHeight, position: "relative" }}>
        <div style={{ transform: `translateY(${topOffset}px)` }}>
          {visibleJobs.map((job) => (
            <JobListItem
              key={job.id}
              job={job}
              isActive={job.id === activeId}
              variant={variant === "overview" ? "card" : "compact"}
              hasPipeline={job.hasPipeline}
              pipelineCount={job.pipelineCount}
              href={buildDetailHref(job.id)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}

export function SidebarJobList({ jobs, activeId, buildDetailHref, variant }: SidebarJobListProps) {
  const isMobile = useIsMobile();

  if (isMobile && jobs.length > 18) {
    return (
      <MobileVirtualizedJobList
        jobs={jobs}
        activeId={activeId}
        buildDetailHref={buildDetailHref}
        variant={variant}
      />
    );
  }

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
