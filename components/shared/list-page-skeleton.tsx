import { Skeleton } from "@/components/ui/skeleton";

type ListPageSkeletonProps = {
  /** Max width class (default: max-w-7xl) */
  maxWidth?: string;
  /** First line skeleton width (default: w-40) */
  titleWidth?: string;
  /** Second line width (default: w-56) */
  subtitleWidth?: string;
  /** Grid columns (default: grid-cols-2 sm:grid-cols-4) */
  gridCols?: string;
  /** Number of grid items (default: 4) */
  gridCount?: number;
  /** Number of chip skeletons (default: 4) */
  chipCount?: number;
  /** Number of list row skeletons (default: 5) */
  listCount?: number;
};

export function ListPageSkeleton({
  maxWidth = "max-w-7xl",
  titleWidth = "w-40",
  subtitleWidth = "w-56",
  gridCols = "grid-cols-2 sm:grid-cols-4",
  gridCount = 4,
  chipCount = 4,
  listCount = 5,
}: ListPageSkeletonProps = {}) {
  return (
    <div className="flex-1 overflow-y-auto">
      <div className={`${maxWidth} mx-auto px-6 py-6 space-y-6`}>
        <div>
          <Skeleton className={`h-7 ${titleWidth} bg-muted`} />
          <Skeleton className={`h-4 ${subtitleWidth} mt-2 bg-muted`} />
        </div>
        <div className={`grid ${gridCols} gap-3`}>
          {Array.from({ length: gridCount }).map((_, i) => (
            <Skeleton key={`skeleton-1-${i}`} className="h-16 rounded-lg bg-card" />
          ))}
        </div>
        <div className="flex items-center gap-2">
          {Array.from({ length: chipCount }).map((_, i) => (
            <Skeleton key={`skeleton-2-${i}`} className="h-8 w-24 rounded-md bg-card" />
          ))}
        </div>
        <div className="grid gap-3">
          {Array.from({ length: listCount }).map((_, i) => (
            <Skeleton key={`skeleton-3-${i}`} className="h-28 rounded-lg bg-card" />
          ))}
        </div>
      </div>
    </div>
  );
}
