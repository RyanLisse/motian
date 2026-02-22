import { Skeleton } from "@/components/ui/skeleton";

export default function MatchingLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-36 bg-[#2d2d2d]" />
          <Skeleton className="h-4 w-80 mt-2 bg-[#2d2d2d]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-[#1e1e1e]" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-28 rounded-lg bg-[#1e1e1e]" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-44 rounded-xl bg-[#1e1e1e]" />
          ))}
        </div>
      </div>
    </div>
  );
}
