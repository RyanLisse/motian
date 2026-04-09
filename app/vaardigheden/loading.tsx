import { Skeleton } from "@/components/ui/skeleton";

export default function VaardighedenLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-48 bg-muted" />
          <Skeleton className="h-4 w-80 mt-2 bg-muted" />
        </div>
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3">
          {Array.from({ length: 3 }).map((_, i) => {
            const uniqueKey = `kpi-skel-${i}`;
            return <Skeleton key={uniqueKey} className="h-20 rounded-xl bg-card" />;
          })}
        </div>
        <div className="flex flex-wrap gap-2">
          {Array.from({ length: 12 }).map((_, i) => {
            const uniqueKey = `badge-skel-${i}`;
            return <Skeleton key={uniqueKey} className="h-8 w-24 rounded-full bg-card" />;
          })}
        </div>
        <div className="space-y-2">
          {Array.from({ length: 8 }).map((_, i) => {
            const uniqueKey = `row-skel-${i}`;
            return <Skeleton key={uniqueKey} className="h-12 w-full rounded-lg bg-card" />;
          })}
        </div>
      </div>
    </div>
  );
}
