import { Skeleton } from "@/components/ui/skeleton";

export default function SettingsLoading() {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[800px] space-y-6 px-4 py-6 md:px-6 lg:px-8">
        <div className="space-y-2">
          <Skeleton className="h-7 w-36 bg-muted" />
          <Skeleton className="h-4 w-64 bg-muted" />
        </div>
        <Skeleton className="h-64 rounded-xl bg-card" />
        <Skeleton className="h-32 rounded-xl bg-card" />
      </div>
    </div>
  );
}
