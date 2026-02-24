"use client";

import { User, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

export interface RecentAnalysis {
  id: string;
  name: string;
  role: string | null;
  resumeUrl: string | null;
  resumeParsedAt: Date | string;
}

interface RecentAnalysesProps {
  analyses: RecentAnalysis[];
  onSelect: (analysis: RecentAnalysis) => void;
  activeId?: string | null;
}

function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 30) return "nu";
  if (minutes < 1) return `${seconds} sec geleden`;
  if (minutes < 60) return `${minutes} min geleden`;
  if (hours === 1) return "1 uur geleden";
  if (hours < 24) return `${hours} uur geleden`;
  if (days === 1) return "gisteren";
  if (days < 7) return `${days} dagen geleden`;
  if (days < 30) return `${Math.floor(days / 7)} weken geleden`;

  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

export function RecentAnalyses({ analyses, onSelect, activeId }: RecentAnalysesProps) {
  if (analyses.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Recente analyses</h3>
        <p className="text-sm text-muted-foreground">Nog geen CV&apos;s geanalyseerd</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Recente analyses</h3>
      <div className="max-h-[320px] overflow-y-auto -mx-1 px-1 space-y-1">
        {analyses.map((analysis) => {
          const isActive = activeId === analysis.id;

          return (
            <button
              key={analysis.id}
              type="button"
              onClick={() => onSelect(analysis)}
              className={cn(
                "flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors",
                "hover:bg-accent/50",
                isActive
                  ? "border-primary bg-accent/30"
                  : "border-transparent",
              )}
            >
              <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                <User className="h-4 w-4 text-muted-foreground" />
              </div>

              <div className="min-w-0 flex-1">
                <p className="truncate text-sm font-medium">
                  {analysis.name}
                  {analysis.role && (
                    <span className="font-normal text-muted-foreground">
                      {" "}
                      &mdash; {analysis.role}
                    </span>
                  )}
                </p>
                <p className="text-xs text-muted-foreground">
                  {timeAgo(analysis.resumeParsedAt)}
                </p>
              </div>

              <ChevronRight className="h-4 w-4 shrink-0 text-muted-foreground" />
            </button>
          );
        })}
      </div>
    </div>
  );
}
