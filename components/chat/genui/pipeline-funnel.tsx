"use client";
import { GitBranch } from "lucide-react";
import { memo } from "react";
import { cn } from "@/lib/utils";
import { getToolErrorMessage, isToolError, useGenUIMobile } from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

type StageStats = {
  new: number;
  screening: number;
  interview: number;
  offer: number;
  hired: number;
  rejected: number;
};

type FunnelOutput = {
  stages: StageStats;
  total: number;
};

function isFunnelOutput(o: unknown): o is FunnelOutput {
  return typeof o === "object" && o !== null && "stages" in o && "total" in o;
}

const STAGE_CONFIG = [
  { key: "new" as const, label: "Nieuw", color: "bg-blue-500" },
  { key: "screening" as const, label: "Screening", color: "bg-amber-500" },
  { key: "interview" as const, label: "Interview", color: "bg-purple-500" },
  { key: "offer" as const, label: "Aanbod", color: "bg-emerald-500" },
  { key: "hired" as const, label: "Aangenomen", color: "bg-green-600" },
  { key: "rejected" as const, label: "Afgewezen", color: "bg-red-500" },
];

export const PipelineFunnel = memo(function PipelineFunnel({ output }: { output: unknown }) {
  const isMobile = useGenUIMobile();

  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Pipeline niet beschikbaar")} />;
  if (!isFunnelOutput(output)) return null;

  const maxCount = Math.max(...Object.values(output.stages), 1);

  return (
    <div className="my-2 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2 mb-3">
        <GitBranch className="h-4 w-4 text-muted-foreground" />
        <h4 className="text-sm font-semibold text-foreground">Pipeline overzicht</h4>
        <span className="text-xs text-muted-foreground ml-auto">{output.total} totaal</span>
      </div>
      <div className="space-y-2">
        {STAGE_CONFIG.map(({ key, label, color }) => {
          const count = output.stages[key];
          const pct = maxCount > 0 ? (count / maxCount) * 100 : 0;
          return (
            <div
              key={key}
              className={cn(
                isMobile
                  ? "rounded-md border border-border/70 bg-background/70 p-3"
                  : "flex items-center gap-3",
              )}
            >
              <div
                className={cn(
                  "flex items-center",
                  isMobile ? "mb-2 justify-between gap-3" : "w-24 shrink-0 gap-3",
                )}
              >
                <span className="text-xs text-muted-foreground">{label}</span>
                <span className="text-xs font-medium text-foreground">{count}</span>
              </div>
              <div className="h-5 flex-1 overflow-hidden rounded-full bg-muted">
                <div
                  className={`h-full ${color} rounded-full transition-all`}
                  style={{ width: `${Math.max(pct, 2)}%` }}
                />
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
});
