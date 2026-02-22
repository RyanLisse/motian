import { Skeleton } from "@/components/ui/skeleton";

export default function ProfessionalsLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-48 bg-[#2d2d2d]" />
          <Skeleton className="h-4 w-64 mt-2 bg-[#2d2d2d]" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-[#1e1e1e]" />
          ))}
        </div>
        <Skeleton className="h-9 w-full rounded-lg bg-[#1e1e1e]" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            <Skeleton key={i} className="h-40 rounded-lg bg-[#1e1e1e]" />
          ))}
        </div>
      </div>
    </div>
  );
}
