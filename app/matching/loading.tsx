import { Skeleton } from "@/components/ui/skeleton";

export default function MatchingLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <div>
          <Skeleton className="h-8 w-32 bg-muted" />
          <Skeleton className="mt-2 h-4 w-56 bg-muted" />
        </div>
        <Skeleton className="h-48 rounded-xl bg-card" />
      </div>
    </div>
  );
}
