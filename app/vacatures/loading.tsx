import { Skeleton } from "@/components/ui/skeleton";

export default function VacaturesLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-4xl space-y-6 px-6 py-6">
        <div>
          <Skeleton className="h-7 w-64 bg-muted" />
          <Skeleton className="mt-2 h-4 w-40 bg-muted" />
        </div>
        <div className="space-y-4">
          <Skeleton className="h-32 rounded-xl bg-card" />
          <Skeleton className="h-48 rounded-xl bg-card" />
          <Skeleton className="h-24 rounded-xl bg-card" />
        </div>
      </div>
    </div>
  );
}
