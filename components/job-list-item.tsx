import { Bookmark, Clock, LoaderCircle, MapPin, Users } from "lucide-react";
import Link from "next/link";
import { memo } from "react";
import { CompanyLogo } from "@/components/company-logo";
import { DroppableVacancy } from "@/components/droppable-vacancy";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const DAY_IN_MS = 24 * 60 * 60 * 1000;

interface JobListItemProps {
  job: {
    id: string;
    title: string;
    company: string | null;
    companyLogoUrl?: string | null;
    location: string | null;
    platform: string;
    workArrangement: string | null;
    contractType: string | null;
    applicationDeadline?: Date | string | null;
    isIndexing?: boolean;
  };
  isActive: boolean;
  variant?: "compact" | "card";
  /** Hint that the image is above the fold and should be loaded eagerly */
  priority?: boolean;
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

const arrangementSentence: Record<string, string> = {
  hybride: "Hybride werken",
  op_locatie: "Op locatie",
  remote: "Thuiswerken",
};

function formatLocationSentence(
  workArrangement: string | null,
  location: string | null,
): string | null {
  const prefix = workArrangement ? arrangementSentence[workArrangement] : null;
  if (prefix && location) return `${prefix} in ${location}`;
  if (prefix) return prefix;
  if (location) return location;
  return null;
}

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

export const JobListItem = memo(function JobListItem({
  job,
  isActive,
  variant = "compact",
  priority,
  pipelineCount,
  hasPipeline,
  href,
}: JobListItemProps) {
  const detailHref = href ?? `/vacatures/${job.id}`;
  const deadlineMeta = getDeadlineMeta(job.applicationDeadline);
  const hasLinkedWorkflow = hasPipeline ?? (pipelineCount ?? 0) > 0;
  const hasActivePipeline = (pipelineCount ?? 0) > 0;
  const actionLabel = hasLinkedWorkflow
    ? hasActivePipeline
      ? "Open shortlist"
      : "Open workflow"
    : "Bekijk en koppel";

  if (variant === "card") {
    const locationSentence = formatLocationSentence(job.workArrangement, job.location);
    return (
      <DroppableVacancy jobId={job.id} jobTitle={job.title}>
        <Link href={detailHref} className="block min-w-0">
          <article
            className={cn(
              "w-full min-w-0 overflow-hidden rounded-2xl border border-border/80 bg-card px-5 py-4 shadow-sm transition-all hover:border-primary/40 hover:shadow-md sm:px-6 sm:py-5",
              isActive && "border-primary/70 ring-2 ring-primary/20",
            )}
          >
            <div className="mb-3 flex items-start justify-between gap-3">
              <Badge
                variant="outline"
                className="rounded-md border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-semibold text-primary"
              >
                Eenvoudig solliciteren
              </Badge>
              <span
                aria-hidden="true"
                className="inline-flex h-8 w-8 items-center justify-center rounded-md text-muted-foreground hover:bg-muted hover:text-foreground"
              >
                <Bookmark className="h-4 w-4" />
              </span>
            </div>

            <div className="flex min-w-0 items-start gap-3">
              <div className="hidden sm:block">
                <CompanyLogo
                  src={job.companyLogoUrl}
                  companyName={job.company}
                  size={44}
                  sizes="44px"
                  priority={priority}
                  blur
                />
              </div>
              <div className="min-w-0 flex-1">
                <h3 className="text-[17px] font-semibold leading-snug text-foreground line-clamp-2 wrap-break-word sm:text-lg">
                  {job.title}
                </h3>
                <p className="mt-1.5 text-sm text-muted-foreground">{job.company || "Onbekend"}</p>
                {locationSentence ? (
                  <p className="mt-1 text-sm text-muted-foreground">{locationSentence}</p>
                ) : null}
              </div>
            </div>

            <div className="mt-4 flex flex-wrap items-center gap-2">
              {job.contractType ? (
                <Badge
                  variant="outline"
                  className="rounded-md border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground"
                >
                  {contractLabels[job.contractType] ?? job.contractType}
                </Badge>
              ) : null}
              {job.workArrangement ? (
                <Badge
                  variant="outline"
                  className={cn(
                    "rounded-md border-border bg-muted/40 px-2.5 py-1 text-[11px] font-medium text-foreground",
                    job.workArrangement === "remote" &&
                      "border-primary/30 bg-primary/10 text-primary",
                  )}
                >
                  {arrangementLabels[job.workArrangement] ?? job.workArrangement}
                </Badge>
              ) : null}
              {deadlineMeta ? (
                <Badge
                  variant="outline"
                  className={cn("gap-1 rounded-md px-2.5 py-1 text-[11px]", deadlineMeta.className)}
                >
                  <Clock className="h-3 w-3 shrink-0" />
                  {deadlineMeta.label}
                </Badge>
              ) : null}
              <Badge
                variant="outline"
                className="rounded-md border-border bg-background px-2.5 py-1 text-[11px] font-medium capitalize text-muted-foreground"
              >
                {job.platform}
              </Badge>
              {hasLinkedWorkflow ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 rounded-md border-primary/20 bg-primary/10 px-2.5 py-1 text-[11px] font-medium text-primary"
                >
                  <Users className="h-3 w-3" />
                  {hasActivePipeline ? `${pipelineCount} in pipeline` : "Workflow gekoppeld"}
                </Badge>
              ) : null}
              {job.isIndexing ? (
                <Badge
                  variant="outline"
                  className="flex items-center gap-1 rounded-md border-amber-500/20 bg-amber-500/10 px-2.5 py-1 text-[11px] font-medium text-amber-700 dark:text-amber-300"
                >
                  <LoaderCircle className="h-3 w-3 animate-spin" />
                  Indexeren…
                </Badge>
              ) : null}
            </div>

            <span className="sr-only">{actionLabel}</span>
          </article>
        </Link>
      </DroppableVacancy>
    );
  }

  return (
    <DroppableVacancy jobId={job.id} jobTitle={job.title}>
      <Link href={detailHref} className="block min-w-0">
        <div
          className={cn(
            "min-w-0 overflow-hidden border-b border-border px-4 py-3 transition-colors cursor-pointer hover:bg-card",
            isActive && "bg-card border-l-[3px] border-l-primary",
          )}
        >
          <div className="mb-1.5 flex min-w-0 items-start gap-2.5">
            <CompanyLogo
              src={job.companyLogoUrl}
              companyName={job.company}
              size={32}
              sizes="32px"
              priority={priority}
              blur
              className="rounded-md"
              imageClassName="p-1"
            />
            <div className="min-w-0">
              <h4 className="mb-1 text-[13px] font-semibold leading-snug text-foreground line-clamp-2 wrap-break-word">
                {job.title}
              </h4>
              <p className="max-w-full whitespace-normal wrap-break-word text-xs text-muted-foreground">
                {job.company || "Onbekend"}
              </p>
            </div>
          </div>
          {job.location && (
            <p className="mb-1.5 flex min-w-0 items-start gap-1 text-xs text-muted-foreground">
              <MapPin className="h-3 w-3 shrink-0" />
              <span className="max-w-full whitespace-normal wrap-break-word">{job.location}</span>
            </p>
          )}
          <div className="flex items-center gap-1.5 flex-wrap">
            <Badge
              variant="outline"
              className="text-[9px] px-1.5 py-0 h-4 border-border text-muted-foreground bg-transparent capitalize"
            >
              {job.platform}
            </Badge>
            {job.isIndexing ? (
              <Badge
                variant="outline"
                className="flex items-center gap-0.5 border-amber-500/20 bg-amber-500/10 px-1.5 py-0 text-[9px] text-amber-700 dark:text-amber-300"
              >
                <LoaderCircle className="h-2.5 w-2.5 animate-spin" />
                Indexeren
              </Badge>
            ) : null}
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
});
