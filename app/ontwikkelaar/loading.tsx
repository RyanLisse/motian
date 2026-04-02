import { Skeleton } from "@/components/ui/skeleton";

export default function OntwikkelaarLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1400px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <div>
          <Skeleton className="h-7 w-40 bg-muted" />
          <Skeleton className="mt-2 h-4 w-80 bg-muted" />
        </div>
        <div className="grid gap-4 lg:grid-cols-[1.2fr_0.8fr]">
          <Skeleton className="h-64 rounded-xl bg-card" />
          <Skeleton className="h-64 rounded-xl bg-card" />
        </div>
        <Skeleton className="h-80 rounded-xl bg-card" />
      </div>
    </div>
  );
}
