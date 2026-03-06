"use client";

import { Calendar, MapPin } from "lucide-react";
import { useState } from "react";

type ExperienceEntry = {
  title?: string;
  company?: string;
  period?: { start?: string; end?: string };
  responsibilities?: string[];
  duration?: string;
  location?: string;
};

function formatPeriod(entry: ExperienceEntry): string {
  if (entry.period?.start && entry.period?.end) {
    const start = entry.period.start.replace(/-/g, ".");
    const end = entry.period.end === "heden" ? "heden" : entry.period.end.replace(/-/g, ".");
    return `${start} – ${end}`;
  }
  if (entry.duration) return entry.duration;
  return "";
}

export function EmploymentCard({ entry, location }: { entry: ExperienceEntry; location?: string }) {
  const [expanded, setExpanded] = useState(false);
  const responsibilities = entry.responsibilities ?? [];
  const hasMore = responsibilities.length > 1;
  const firstResp = responsibilities[0] ?? "";
  const rest = responsibilities.slice(1);

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="font-semibold text-foreground">{entry.company ?? "—"}</p>
      <p className="text-sm text-muted-foreground mt-0.5">{entry.title ?? "—"}</p>
      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 mt-2 text-xs text-muted-foreground">
        {location && (
          <span className="flex items-center gap-1">
            <MapPin className="h-3 w-3 shrink-0" />
            {location}
          </span>
        )}
        {formatPeriod(entry) && (
          <span className="flex items-center gap-1">
            <Calendar className="h-3 w-3 shrink-0" />
            {formatPeriod(entry)}
          </span>
        )}
      </div>
      {firstResp && (
        <div className="mt-3">
          <p className="text-sm text-muted-foreground">
            {expanded ? responsibilities.join(" ") : firstResp}
            {!expanded && rest.length > 0 && "…"}
          </p>
          {hasMore && (
            <button
              type="button"
              onClick={() => setExpanded(!expanded)}
              className="mt-2 text-sm font-medium text-primary hover:underline"
            >
              {expanded ? "Lees minder" : "Lees meer…"}
            </button>
          )}
        </div>
      )}
    </div>
  );
}
