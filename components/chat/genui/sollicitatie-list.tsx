"use client";
import { FileText, Send } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { getToolErrorMessage, isToolError, stageLabels } from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

type SollicitatieItem = {
  id: string;
  jobId?: string | null;
  candidateId?: string | null;
  stage: string;
  source?: string | null;
  createdAt?: string | Date | null;
};

type SollicitatieListOutput = { total: number; sollicitaties: SollicitatieItem[] };

function isSollicitatieList(o: unknown): o is SollicitatieListOutput {
  return (
    typeof o === "object" &&
    o !== null &&
    "sollicitaties" in o &&
    Array.isArray((o as SollicitatieListOutput).sollicitaties)
  );
}

const stageColors: Record<string, string> = {
  new: "bg-blue-100 text-blue-800 dark:bg-blue-900/30 dark:text-blue-400",
  screening: "bg-violet-100 text-violet-800 dark:bg-violet-900/30 dark:text-violet-400",
  interview: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  assessment: "bg-orange-100 text-orange-800 dark:bg-orange-900/30 dark:text-orange-400",
  offer: "bg-cyan-100 text-cyan-800 dark:bg-cyan-900/30 dark:text-cyan-400",
  hired: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  rejected: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  withdrawn: "bg-gray-100 text-gray-800 dark:bg-gray-800 dark:text-gray-400",
};

function formatDate(v: string | Date | null | undefined): string | null {
  if (v == null) return null;
  const d = v instanceof Date ? v : new Date(v);
  if (Number.isNaN(d.getTime())) return null;
  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short", year: "numeric" });
}

export function SollicitatieListCard({ output }: { output: unknown }) {
  const [showAll, setShowAll] = useState(false);

  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Sollicitaties niet gevonden")} />;
  if (!isSollicitatieList(output)) return null;
  if (output.sollicitaties.length === 0) {
    return (
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Send className="h-4 w-4" />
          <span>Geen sollicitaties gevonden</span>
        </div>
      </div>
    );
  }

  const MAX_VISIBLE = 5;
  const visible = showAll ? output.sollicitaties : output.sollicitaties.slice(0, MAX_VISIBLE);
  const hasMore = output.sollicitaties.length > MAX_VISIBLE;

  return (
    <div className="my-1.5 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Send className="h-3.5 w-3.5" />
        <span>
          {output.total} sollicitatie{output.total !== 1 ? "s" : ""} gevonden
        </span>
      </div>
      <div className="space-y-1.5">
        {visible.map((item) => (
          <Link key={item.id} href={`/sollicitaties/${item.id}`}>
            <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <FileText className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <div className="flex items-center justify-between gap-2">
                    <span
                      className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium ${stageColors[item.stage] ?? stageColors.new}`}
                    >
                      {stageLabels[item.stage] ?? item.stage}
                    </span>
                    {formatDate(item.createdAt) && (
                      <span className="text-[10px] text-muted-foreground">
                        {formatDate(item.createdAt)}
                      </span>
                    )}
                  </div>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-1">
                    {item.candidateId && (
                      <span className="text-xs text-muted-foreground">
                        Kandidaat {item.candidateId.slice(0, 8)}...
                      </span>
                    )}
                    {item.jobId && (
                      <span className="text-xs text-muted-foreground">
                        Opdracht {item.jobId.slice(0, 8)}...
                      </span>
                    )}
                    {item.source && (
                      <span className="text-xs text-muted-foreground">via {item.source}</span>
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
          + {output.sollicitaties.length - MAX_VISIBLE} meer tonen
        </button>
      )}
    </div>
  );
}
