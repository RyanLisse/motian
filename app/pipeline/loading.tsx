import { Skeleton } from "@/components/ui/skeleton";

export default function PipelineLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-5xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-32 bg-[#2d2d2d]" />
          <Skeleton className="h-4 w-72 mt-2 bg-[#2d2d2d]" />
        </div>
        <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-[#1e1e1e]" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: 7 }).map((_, i) => (
            <Skeleton key={i} className="h-8 w-24 rounded-lg bg-[#1e1e1e]" />
          ))}
        </div>
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <Skeleton key={i} className="h-24 rounded-xl bg-[#1e1e1e]" />
          ))}
        </div>
      </div>
    </div>
  );
}
