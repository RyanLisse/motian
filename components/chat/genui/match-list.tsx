"use client";
import { GitCompareArrows, Target } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ToolErrorBlock } from "./tool-error-block";

type MatchItem = {
  id: string;
  jobId: string;
  candidateId: string;
  matchScore: number;
  status: string;
  confidence?: number | null;
  reasoning?: string | null;
};

type MatchListOutput = { total: number; matches: MatchItem[] };

function isMatchList(o: unknown): o is MatchListOutput {
  return (
    typeof o === "object" &&
    o !== null &&
    "matches" in o &&
    Array.isArray((o as MatchListOutput).matches)
  );
}

const statusLabels: Record<string, string> = {
  pending: "In afwachting",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
  withdrawn: "Ingetrokken",
};

const statusColors: Record<string, string> = {
  pending: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  approved: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
};

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

export function MatchListCard({ output }: { output: unknown }) {
  const [showAll, setShowAll] = useState(false);

  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
  if (!isMatchList(output)) return null;
  if (output.matches.length === 0) {
    return (
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <GitCompareArrows className="h-4 w-4" />
          <span>Geen matches gevonden</span>
        </div>
      </div>
    );
  }

  const MAX_VISIBLE = 5;
  const visible = showAll ? output.matches : output.matches.slice(0, MAX_VISIBLE);
  const hasMore = output.matches.length > MAX_VISIBLE;

  return (
    <div className="my-1.5 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <GitCompareArrows className="h-3.5 w-3.5" />
        <span>
          {output.total} match{output.total !== 1 ? "es" : ""} gevonden
        </span>
      </div>
      <div className="space-y-1.5">
        {visible.map((item) => (
          <Link key={item.id} href={`/kandidaten/${item.candidateId}/matches`}>
            <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent cursor-pointer">
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full border-2 border-current">
                  <span className={`text-sm font-bold ${scoreColor(item.matchScore)}`}>
                    {Math.round(item.matchScore)}
                  </span>
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center gap-2">
                    <Target className="h-3 w-3 text-muted-foreground" />
                    <p className="text-xs text-muted-foreground truncate">
                      Kandidaat {item.candidateId.slice(0, 8)}... &rarr; Opdracht{" "}
                      {item.jobId.slice(0, 8)}...
                    </p>
                  </div>
                  <div className="flex items-center gap-2 mt-1">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${statusColors[item.status] ?? statusColors.pending}`}
                    >
                      {statusLabels[item.status] ?? item.status}
                    </span>
                    {item.confidence != null && (
                      <span className="text-[10px] text-muted-foreground">
                        {Math.round(item.confidence * 100)}% zekerheid
                      </span>
                    )}
                  </div>
                  {item.reasoning && (
                    <p className="text-[11px] text-muted-foreground mt-1 line-clamp-1">
                      {item.reasoning}
                    </p>
                  )}
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
          + {output.matches.length - MAX_VISIBLE} meer tonen
        </button>
      )}
    </div>
  );
}
