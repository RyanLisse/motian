"use client";
import { BarChart3 } from "lucide-react";
import { memo } from "react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Cell,
  Line,
  LineChart,
  Pie,
  PieChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import { getToolErrorMessage, isToolError } from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

type ChartDataItem = Record<string, unknown>;

type AnalyseOutput = {
  type?: "bar" | "line" | "pie" | "table";
  title?: string;
  data: ChartDataItem[];
  xKey?: string;
  yKey?: string;
  summary?: string;
};

function isAnalyseOutput(o: unknown): o is AnalyseOutput {
  return (
    typeof o === "object" && o !== null && "data" in o && Array.isArray((o as AnalyseOutput).data)
  );
}

const COLORS = [
  "#6366f1",
  "#22c55e",
  "#f59e0b",
  "#ef4444",
  "#06b6d4",
  "#8b5cf6",
  "#ec4899",
  "#14b8a6",
];

function inferChartType(data: AnalyseOutput): "bar" | "line" | "pie" | "table" {
  if (data.type) return data.type;
  if (data.data.length === 0) return "table";
  const keys = Object.keys(data.data[0]);
  if (keys.some((k) => /date|datum|week|maand|month|jaar|year/i.test(k))) return "line";
  if (data.data.length <= 6 && keys.length === 2) return "pie";
  return "bar";
}

function getKeys(data: AnalyseOutput) {
  if (data.data.length === 0) return { xKey: "", yKey: "" };
  const keys = Object.keys(data.data[0]);
  const xKey = data.xKey ?? keys.find((k) => typeof data.data[0][k] === "string") ?? keys[0];
  const yKey =
    data.yKey ?? keys.find((k) => typeof data.data[0][k] === "number" && k !== xKey) ?? keys[1];
  return { xKey, yKey };
}

export const InsightChart = memo(function InsightChart({ output }: { output: unknown }) {
  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Analyse niet beschikbaar")} />;
  if (!isAnalyseOutput(output)) return null;
  if (output.data.length === 0) {
    return (
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <BarChart3 className="h-4 w-4" />
          <span>Geen data beschikbaar</span>
        </div>
      </div>
    );
  }

  const chartType = inferChartType(output);
  const { xKey, yKey } = getKeys(output);

  return (
    <div className="my-2 rounded-lg border border-border bg-card p-4">
      {output.title && (
        <h4 className="text-sm font-semibold text-foreground mb-3">{output.title}</h4>
      )}
      <div style={{ width: "100%", height: 240 }}>
        <ResponsiveContainer width="100%" height="100%">
          {chartType === "pie" ? (
            <PieChart>
              <Pie
                data={output.data}
                dataKey={yKey}
                nameKey={xKey}
                cx="50%"
                cy="50%"
                outerRadius={80}
                label={(entry) => String((entry as unknown as Record<string, unknown>)[xKey])}
              >
                {output.data.map((entry, i) => (
                  <Cell key={String(entry[xKey] ?? i)} fill={COLORS[i % COLORS.length]} />
                ))}
              </Pie>
              <Tooltip />
            </PieChart>
          ) : chartType === "line" ? (
            <LineChart data={output.data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip />
              <Line type="monotone" dataKey={yKey} stroke="#6366f1" strokeWidth={2} dot={false} />
            </LineChart>
          ) : (
            <BarChart data={output.data}>
              <CartesianGrid strokeDasharray="3 3" className="stroke-border" />
              <XAxis dataKey={xKey} tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <YAxis tick={{ fontSize: 11 }} className="text-muted-foreground" />
              <Tooltip />
              <Bar dataKey={yKey} fill="#6366f1" radius={[4, 4, 0, 0]} />
            </BarChart>
          )}
        </ResponsiveContainer>
      </div>
      {output.summary && <p className="mt-2 text-xs text-muted-foreground">{output.summary}</p>}
    </div>
  );
});
