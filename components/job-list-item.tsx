import { ArrowRight, BriefcaseBusiness, Building2, Clock, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { DroppableVacancy } from "@/components/droppable-vacancy";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface JobListItemProps {
  job: {
    id: string;
    title: string;
    company: string | null;
    location: string | null;
    platform: string;
    workArrangement: string | null;
    contractType: string | null;
    applicationDeadline?: Date | string | null;
  };
  isActive: boolean;
  variant?: "compact" | "card";
  /** Number of candidates in pipeline for this job */
  pipelineCount?: number;
  /** Whether this job already has workflow history, even when no active pipeline remains */
  hasPipeline?: boolean;
  href?: string;
}

const arrangementLabels: Record<string, string> = {
  hybride: "Hybride",
  op_locatie: "Op locatie",
  remote: "Remote",
};

const contractLabels: Record<string, string> = {
  freelance: "Freelance",
  interim: "Interim",
  vast: "Vast",
  opdracht: "Opdracht",
};

function getDeadlineMeta(deadline?: Date | string | null) {
  if (!deadline) return null;

  const parsedDeadline = new Date(deadline);
  if (Number.isNaN(parsedDeadline.getTime())) return null;

  const deadlineDay = new Date(parsedDeadline);
  deadlineDay.setHours(0, 0, 0, 0);
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const remainingDays = Math.round((deadlineDay.getTime() - today.getTime()) / DAY_IN_MS);
  const formattedDate = parsedDeadline.toLocaleDateString("nl-NL", {
    day: "numeric",
    month: "short",
  });

  if (remainingDays < 0) {
    return {
      label: "Deadline verlopen",
      compactLabel: "Verlopen",
      className: "border-destructive/20 bg-destructive/10 text-destructive",
    };
  }

  if (remainingDays === 0) {
    return {
      label: "Sluit vandaag",
      compactLabel: "Vandaag",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (remainingDays === 1) {
    return {
      label: "Sluit morgen",
      compactLabel: "Morgen",
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  if (remainingDays <= 3) {
    return {
      label: `Nog ${remainingDays} dagen`,
      compactLabel: `${remainingDays} d`,
      className: "border-amber-500/20 bg-amber-500/10 text-amber-700 dark:text-amber-300",
    };
  }

  return {
    label: `Deadline ${formattedDate}`,
    compactLabel: formattedDate,
    className: "border-border bg-background text-muted-foreground",
  };
}

export function JobListItem({
  job,
  isActive,
  variant = "compact",
  pipelineCount,
  hasPipeline,
  href,
}: JobListItemProps) {
  const detailHref = href ?? `/opdrachten/${job.id}`;
  const deadlineMeta = getDeadlineMeta(job.applicationDeadline);
  const hasLinkedWorkflow = hasPipeline ?? (pipelineCount ?? 0) > 0;
  const hasActivePipeline = (pipelineCount ?? 0) > 0;
  const actionLabel = hasLinkedWorkflow
    ? hasActivePipeline
      ? "Open shortlist"
      : "Open workflow"
    : "Bekijk en koppel";

  if (variant === "card") {
    return (
      <DroppableVacancy jobId={job.id} jobTitle={job.title}>
        <Link href={detailHref}>
          <article
            className={cn(
              "rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md",
              isActive && "border-primary/70 ring-2 ring-primary/20",
            )}
          >
            <div className="flex items-start justify-between gap-4">
              <div className="min-w-0">
                <h3 className="text-lg font-semibold text-foreground leading-tight line-clamp-2">
                  {job.title}
                </h3>
                <p className="mt-1 text-sm text-muted-foreground flex items-center gap-1.5">
                  <Building2 className="h-3.5 w-3.5 shrink-0" />
                  <span className="truncate">{job.company || "Onbekend"}</span>
                </p>
              </div>
              <div className="flex shrink-0 flex-col items-end gap-2">
                <span className="inline-flex items-center rounded-full border border-primary/30 bg-primary/10 px-3 py-1 text-xs font-medium capitalize text-primary">
                  {job.platform}
                </span>
                {deadlineMeta ? (
                  <Badge
                    variant="outline"
                    className={cn("gap-1 px-2 py-1 text-[10px]", deadlineMeta.className)}
                  >
                    <Clock className="h-3 w-3" />
                    {deadlineMeta.label}
                  </Badge>
                ) : null}
              </div>
            </div>

            <div className="mt-3 flex flex-wrap items-center gap-3 text-sm text-muted-foreground">
              {job.location && (
                <span className="inline-flex items-center gap-1.5">
                  <MapPin className="h-3.5 w-3.5 shrink-0" />
                  {job.location}
                </span>
              )}
              {job.workArrangement && (
                <span className="inline-flex items-center gap-1.5">
                  <BriefcaseBusiness className="h-3.5 w-3.5 shrink-0" />
                  {arrangementLabels[job.workArrangement] ?? job.workArrangement}
                </span>
              )}
            </div>

            <div className="mt-3 flex items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                {job.contractType && (
                  <Badge
                    variant="outline"
                    className="h-5 rounded-md border-border bg-background px-2 text-[10px] font-medium text-muted-foreground"
                  >
                    {contractLabels[job.contractType] ?? job.contractType}
                  </Badge>
                )}
                {hasLinkedWorkflow ? (
                  <Badge
                    variant="outline"
                    className="h-5 rounded-md bg-primary/10 text-primary border-primary/20 px-2 text-[10px] font-medium flex items-center gap-0.5"
                  >
                    <Users className="h-2.5 w-2.5" />
                    {hasActivePipeline ? `${pipelineCount} in de pipeline` : "Workflow gekoppeld"}
                  </Badge>
                ) : (
                  <Badge
                    variant="outline"
                    className="h-5 rounded-md border-dashed border-border bg-background px-2 text-[10px] font-medium text-muted-foreground"
                  >
                    Nog te koppelen
                  </Badge>
                )}
              </div>
              <span className="inline-flex items-center gap-1 text-sm font-medium text-primary">
                {actionLabel}
                <ArrowRight className="h-4 w-4" />
              </span>
            </div>
          </article>
        </Link>
      </DroppableVacancy>
    );
  }

  return (
    <DroppableVacancy jobId={job.id} jobTitle={job.title}>
      <Link href={detailHref}>
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
            {deadlineMeta && (
              <Badge
                variant="outline"
                className={cn("text-[9px] px-1.5 py-0 h-4 gap-0.5", deadlineMeta.className)}
              >
                <Clock className="h-2.5 w-2.5" />
                {deadlineMeta.compactLabel}
              </Badge>
            )}
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
            {hasLinkedWorkflow ? (
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 h-4 bg-primary/10 text-primary border-primary/20 flex items-center gap-0.5"
              >
                <Users className="h-2.5 w-2.5" />
                {hasActivePipeline ? pipelineCount : "Gekoppeld"}
              </Badge>
            ) : (
              <Badge
                variant="outline"
                className="text-[9px] px-1.5 py-0 h-4 border-dashed border-border text-muted-foreground bg-transparent"
              >
                Nog te koppelen
              </Badge>
            )}
          </div>
        </div>
      </Link>
    </DroppableVacancy>
  );
}
