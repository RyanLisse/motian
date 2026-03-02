"use client";

import { Bar, BarChart, Cell, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import type { CriterionResult } from "@/src/schemas/matching";

interface CriteriaBreakdownChartProps {
  criteria: CriterionResult[];
  className?: string;
}

/** Converteer criteria naar recharts data: korte label + score 0–100 (stars*20 of pass 100). */
function toChartData(
  criteria: CriterionResult[],
): { name: string; score: number; fullName: string }[] {
  return criteria.map((c) => {
    const shortName = c.criterion.length > 20 ? `${c.criterion.slice(0, 18)}…` : c.criterion;
    let score = 50;
    if (c.tier === "knockout" && c.passed !== null) score = c.passed ? 100 : 0;
    else if (c.tier === "gunning" && c.stars !== null) score = c.stars * 20;
    return { name: shortName, score, fullName: c.criterion };
  });
}

export function CriteriaBreakdownChart({ criteria, className = "" }: CriteriaBreakdownChartProps) {
  if (criteria.length === 0) return null;

  const data = toChartData(criteria);

  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground mb-2">Criteria score (recharts)</p>
      <ResponsiveContainer width="100%" height={180}>
        <BarChart data={data} layout="vertical" margin={{ top: 0, right: 8, left: 0, bottom: 0 }}>
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="name" width={90} tick={{ fontSize: 10 }} />
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const p = payload[0].payload;
              return (
                <div className="rounded-md border border-border bg-background px-2 py-1.5 text-xs shadow-md">
                  <p className="font-medium truncate max-w-[200px]">{p.fullName}</p>
                  <p className="text-muted-foreground">Score: {p.score}%</p>
                </div>
              );
            }}
          />
          <Bar dataKey="score" radius={[0, 4, 4, 0]} maxBarSize={14}>
            {data.map((entry) => (
              <Cell
                key={`${entry.fullName}-${entry.score}`}
                fill={
                  entry.score >= 80
                    ? "var(--chart-2)"
                    : entry.score >= 50
                      ? "var(--chart-1)"
                      : "var(--destructive)"
                }
              />
            ))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
