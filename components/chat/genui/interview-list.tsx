"use client";
import { Calendar, Clock, MapPin, Video } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { formatDateTime, getToolErrorMessage, isToolError } from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

type InterviewItem = {
  id: string;
  applicationId?: string | null;
  scheduledAt?: string | Date | null;
  type?: string | null;
  interviewer?: string | null;
  status?: string | null;
  location?: string | null;
};

type InterviewListOutput = { total: number; interviews: InterviewItem[] };

function isInterviewList(o: unknown): o is InterviewListOutput {
  return (
    typeof o === "object" &&
    o !== null &&
    "interviews" in o &&
    Array.isArray((o as InterviewListOutput).interviews)
  );
}

const typeLabels: Record<string, string> = {
  phone: "Telefonisch",
  video: "Video",
  onsite: "Op locatie",
  technical: "Technisch",
  hr: "HR",
  final: "Eindgesprek",
};

const statusLabels: Record<string, string> = {
  scheduled: "Gepland",
  completed: "Afgerond",
  cancelled: "Geannuleerd",
  no_show: "Niet verschenen",
  rescheduled: "Verplaatst",
};

const statusColors: Record<string, string> = {
  scheduled: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  completed: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  cancelled: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  no_show: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  rescheduled: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
};

function typeIcon(type: string | null | undefined) {
  if (type === "video") return <Video className="h-3.5 w-3.5 text-muted-foreground" />;
  return <Clock className="h-3.5 w-3.5 text-muted-foreground" />;
}

export function InterviewListCard({ output }: { output: unknown }) {
  const [showAll, setShowAll] = useState(false);

  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Interviews niet gevonden")} />;
  if (!isInterviewList(output)) return null;
  if (output.interviews.length === 0) {
    return (
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Calendar className="h-4 w-4" />
          <span>Geen interviews gevonden</span>
        </div>
      </div>
    );
  }

  const MAX_VISIBLE = 5;
  const visible = showAll ? output.interviews : output.interviews.slice(0, MAX_VISIBLE);
  const hasMore = output.interviews.length > MAX_VISIBLE;

  return (
    <div className="my-1.5 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Calendar className="h-3.5 w-3.5" />
        <span>
          {output.total} interview{output.total !== 1 ? "s" : ""} gevonden
        </span>
      </div>
      <div className="space-y-1.5">
        {visible.map((item) => (
          <Link key={item.id} href={`/interviews/${item.id}`}>
            <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  {typeIcon(item.type)}
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2">
                      {item.type && (
                        <span className="text-xs font-medium text-foreground">
                          {typeLabels[item.type] ?? item.type}
                        </span>
                      )}
                      {item.status && (
                        <span
                          className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[item.status] ?? statusColors.scheduled}`}
                        >
                          {statusLabels[item.status] ?? item.status}
                        </span>
                      )}
                    </div>
                    {(() => {
                      const dt = formatDateTime(item.scheduledAt);
                      return dt ? (
                        <span className="text-[10px] text-muted-foreground whitespace-nowrap">
                          {dt}
                        </span>
                      ) : null;
                    })()}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {item.interviewer && (
                      <span className="text-xs text-muted-foreground">{item.interviewer}</span>
                    )}
                    {item.location && (
                      <span className="text-xs text-muted-foreground flex items-center gap-1">
                        <MapPin className="h-2.5 w-2.5" />
                        {item.location}
                      </span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-primary hover:underline"
        >
          + {output.interviews.length - MAX_VISIBLE} meer tonen
        </button>
      )}
    </div>
  );
}
