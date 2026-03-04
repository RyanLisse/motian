import type { ReactNode } from "react";

interface KPICardProps {
  icon: ReactNode;
  label: string;
  value: number | string;
  /** Tailwind color class for the value text */
  valueClassName?: string;
  /** Tailwind color class for the icon */
  iconClassName?: string;
  /** Tailwind color class for the label text */
  labelClassName?: string;
  /** Compact mode uses smaller padding and font size */
  compact?: boolean;
  /** Optional tooltip describing how the value is calculated */
  title?: string;
}

export function KPICard({
  icon,
  label,
  value,
  valueClassName = "text-foreground",
  iconClassName = "text-muted-foreground",
  labelClassName = "text-muted-foreground",
  compact = false,
  title,
}: KPICardProps) {
  return (
    <div
      className={`bg-card border border-border min-w-0 ${compact ? "rounded-lg p-3" : "rounded-xl p-4"}`}
      title={title}
    >
      <div className={`flex items-center gap-2 min-w-0 ${iconClassName} mb-1`}>
        {icon}
        <span className={`text-xs truncate ${labelClassName}`}>{label}</span>
      </div>
      <p className={`font-bold truncate ${compact ? "text-lg" : "text-2xl"} ${valueClassName}`}>
        {value}
      </p>
    </div>
  );
}
