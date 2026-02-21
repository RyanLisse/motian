import Link from "next/link";
import { cn } from "@/lib/utils";
import { MapPin } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    <Link href={`/opdrachten/${job.id}`}>
      <div
        className={cn(
          "px-4 py-3 border-b border-[#2d2d2d] hover:bg-[#1e1e1e] transition-colors cursor-pointer",
          isActive && "bg-[#1e1e1e] border-l-[3px] border-l-[#10a37f]"
        )}
      >
        <h4 className="text-[13px] font-semibold text-[#ececec] line-clamp-2 leading-snug mb-1">
          {job.title}
        </h4>
        <p className="text-xs text-[#8e8e8e] mb-1.5">
          {job.company || "Onbekend"}
        </p>
        {job.location && (
          <p className="text-xs text-[#6b6b6b] flex items-center gap-1 mb-1.5">
            <MapPin className="h-3 w-3 shrink-0" />
            <span className="truncate">{job.location}</span>
          </p>
        )}
        <div className="flex items-center gap-1.5 flex-wrap">
          <Badge
            variant="outline"
            className="text-[9px] px-1.5 py-0 h-4 border-[#2d2d2d] text-[#6b6b6b] bg-transparent capitalize"
          >
            {job.platform}
          </Badge>
          {job.workArrangement && (
            <Badge
              variant="outline"
              className={cn(
                "text-[9px] px-1.5 py-0 h-4 bg-transparent",
                job.workArrangement === "remote"
                  ? "border-[#10a37f]/30 text-[#10a37f]"
                  : "border-[#2d2d2d] text-[#6b6b6b]"
              )}
            >
              {arrangementLabels[job.workArrangement] ?? job.workArrangement}
            </Badge>
          )}
        </div>
      </div>
    </Link>
  );
}
