"use client";

import {
  CartesianGrid,
  Line,
  LineChart,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

type TimeSeriesPoint = {
  date: string;
  platform: string;
  jobsFound: number;
  jobsNew: number;
  duplicates: number;
  successCount: number;
  partialCount: number;
  failedCount: number;
  totalRuns: number;
  avgDurationMs: number;
};

interface SuccessRateChartProps {
  data: TimeSeriesPoint[];
  className?: string;
}

type SuccessRateRow = {
  date: string;
  [key: string]: number | string | undefined;
};

const PLATFORM_COLORS = [
  "var(--chart-1)",
  "var(--chart-2)",
  "var(--chart-3)",
  "var(--chart-4)",
  "var(--chart-5)",
] as const;

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

function getPlatforms(data: TimeSeriesPoint[]) {
  return Array.from(new Set(data.map((point) => point.platform))).sort((left, right) =>
    left.localeCompare(right),
  );
}

function pivotSuccessRates(data: TimeSeriesPoint[], platforms: string[]) {
  const grouped = new Map<
    string,
    Map<string, { successCount: number; partialCount: number; totalRuns: number }>
  >();

  for (const point of data) {
    const platformMap =
      grouped.get(point.date) ??
      new Map<string, { successCount: number; partialCount: number; totalRuns: number }>();
    const current = platformMap.get(point.platform) ?? {
      successCount: 0,
      partialCount: 0,
      totalRuns: 0,
    };

    current.successCount += point.successCount;
    current.partialCount += point.partialCount;
    current.totalRuns += point.totalRuns;

    platformMap.set(point.platform, current);
    grouped.set(point.date, platformMap);
  }

  return Array.from(grouped.entries())
    .sort(
      (left, right) => (parseDate(left[0])?.getTime() ?? 0) - (parseDate(right[0])?.getTime() ?? 0),
    )
    .map(([date, platformMap]) => {
      const row: SuccessRateRow = { date };

      for (const platform of platforms) {
        const totals = platformMap.get(platform);

        if (!totals || totals.totalRuns === 0) {
          continue;
        }

        row[platform] = ((totals.successCount + totals.partialCount) / totals.totalRuns) * 100;
      }

      return row;
    });
}

function emptyStateClassName(className?: string) {
  return ["flex h-[300px] items-center justify-center text-sm text-muted-foreground", className]
    .filter(Boolean)
    .join(" ");
}

export function SuccessRateChart({ data, className }: SuccessRateChartProps) {
  const platforms = getPlatforms(data);
  const chartData = pivotSuccessRates(data, platforms);

  if (chartData.length === 0 || platforms.length === 0) {
    return <div className={emptyStateClassName(className)}>Nog geen data</div>;
  }

  return (
    <div className={className}>
      <ResponsiveContainer width="100%" height={300}>
        <LineChart data={chartData} margin={{ top: 8, right: 16, left: 0, bottom: 0 }}>
          <CartesianGrid vertical={false} stroke="hsl(var(--border))" strokeDasharray="3 3" />
          <XAxis
            dataKey="date"
            tickFormatter={formatDateLabel}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
          />
          <YAxis
            domain={[0, 100]}
            tickFormatter={(value: number) => `${value}%`}
            tick={{ fontSize: 12 }}
            tickLine={false}
            axisLine={false}
            width={44}
          />
          <ReferenceLine
            y={80}
            stroke="hsl(var(--muted-foreground))"
            strokeDasharray="6 6"
            label={{
              value: "80%",
              fill: "hsl(var(--muted-foreground))",
              position: "insideTopRight",
            }}
          />
          <Tooltip
            content={({ active, payload, label }) => {
              if (!active || !payload?.length || typeof label !== "string") {
                return null;
              }

              return (
                <div className="rounded-md border border-border bg-background px-3 py-2 text-xs shadow-md">
                  <p className="font-medium">{formatDateLabel(label)}</p>
                  <div className="mt-2 space-y-1 text-muted-foreground">
                    {payload
                      .filter((item) => typeof item.value === "number")
                      .map((item) => (
                        <p key={item.dataKey as string}>
                          {item.name}: {(item.value as number).toFixed(1)}%
                        </p>
                      ))}
                  </div>
                </div>
              );
            }}
          />
          {platforms.map((platform, index) => (
            <Line
              key={platform}
              type="monotone"
              dataKey={platform}
              name={platform}
              stroke={PLATFORM_COLORS[index % PLATFORM_COLORS.length]}
              strokeWidth={2}
              dot={false}
              connectNulls
            />
          ))}
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
