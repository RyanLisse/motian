import { MapPin } from "lucide-react";
import Link from "next/link";
import { DroppableVacancy } from "@/components/droppable-vacancy";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

interface JobListItemProps {
  job: {
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    platform: string;
    workArrangement: string | null;
    contractType: string | null;
  };
  isActive: boolean;
}

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

export function JobListItem({ job, isActive }: JobListItemProps) {
  return (
    <DroppableVacancy jobId={job.id} jobTitle={job.title}>
      <Link href={`/opdrachten/${job.id}`}>
        <div
          className={cn(
            "px-4 py-3 border-b border-border hover:bg-card transition-colors cursor-pointer",
            isActive && "bg-card border-l-[3px] border-l-primary",
          )}
        >
          <h4 className="text-[13px] font-semibold text-foreground line-clamp-2 leading-snug mb-1">
            {job.title}
          </h4>
          <p className="text-xs text-muted-foreground mb-1.5">{job.company || "Onbekend"}</p>
          {job.location && (
            <p className="text-xs text-muted-foreground flex items-center gap-1 mb-1.5">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="truncate">{job.location}</span>
            </p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 border-border text-muted-foreground bg-transparent capitalize"
            >
              {job.platform}
            </Badge>
            {job.workArrangement && (
              <Badge
                variant="outline"
                className={cn(
                  "text-[9px] px-1.5 py-0 h-4 bg-transparent",
                  job.workArrangement === "remote"
                    ? "border-primary/30 text-primary"
                    : "border-border text-muted-foreground",
                )}
              >
                {arrangementLabels[job.workArrangement] ?? job.workArrangement}
              </Badge>
            )}
          </div>
        </div>
      </Link>
    </DroppableVacancy>
  );
}
