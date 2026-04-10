"use client";

import { Link2 } from "lucide-react";
import Link from "next/link";
import {
  genuiMobileWrapClassName,
  getToolErrorMessage,
  isToolError,
  matchStatusLabels,
} from "./genui-utils";
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

export function MatchGenUICard({ output }: { output: unknown }) {
  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Match niet gevonden")} />;
  if (!isMatchOutput(output)) return null;
  const statusLabel = matchStatusLabels[output.status] ?? output.status;
  const href = output.candidateId
    ? `/kandidaten/${output.candidateId}#matches`
    : output.jobId
      ? `/vacatures/${output.jobId}#recruiter-cockpit`
      : "/kandidaten";
  const ctaLabel = output.candidateId
    ? "Open matchkansen →"
    : output.jobId
      ? "Open vacaturecontext →"
      : "Open kandidaten →";
  return (
    <Link href={href} className="block">
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent cursor-pointer">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex min-w-0 items-center gap-2">
            <Link2 className="h-4 w-4 shrink-0 text-muted-foreground" />
            <div className="min-w-0">
              <p className="text-sm font-semibold text-foreground">
                Match — score {Math.round(output.matchScore)}%
              </p>
              <p className={`mt-0.5 text-xs text-muted-foreground ${genuiMobileWrapClassName}`}>
                Status: {statusLabel}
              </p>
            </div>
          </div>
          <span className="text-sm font-medium text-muted-foreground sm:shrink-0">{ctaLabel}</span>
        </div>
      </div>
    </Link>
  );
}
