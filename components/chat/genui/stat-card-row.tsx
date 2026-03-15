"use client";
import { TrendingUp } from "lucide-react";
import { memo } from "react";
import { ToolErrorBlock } from "./tool-error-block";

type StatItem = { label: string; value: string | number; trend?: "up" | "down" | "neutral" };
type StatOutput = { stats: StatItem[]; title?: string };

function isStatOutput(o: unknown): o is StatOutput {
  return (
    typeof o === "object" && o !== null && "stats" in o && Array.isArray((o as StatOutput).stats)
  );
}

export const StatCardRow = memo(function StatCardRow({ output }: { output: unknown }) {
  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
  if (!isStatOutput(output)) return null;

  return (
    <div className="my-2">
      {output.title && (
        <div className="flex items-center gap-2 mb-2">
          <TrendingUp className="h-3.5 w-3.5 text-muted-foreground" />
          <span className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
            {output.title}
          </span>
        </div>
      )}
      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {output.stats.map((stat) => (
          <div key={stat.label} className="rounded-lg border border-border bg-card p-3">
            <p className="text-xs text-muted-foreground truncate">{stat.label}</p>
            <p className="text-lg font-bold text-foreground mt-0.5">{stat.value}</p>
          </div>
        ))}
      </div>
    </div>
  );
});
