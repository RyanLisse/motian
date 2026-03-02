"use client";

import { Link2 } from "lucide-react";
import Link from "next/link";
import { ToolErrorBlock } from "./tool-error-block";

type MatchOutput = {
  id: string;
  jobId: string | null;
  candidateId: string | null;
  matchScore: number;
  status: string;
};

function isMatchOutput(o: unknown): o is MatchOutput {
  return typeof o === "object" && o !== null && "id" in o && "matchScore" in o && "status" in o;
}

const statusLabels: Record<string, string> = {
  pending: "In afwachting",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
};

export function MatchGenUICard({ output }: { output: unknown }) {
  if (typeof output === "object" && output !== null && "error" in output) {
    const msg =
      typeof (output as { error: unknown }).error === "string"
        ? (output as { error: string }).error
        : "Match niet gevonden";
    return <ToolErrorBlock message={msg} />;
  }
  if (!isMatchOutput(output)) return null;
  const statusLabel = statusLabels[output.status] ?? output.status;
  const href = output.jobId ? `/matching?jobId=${output.jobId}` : "/matching";
  return (
    <Link href={href}>
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent cursor-pointer">
        <div className="flex items-center justify-between gap-2">
          <div className="flex items-center gap-2 min-w-0">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div>
              <p className="text-sm font-semibold text-foreground">
                Match — score {Math.round(output.matchScore)}%
              </p>
              <p className="text-xs text-muted-foreground mt-0.5">Status: {statusLabel}</p>
            </div>
          </div>
          <span className="text-xs text-muted-foreground shrink-0">Bekijk in matching →</span>
        </div>
      </div>
    </Link>
  );
}
