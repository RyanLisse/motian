"use client";

/**
 * Search input bar for the sidebar, supporting both compact (dark) and overview variants.
 */
import { Loader2, Search } from "lucide-react";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { DARK_FILTER_CONTROL_CLASS } from "./sidebar-types";

interface SidebarSearchBarProps {
  value: string;
  onChange: (value: string) => void;
  isFetching: boolean;
  variant: "compact" | "overview";
}

export function SidebarSearchBar({ value, onChange, isFetching, variant }: SidebarSearchBarProps) {
  if (variant === "compact") {
    return (
      <div className="shrink-0 px-4 pb-3 pt-3">
        <div className="relative">
          <Search className="absolute left-4 top-1/2 h-4 w-4 -translate-y-1/2 text-white/40" />
          <Input
            placeholder="Zoek vacatures..."
            value={value}
            onChange={(e) => onChange(e.target.value)}
            className={cn("h-11 rounded-xl pl-12 pr-11 text-sm", DARK_FILTER_CONTROL_CLASS)}
          />
          {isFetching && (
            <Loader2 className="absolute right-4 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-white/45" />
          )}
        </div>
      </div>
    );
  }

  return (
    <div>
      <label
        htmlFor="opdrachten-zoekterm"
        className="mb-2 block text-sm font-medium text-foreground"
      >
        Zoekterm
      </label>
      <div className="relative">
        <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          id="opdrachten-zoekterm"
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder="Zoek vacature..."
          className="h-11 rounded-lg border-border bg-background pl-10 text-sm"
        />
        {isFetching && (
          <Loader2 className="absolute right-3 top-1/2 h-4 w-4 -translate-y-1/2 animate-spin text-muted-foreground" />
        )}
      </div>
    </div>
  );
}
