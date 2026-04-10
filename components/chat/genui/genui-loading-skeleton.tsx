"use client";

import { cn } from "@/lib/utils";

export function GenUILoadingSkeleton({
  label,
  className,
  rows = 2,
}: {
  label: string;
  className?: string;
  rows?: number;
}) {
  const rowTemplates = [
    { id: "primary", widthClass: "w-full" },
    { id: "secondary", widthClass: "w-4/5" },
    { id: "tertiary", widthClass: "w-3/4" },
    { id: "quaternary", widthClass: "w-2/3" },
  ];
  const bodyRows =
    rows <= 1
      ? [{ id: "tail", widthClass: "w-1/2" }]
      : [...rowTemplates.slice(0, Math.max(rows - 1, 1)), { id: "tail", widthClass: "w-1/2" }];

  return (
    <div
      className={cn(
        "my-1.5 overflow-hidden rounded-lg border border-border bg-card p-4",
        className,
      )}
    >
      <div className="animate-pulse">
        <div className="flex min-h-11 items-center gap-3">
          <div className="h-5 w-5 rounded-full bg-muted" />
          <span className="text-sm text-muted-foreground">{label} laden...</span>
        </div>
        <div className="mt-3 space-y-2">
          {bodyRows.map((row) => (
            <div
              key={`${label}-${row.id}`}
              className={cn("h-3 rounded-full bg-muted", row.widthClass)}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
