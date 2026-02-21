"use client";

import { usePathname } from "next/navigation";
import { JobListItem } from "@/components/job-list-item";
import { ScrollArea } from "@/components/ui/scroll-area";

interface SidebarJob {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  workArrangement: string | null;
  contractType: string | null;
}

interface OpdrachtenSidebarProps {
  jobs: SidebarJob[];
  totalCount: number;
}

export function OpdrachtenSidebar({ jobs, totalCount }: OpdrachtenSidebarProps) {
  const pathname = usePathname();

  // Extract the active job ID from the pathname
  const match = pathname.match(/^\/opdrachten\/(.+)$/);
  const activeId = match?.[1] ?? null;

  return (
    <aside className="w-[300px] border-r border-[#2d2d2d] bg-[#171717] shrink-0 hidden lg:flex lg:flex-col">
      <div className="px-4 py-3 border-b border-[#2d2d2d] shrink-0">
        <p className="text-xs font-medium text-[#6b6b6b] uppercase tracking-wider">
          {totalCount} opdrachten
        </p>
      </div>
      <ScrollArea className="flex-1">
        {jobs.map((job) => (
          <JobListItem
            key={job.id}
            job={job}
            isActive={job.id === activeId}
          />
        ))}
      </ScrollArea>
    </aside>
  );
}
