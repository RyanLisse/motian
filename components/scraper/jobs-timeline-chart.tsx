"use client";

import { Area, AreaChart, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";

type TimeSeriesPoint = {
  date: string;
  platform: string;
  jobsFound: number;
  jobsNew: number;
  duplicates: number;
  successCount: number;
  failedCount: number;
  totalRuns: number;
  avgDurationMs: number;
};

interface JobsTimelineChartProps {
  data: TimeSeriesPoint[];
  className?: string;
}

type AggregatedPoint = {
  date: string;
  jobsFound: number;
  jobsNew: number;
  duplicates: number;
};

function parseDate(date: string) {
  const parsed = new Date(date.length <= 10 ? `${date}T00:00:00` : date);
  return Number.isNaN(parsed.getTime()) ? null : parsed;
}

function formatDateLabel(date: string) {
  return (
    parseDate(date)?.toLocaleDateString("nl-NL", {
      day: "numeric",
      month: "short",
    }) ?? date
  );
}

function aggregateByDate(data: TimeSeriesPoint[]) {
  const aggregated = new Map<string, AggregatedPoint>();

  for (const point of data) {
    const current = aggregated.get(point.date) ?? {
      date: point.date,
      jobsFound: 0,
      jobsNew: 0,
      duplicates: 0,
    };

    current.jobsFound += point.jobsFound;
    current.jobsNew += point.jobsNew;
    current.duplicates += point.duplicates;

    aggregated.set(point.date, current);
  }

  return Array.from(aggregated.values()).sort((left, right) => {
    return (parseDate(left.date)?.getTime() ?? 0) - (parseDate(right.date)?.getTime() ?? 0);
  });
}

function emptyStateClassName(className?: string) {
  return ["flex h-[300px] items-center justify-center text-sm text-muted-foreground", className]
    .filter(Boolean)
    .join(" ");
}

export function JobsTimelineChart({ data, className }: JobsTimelineChartProps) {
  const chartData = aggregateByDate(data);

  if (chartData.length === 0) {
    return <div className={emptyStateClassName(className)}>Nog geen data</div>;
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <AreaChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis tick={{ fontSize: 12 }} tickLine={false} axisLine={false} width={40} />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length || typeof label !== "string") {
                return null;
              }

              const point = payload[0]?.payload as AggregatedPoint;

              return (
                <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{formatDateLabel(label)}</p>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    <p>Nieuwe jobs: {point.jobsNew}</p>
                    <p>Duplicaten: {point.duplicates}</p>
                    <p>Totaal gevonden: {point.jobsFound}</p>
                  </div>
                </div>
              );
            }}
          />
          <Area
            type="monotone"
            dataKey="jobsNew"
            name="Nieuwe jobs"
            stackId="jobs"
            stroke="var(--chart-1)"
            fill="var(--chart-1)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="duplicates"
            name="Duplicaten"
            stackId="jobs"
            stroke="var(--chart-4)"
            fill="var(--chart-4)"
            fillOpacity={0.3}
            strokeWidth={2}
          />
          <Area
            type="monotone"
            dataKey="jobsFound"
            name="Totaal gevonden"
            stackId="jobs"
            stroke="var(--chart-5)"
            fill="var(--chart-5)"
            fillOpacity={0.2}
            strokeWidth={2}
          />
        </AreaChart>
      </ResponsiveContainer>
    </div>
  );
}
