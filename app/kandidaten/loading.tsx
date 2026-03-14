import { Skeleton } from "@/components/ui/skeleton";

export default function KandidatenLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-48 bg-muted" />
          <Skeleton className="h-4 w-64 mt-2 bg-muted" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => {
            const uniqueKey = `skeleton-1-${i}`;
            return <Skeleton key={uniqueKey} className="h-20 rounded-xl bg-card" />;
          })}
        </div>
        <Skeleton className="h-9 w-full rounded-lg bg-card" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => {
            const uniqueKey = `skeleton-2-${i}`;
            return <Skeleton key={uniqueKey} className="h-40 rounded-lg bg-card" />;
          })}
        </div>
      </div>
    </div>
  );
}
