import { Skeleton } from "@/components/ui/skeleton";

export default function ScraperLoading() {
  return (
    <div className="min-h-0 min-w-0 flex-1 overflow-y-auto">
      <div className="mx-auto min-w-0 max-w-[1400px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <div>
          <Skeleton className="h-7 w-48 bg-muted" />
          <Skeleton className="mt-2 h-4 w-96 bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-6">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`kpi-${i}`} className="h-20 rounded-xl bg-card" />
          ))}
        </div>
        <div className="grid min-w-0 gap-6 xl:grid-cols-[1.1fr_0.9fr]">
          <Skeleton className="h-48 rounded-xl bg-card" />
          <Skeleton className="h-48 rounded-xl bg-card" />
        </div>
        <Skeleton className="h-64 rounded-xl bg-card" />
        <div className="grid gap-6 xl:grid-cols-[minmax(0,1.3fr)_minmax(0,0.7fr)]">
          <Skeleton className="h-48 rounded-xl bg-card" />
          <Skeleton className="h-48 rounded-xl bg-card" />
        </div>
        <div className="grid min-w-0 gap-4 md:grid-cols-2 lg:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`health-${i}`} className="h-64 rounded-xl bg-card" />
          ))}
        </div>
        <Skeleton className="h-48 rounded-xl bg-card" />
      </div>
    </div>
  );
}
