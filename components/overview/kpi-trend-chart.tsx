"use client";

import { TrendingUp } from "lucide-react";
import {
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";

export interface KpiTrendDataPoint {
  date: string;
  openVacatures: number;
  pipelineTotal: number;
}

interface KpiTrendChartProps {
  data: KpiTrendDataPoint[];
}

export function KpiTrendChart({ data }: KpiTrendChartProps) {
  if (data.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-8 text-center text-sm text-muted-foreground">
        <TrendingUp className="mb-2 h-5 w-5" />
        <p>Nog geen trend data beschikbaar.</p>
        <p className="mt-1 text-xs">Dagelijkse snapshots worden automatisch verzameld.</p>
      </div>
    );
  }

  return (
    <div className="h-[200px] w-full">
      <ResponsiveContainer width="100%" height="100%">
        <LineChart data={data} margin={{ top: 4, right: 12, bottom: 0, left: -12 }}>
          <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
          <XAxis
            dataKey="date"
            tick={{ fontSize: 11 }}
            className="text-muted-foreground"
            tickFormatter={(value: string) => {
              const d = new Date(value);
              return `${d.getDate()}/${d.getMonth() + 1}`;
            }}
          />
          <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" allowDecimals={false} />
          <Tooltip
            contentStyle={{
              fontSize: 12,
              borderRadius: 8,
              border: "1px solid hsl(var(--border))",
              backgroundColor: "hsl(var(--card))",
            }}
            labelFormatter={(label) => {
              const d = new Date(label);
              return d.toLocaleDateString("nl-NL", {
                day: "numeric",
                month: "short",
              });
            }}
          />
          <Line
            type="monotone"
            dataKey="openVacatures"
            name="Open vacatures"
            stroke="hsl(var(--primary))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
          <Line
            type="monotone"
            dataKey="pipelineTotal"
            name="Pipeline totaal"
            stroke="hsl(var(--chart-2, 220 70% 50%))"
            strokeWidth={2}
            dot={false}
            activeDot={{ r: 3 }}
          />
        </LineChart>
      </ResponsiveContainer>
    </div>
  );
}
