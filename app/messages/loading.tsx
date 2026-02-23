import { Skeleton } from "@/components/ui/skeleton";

export default function MessagesLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-7xl mx-auto px-6 py-6 space-y-6">
        <div>
          <Skeleton className="h-7 w-36 bg-[#2d2d2d]" />
          <Skeleton className="h-4 w-52 mt-2 bg-[#2d2d2d]" />
        </div>
        <div className="grid grid-cols-3 gap-3">
          {Array.from({ length: 3 }).map((_, i) => {
            const uniqueKey = `skeleton-1-${i}`;
            return <Skeleton key={uniqueKey} className="h-16 rounded-lg bg-[#1e1e1e]" />;
          })}
        </div>
        <div className="flex items-center gap-4">
          {Array.from({ length: 5 }).map((_, i) => {
            const uniqueKey = `skeleton-2-${i}`;
            return <Skeleton key={uniqueKey} className="h-8 w-24 rounded-md bg-[#1e1e1e]" />;
          })}
        </div>
        <div className="grid gap-3">
          {Array.from({ length: 5 }).map((_, i) => {
            const uniqueKey = `skeleton-3-${i}`;
            return <Skeleton key={uniqueKey} className="h-24 rounded-lg bg-[#1e1e1e]" />;
          })}
        </div>
      </div>
    </div>
  );
}
