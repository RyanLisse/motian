import Link from "next/link";
import type { ReactNode } from "react";

interface FilterOption {
  value: string;
  label: string;
}

interface FilterTabsProps {
  options: FilterOption[];
  activeValue: string;
  /** Build the href for a given filter value */
  buildHref: (value: string) => string;
  /** "pill" = solid active bg (default), "subtle" = translucent active bg */
  variant?: "pill" | "subtle";
  /** Optional icon rendered before the tabs */
  icon?: ReactNode;
}

const pillStyles = {
  active: "bg-primary text-primary-foreground",
  inactive:
    "bg-card border border-border text-muted-foreground hover:text-foreground hover:bg-accent",
};

const subtleStyles = {
  active: "bg-primary/10 text-primary font-medium",
  inactive: "text-muted-foreground hover:text-foreground hover:bg-accent",
};

export function FilterTabs({
  options,
  activeValue,
  buildHref,
  variant = "pill",
  icon,
}: FilterTabsProps) {
  const styles = variant === "pill" ? pillStyles : subtleStyles;
  const baseClass =
    variant === "pill"
      ? "h-8 px-3 flex items-center rounded-lg text-sm transition-colors"
      : "px-3 py-1.5 rounded-md text-sm transition-colors";

  return (
    <div className="flex items-center gap-2 flex-wrap">
      {icon}
      {options.map((opt) => (
        <Link
          key={opt.value}
          href={buildHref(opt.value)}
          className={`${baseClass} ${activeValue === opt.value ? styles.active : styles.inactive}`}
        >
          {opt.label}
        </Link>
      ))}
    </div>
  );
}
