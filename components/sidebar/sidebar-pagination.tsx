"use client";

/**
 * Pagination controls for the sidebar, supporting both compact (dark) and overview variants.
 */
import { ChevronLeft, ChevronRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { PushParamsFn } from "./sidebar-types";

interface SidebarPaginationProps {
  pageParam: number;
  totalPages: number;
  isFetching: boolean;
  pushParams: PushParamsFn;
  variant: "compact" | "overview";
}

export function SidebarPagination({
  pageParam,
  totalPages,
  isFetching,
  pushParams,
  variant,
}: SidebarPaginationProps) {
  if (totalPages <= 1) return null;

  const goToPrev = () => pushParams({ pagina: String(pageParam - 1) });
  const goToNext = () => pushParams({ pagina: String(pageParam + 1) });

  if (variant === "compact") {
    return (
      <div className="flex shrink-0 flex-col gap-2 border-t border-white/10 px-4 py-3 sm:flex-row sm:items-center sm:justify-between">
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-full rounded-[16px] px-4 text-sm text-white/55 hover:bg-white/5 hover:text-white sm:w-auto"
          disabled={pageParam <= 1 || isFetching}
          onClick={goToPrev}
        >
          <ChevronLeft className="h-3.5 w-3.5 mr-1" />
          Vorige
        </Button>
        <Button
          variant="ghost"
          size="sm"
          className="h-10 w-full rounded-[16px] px-4 text-sm text-white/55 hover:bg-white/5 hover:text-white sm:w-auto"
          disabled={pageParam >= totalPages || isFetching}
          onClick={goToNext}
        >
          Volgende
          <ChevronRight className="h-3.5 w-3.5 ml-1" />
        </Button>
      </div>
    );
  }

  return (
    <div className="mt-3 flex flex-col gap-2 border-t border-border/70 pt-3 sm:mt-4 sm:flex-row sm:items-center sm:justify-between sm:pt-4">
      <Button
        variant="outline"
        size="sm"
        className="h-9 border-border bg-background text-foreground"
        disabled={pageParam <= 1 || isFetching}
        onClick={goToPrev}
      >
        <ChevronLeft className="mr-1 h-3.5 w-3.5" />
        Vorige
      </Button>
      <p className="text-center text-xs text-muted-foreground sm:text-sm">
        {pageParam} / {totalPages}
      </p>
      <Button
        variant="outline"
        size="sm"
        className="h-9 border-border bg-background text-foreground"
        disabled={pageParam >= totalPages || isFetching}
        onClick={goToNext}
      >
        Volgende
        <ChevronRight className="ml-1 h-3.5 w-3.5" />
      </Button>
    </div>
  );
}
