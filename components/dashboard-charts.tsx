"use client";

import {
  AreaChart,
  Area,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
  PieChart,
  Pie,
  Cell,
} from "recharts";

// ── Static mock data ────────────────────────────

const trendData = [
  { month: "Sep", Opdrachten: 32, Geplaatst: 5 },
  { month: "Okt", Opdrachten: 45, Geplaatst: 8 },
  { month: "Nov", Opdrachten: 58, Geplaatst: 11 },
  { month: "Dec", Opdrachten: 41, Geplaatst: 9 },
  { month: "Jan", Opdrachten: 67, Geplaatst: 14 },
  { month: "Feb", Opdrachten: 78, Geplaatst: 18 },
];

const platformData = [
  { name: "Striive", value: 42 },
  { name: "Indeed", value: 28 },
  { name: "LinkedIn", value: 19 },
  { name: "Overig", value: 11 },
];

const PLATFORM_COLORS = ["#10a37f", "#3b82f6", "#f59e0b", "#ef4444"];

// ── Custom tooltip ──────────────────────────────

function CustomTooltip({
  active,
  payload,
  label,
}: {
  active?: boolean;
  payload?: Array<{ value: number; name: string; color: string }>;
  label?: string;
}) {
  if (!active || !payload?.length) return null;
  return (
    <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 shadow-lg">
      <p className="text-xs text-[#8e8e8e] mb-1">{label}</p>
      {payload.map((entry) => (
        <p key={entry.name} className="text-sm font-medium" style={{ color: entry.color }}>
          {entry.name}: {entry.value}
        </p>
      ))}
    </div>
  );
}

// ── Area chart ──────────────────────────────────

export function ApplicationTrendsChart() {
  return (
    <ResponsiveContainer width="100%" height={260}>
      <AreaChart data={trendData} margin={{ top: 5, right: 10, left: -10, bottom: 0 }}>
        <defs>
          <linearGradient id="gradientOpdrachten" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#10a37f" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#10a37f" stopOpacity={0} />
          </linearGradient>
          <linearGradient id="gradientGeplaatst" x1="0" y1="0" x2="0" y2="1">
            <stop offset="5%" stopColor="#3b82f6" stopOpacity={0.3} />
            <stop offset="95%" stopColor="#3b82f6" stopOpacity={0} />
          </linearGradient>
        </defs>
        <CartesianGrid strokeDasharray="3 3" stroke="#2d2d2d" />
        <XAxis dataKey="month" tick={{ fill: "#8e8e8e", fontSize: 12 }} axisLine={{ stroke: "#2d2d2d" }} tickLine={false} />
        <YAxis tick={{ fill: "#8e8e8e", fontSize: 12 }} axisLine={{ stroke: "#2d2d2d" }} tickLine={false} />
        <Tooltip content={<CustomTooltip />} />
        <Area
          type="monotone"
          dataKey="Opdrachten"
          stroke="#10a37f"
          strokeWidth={2}
          fill="url(#gradientOpdrachten)"
        />
        <Area
          type="monotone"
          dataKey="Geplaatst"
          stroke="#3b82f6"
          strokeWidth={2}
          fill="url(#gradientGeplaatst)"
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ── Donut chart ─────────────────────────────────

export function PlatformDistributionChart() {
  return (
    <div className="flex flex-col items-center">
      <ResponsiveContainer width="100%" height={200}>
        <PieChart>
          <Pie
            data={platformData}
            cx="50%"
            cy="50%"
            innerRadius={55}
            outerRadius={80}
            paddingAngle={3}
            dataKey="value"
            stroke="none"
          >
            {platformData.map((_, index) => (
              <Cell key={`cell-${index}`} fill={PLATFORM_COLORS[index]} />
            ))}
          </Pie>
          <Tooltip
            content={({ active, payload }) => {
              if (!active || !payload?.length) return null;
              const d = payload[0];
              return (
                <div className="bg-[#1a1a1a] border border-[#2d2d2d] rounded-lg px-3 py-2 shadow-lg">
                  <p className="text-sm text-[#ececec]">
                    {d.name}: <span className="font-bold">{d.value}%</span>
                  </p>
                </div>
              );
            }}
          />
        </PieChart>
      </ResponsiveContainer>
      <div className="flex flex-wrap justify-center gap-x-4 gap-y-1 mt-1">
        {platformData.map((entry, i) => (
          <div key={entry.name} className="flex items-center gap-1.5">
            <div className="h-2.5 w-2.5 rounded-full" style={{ backgroundColor: PLATFORM_COLORS[i] }} />
            <span className="text-xs text-[#8e8e8e]">{entry.name}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
