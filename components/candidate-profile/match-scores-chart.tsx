"use client";

import { Bar, BarChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

interface MatchScoreItem {
  jobTitle: string;
  score: number;
  jobId?: string;
}

interface MatchScoresChartProps {
  data: MatchScoreItem[];
  className?: string;
}

/** Mini bar chart of match scores per job (top 5). */
export function MatchScoresChart({ data, className = "" }: MatchScoresChartProps) {
  if (data.length === 0) return null;

  const chartData = data.slice(0, 5).map((d) => ({
    name: d.jobTitle.length > 18 ? `${d.jobTitle.slice(0, 16)}…` : d.jobTitle,
    score: Math.round(d.score),
    fullName: d.jobTitle,
  }));

  return (
    <div className={className}>
      <p className="text-xs font-medium text-muted-foreground mb-2">Match scores</p>
      <ResponsiveContainer width="100%" height={140}>
        <BarChart
          data={chartData}
          margin={{ top: 4, right: 4, left: 0, bottom: 0 }}
          layout="vertical"
        >
          <XAxis type="number" domain={[0, 100]} hide />
          <YAxis type="category" dataKey="name" width={72} tick={{ fontSize: 10 }} />
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
          <Bar dataKey="score" fill="hsl(var(--primary))" radius={[0, 4, 4, 0]} maxBarSize={12} />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
