import { Skeleton } from "@/components/ui/skeleton";

export default function OverzichtLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <div>
          <Skeleton className="h-8 w-40 bg-[#2d2d2d]" />
          <Skeleton className="h-4 w-72 mt-2 bg-[#2d2d2d]" />
        </div>
        <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
          {Array.from({ length: 4 }).map((_, i) => (
            <Skeleton key={i} className="h-20 rounded-xl bg-[#1e1e1e]" />
          ))}
        </div>
        <div className="grid gap-6 lg:grid-cols-3">
          <div className="lg:col-span-2 space-y-6">
            <Skeleton className="h-64 rounded-xl bg-[#1e1e1e]" />
            <Skeleton className="h-48 rounded-xl bg-[#1e1e1e]" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-48 rounded-xl bg-[#1e1e1e]" />
            <Skeleton className="h-48 rounded-xl bg-[#1e1e1e]" />
          </div>
        </div>
      </div>
    </div>
  );
}
