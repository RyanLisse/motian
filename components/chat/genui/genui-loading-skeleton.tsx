"use client";

export function GenUILoadingSkeleton({ label }: { label: string }) {
  return (
    <div className="my-1.5 animate-pulse rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <div className="h-4 w-4 rounded bg-muted" />
        <span className="text-xs text-muted-foreground">{label} laden...</span>
      </div>
      <div className="mt-2 space-y-2">
        <div className="h-3 w-3/4 rounded bg-muted" />
        <div className="h-3 w-1/2 rounded bg-muted" />
      </div>
    </div>
  );
}
