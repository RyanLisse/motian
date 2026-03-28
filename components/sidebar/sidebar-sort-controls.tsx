"use client";

/**
 * Sort dropdown for the sidebar, supporting both compact (dark) and overview variants.
 */
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";

import { DARK_FILTER_MENU_CLASS, DARK_FILTER_TRIGGER_CLASS } from "./sidebar-types";

interface SidebarSortControlsProps {
  sort: string;
  sortOptions: readonly { readonly value: string; readonly label: string }[];
  onSortChange: (value: string) => void;
  variant: "compact" | "overview";
}

export function SidebarSortControls({
  sort,
  sortOptions,
  onSortChange,
  variant,
}: SidebarSortControlsProps) {
  const handleChange = (value: string) => {
    onSortChange(value === "nieuwste" ? "" : value);
  };

  if (variant === "compact") {
    return (
      <div className="shrink-0 px-4 pb-4">
        <Select value={sort} onValueChange={handleChange}>
          <SelectTrigger className={cn("w-full", DARK_FILTER_TRIGGER_CLASS)}>
            <SelectValue placeholder="Sortering" />
          </SelectTrigger>
          <SelectContent className={DARK_FILTER_MENU_CLASS}>
            {sortOptions.map((option) => (
              <SelectItem key={option.value} value={option.value} className="text-sm text-white">
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      </div>
    );
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2">
      <span className="hidden text-xs text-muted-foreground sm:inline sm:text-sm">Sorteren:</span>
      <Select value={sort} onValueChange={handleChange}>
        <SelectTrigger className="data-[size=default]:h-9 w-full rounded-md border-primary/40 bg-background text-xs font-semibold text-primary sm:w-[210px] sm:rounded-full sm:data-[size=default]:h-10 sm:text-sm">
          <SelectValue />
        </SelectTrigger>
        <SelectContent className="bg-card border-border">
          {sortOptions.map((option) => (
            <SelectItem key={option.value} value={option.value}>
              {option.label}
            </SelectItem>
          ))}
        </SelectContent>
      </Select>
    </div>
  );
}
