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
  active: "bg-[#10a37f] text-white",
  inactive:
    "bg-[#1e1e1e] border border-[#2d2d2d] text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#232323]",
};

const subtleStyles = {
  active: "bg-[#10a37f]/10 text-[#10a37f] font-medium",
  inactive: "text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#2a2a2a]",
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
