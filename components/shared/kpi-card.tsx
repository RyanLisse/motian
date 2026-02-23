import type { ReactNode } from "react";

interface KPICardProps {
  icon: ReactNode;
  label: string;
  value: number | string;
  /** Tailwind color class for the value text, e.g. "text-[#10a37f]" */
  valueClassName?: string;
  /** Tailwind color class for the icon, e.g. "text-yellow-500/60" */
  iconClassName?: string;
  /** Tailwind color class for the label text */
  labelClassName?: string;
  /** Compact mode uses smaller padding and font size */
  compact?: boolean;
}

export function KPICard({
  icon,
  label,
  value,
  valueClassName = "text-[#ececec]",
  iconClassName = "text-[#6b6b6b]",
  labelClassName = "text-[#6b6b6b]",
  compact = false,
}: KPICardProps) {
  return (
    <div
      className={`bg-[#1e1e1e] border border-[#2d2d2d] ${compact ? "rounded-lg p-3" : "rounded-xl p-4"}`}
    >
      <div className={`flex items-center gap-2 ${iconClassName} mb-1`}>
        {icon}
        <span className={`text-xs ${labelClassName}`}>{label}</span>
      </div>
      <p className={`font-bold ${compact ? "text-lg" : "text-2xl"} ${valueClassName}`}>{value}</p>
    </div>
  );
}
