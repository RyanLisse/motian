"use client";

import { Calendar, MapPin } from "lucide-react";
import { useState } from "react";
import { cn } from "@/lib/utils";
import type { StructuredSkill } from "@/src/schemas/candidate-intelligence";

export type ExperienceEntry = {
  title?: string;
  company?: string;
  period?: { start?: string; end?: string };
  responsibilities?: string[];
  duration?: string;
  location?: string;
};

/** Skill linked to this employment, with its variant (hard/soft). */
export type LinkedSkill = StructuredSkill & { variant: "hard" | "soft" };

function formatPeriod(entry: ExperienceEntry): string {
  if (entry.period?.start && entry.period?.end) {
    const start = entry.period.start.replace(/-/g, ".");
    const end = entry.period.end === "heden" ? "heden" : entry.period.end.replace(/-/g, ".");
    return `${start} – ${end}`;
  }
  if (entry.duration) return entry.duration;
  return "";
}

interface EmploymentCardProps {
  entry: ExperienceEntry;
  location?: string;
  /** Skills linked to this employment via evidence matching */
  linkedSkills?: LinkedSkill[];
  /** Currently highlighted skill (from sidebar interaction) */
  activeSkill?: string | null;
  /** Highlight this card because it matches the active skill */
  isHighlighted?: boolean;
}

export function EmploymentCard({
  entry,
  location,
  linkedSkills = [],
  activeSkill,
  isHighlighted,
}: EmploymentCardProps) {
  const [expanded, setExpanded] = useState(false);
  const responsibilities = entry.responsibilities ?? [];
  const hasMore = responsibilities.length > 1;
  const firstResp = responsibilities[0] ?? "";
  const rest = responsibilities.slice(1);

  return (
    <div
      className={cn(
        "rounded-xl border bg-card p-4 transition-all",
        isHighlighted ? "border-primary/50 bg-primary/5 shadow-sm" : "border-border",
      )}
    >
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
      {/* Linked skills badges */}
      {linkedSkills.length > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5">
          {linkedSkills.map((skill) => (
            <span
              key={skill.name}
              className={cn(
                "inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium border transition-all",
                skill.variant === "hard"
                  ? "bg-primary/10 text-primary border-primary/20"
                  : "bg-violet-500/10 text-violet-600 dark:text-violet-400 border-violet-500/20",
                activeSkill === skill.name && "ring-1 ring-primary shadow-sm",
              )}
            >
              {skill.name}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}
