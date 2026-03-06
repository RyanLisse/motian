import { AlertTriangle, Building2, Calendar, Clock, Euro, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { Badge } from "@/components/ui/badge";

interface JobCardProps {
  job: {
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    platform: string;
    contractType: string | null;
    workArrangement: string | null;
    rateMin: number | null;
    rateMax: number | null;
    applicationDeadline: Date | null;
    postedAt: Date | null;
  };
  /** Number of candidates in pipeline for this job */
  pipelineCount?: number;
}

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

export function JobCard({ job, pipelineCount }: JobCardProps) {
  // Deadline urgency: within 3 days = urgent
  const deadlineUrgent =
    job.applicationDeadline &&
    new Date(job.applicationDeadline).getTime() - Date.now() < 3 * 24 * 60 * 60 * 1000 &&
    new Date(job.applicationDeadline).getTime() > Date.now();

  return (
    <Link href={`/opdrachten/${job.id}`}>
      <div
        className={`bg-card border rounded-lg p-4 hover:border-primary/40 hover:bg-accent transition-colors cursor-pointer ${deadlineUrgent ? "border-orange-400/60" : "border-border"}`}
      >
        <div className="flex items-start justify-between gap-2 mb-3">
          <h3 className="text-sm font-semibold text-foreground line-clamp-2 leading-snug">
            {job.title}
          </h3>
          <div className="flex items-center gap-1.5 shrink-0">
            {pipelineCount != null && pipelineCount > 0 && (
              <Badge
                variant="outline"
                className="text-[10px] bg-primary/10 text-primary border-primary/20 flex items-center gap-0.5"
              >
                <Users className="h-2.5 w-2.5" />
                {pipelineCount}
              </Badge>
            )}
            <Badge
              variant="outline"
              className="text-[10px] capitalize border-border text-muted-foreground bg-transparent"
            >
              {job.platform}
            </Badge>
          </div>
        </div>

        <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-3">
          {job.company && (
            <span className="flex items-center gap-1.5">
              <Building2 className="h-3.5 w-3.5" />
              {job.company}
            </span>
          )}
          {job.location && (
            <span className="flex items-center gap-1.5">
              <MapPin className="h-3.5 w-3.5" />
              {job.location}
            </span>
          )}
          {(job.rateMin || job.rateMax) && (
            <span className="flex items-center gap-1.5">
              <Euro className="h-3.5 w-3.5" />
              {job.rateMin && job.rateMax
                ? `${job.rateMin} - ${job.rateMax}/uur`
                : job.rateMax
                  ? `max ${job.rateMax}/uur`
                  : `min ${job.rateMin}/uur`}
            </span>
          )}
        </div>

        <div className="flex items-center gap-2 flex-wrap mb-2">
          {job.workArrangement && (
            <Badge
              variant="outline"
              className={
                job.workArrangement === "remote"
                  ? "bg-primary/10 text-primary border-primary/20 text-[10px]"
                  : "text-[10px] border-border text-muted-foreground bg-transparent"
              }
            >
              {arrangementLabels[job.workArrangement] ?? job.workArrangement}
            </Badge>
          )}
          {job.contractType && (
            <Badge
              variant="outline"
              className="text-[10px] border-border text-muted-foreground capitalize bg-transparent"
            >
              {job.contractType}
            </Badge>
          )}
        </div>

        <div className="flex items-center gap-4 text-xs text-muted-foreground pt-1">
          {job.applicationDeadline && (
            <span
              className={`flex items-center gap-1 ${deadlineUrgent ? "text-orange-600 font-medium" : ""}`}
            >
              {deadlineUrgent ? (
                <AlertTriangle className="h-3 w-3" />
              ) : (
                <Clock className="h-3 w-3" />
              )}
              Sluit{" "}
              {new Date(job.applicationDeadline).toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
          {job.postedAt && (
            <span className="flex items-center gap-1">
              <Calendar className="h-3 w-3" />
              {new Date(job.postedAt).toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "short",
              })}
            </span>
          )}
        </div>
      </div>
    </Link>
  );
}
