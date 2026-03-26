"use client";

/**
 * Results header showing total count, badges, and page size selector.
 * Supports both compact (dark) and overview variants.
 */
import { Badge } from "@/components/ui/badge";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import {
  DEFAULT_OPDRACHTEN_LIMIT,
  OPDRACHTEN_PAGE_SIZE_OPTIONS,
} from "@/src/lib/opdrachten-filters";
import type { PushParamsFn } from "./sidebar-types";
import { DARK_FILTER_MENU_CLASS } from "./sidebar-types";

interface SidebarResultsHeaderProps {
  displayTotal: number;
  shortlistCount: number;
  urgentDeadlineCount: number;
  displayPerPage: number;
  pageParam: number;
  totalPages: number;
  pushParams: PushParamsFn;
  variant: "compact" | "overview";
}

export function SidebarResultsHeader({
  displayTotal,
  shortlistCount,
  urgentDeadlineCount,
  displayPerPage,
  pageParam,
  totalPages,
  pushParams,
  variant,
}: SidebarResultsHeaderProps) {
  const handlePageSizeChange = (v: string) => {
    pushParams({
      limit: v === String(DEFAULT_OPDRACHTEN_LIMIT) ? "" : v,
      pagina: "1",
    });
  };

  if (variant === "compact") {
    return (
      <div className="flex shrink-0 items-center justify-between gap-3 border-y border-white/10 bg-black/30 px-4 py-4">
        <div className="min-w-0">
          <p className="text-[11px] font-semibold uppercase tracking-[0.2em] text-white/55">
            {displayTotal} vacatures
          </p>
          <div className="mt-1 flex flex-wrap gap-1.5">
            <Badge
              variant="outline"
              className="h-7 rounded-full border-white/10 bg-white/[0.035] px-3 text-[11px] text-white/65"
            >
              {shortlistCount > 0 ? `${shortlistCount} met shortlist` : "Nog geen shortlist"}
            </Badge>
            {urgentDeadlineCount > 0 ? (
              <Badge
                variant="outline"
                className="h-7 rounded-full border-amber-500/20 bg-amber-500/12 px-3 text-[11px] text-amber-200"
              >
                {urgentDeadlineCount} deadlines vragen aandacht
              </Badge>
            ) : null}
          </div>
        </div>
        <div className="flex items-center gap-2">
          <Select value={String(displayPerPage)} onValueChange={handlePageSizeChange}>
            <SelectTrigger className="h-12 w-[132px] rounded-[18px] border-white/10 bg-white/[0.035] px-4 text-[15px] text-white">
              <SelectValue />
            </SelectTrigger>
            <SelectContent className={DARK_FILTER_MENU_CLASS}>
              {OPDRACHTEN_PAGE_SIZE_OPTIONS.map((value) => (
                <SelectItem key={value} value={String(value)} className="text-sm text-white">
                  {value} / pg
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          {totalPages > 1 && (
            <p className="text-base text-white/55">
              {pageParam}/{totalPages}
            </p>
          )}
        </div>
      </div>
    );
  }

  return (
    <div className="min-w-0 space-y-2">
      <div className="text-base font-semibold text-foreground sm:text-lg">
        {displayTotal} vacatures weergegeven
      </div>
      <div className="flex flex-wrap gap-2">
        <Badge
          variant="outline"
          className="max-w-full whitespace-normal wrap-break-word text-[11px] text-muted-foreground sm:text-xs"
        >
          {shortlistCount > 0 ? `${shortlistCount} met shortlist` : "Nog geen shortlist"}
        </Badge>
        {urgentDeadlineCount > 0 ? (
          <Badge
            variant="outline"
            className="max-w-full whitespace-normal wrap-break-word border-amber-500/20 bg-amber-500/10 text-[11px] text-amber-700 dark:text-amber-300 sm:text-xs"
          >
            {urgentDeadlineCount} deadlines vragen aandacht
          </Badge>
        ) : null}
      </div>
    </div>
  );
}
