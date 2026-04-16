import { Skeleton } from "@/components/ui/skeleton";

export default function KandidaatDetailLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl px-4 py-6 sm:px-6 lg:px-8">
        <section className="mb-8 rounded-[28px] border border-border/80 bg-card/95 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-4 w-28 bg-muted" />
              <Skeleton className="h-4 w-40 bg-muted" />
            </div>
            <Skeleton className="h-9 w-32 rounded-md bg-muted" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <div className="min-w-0 space-y-5">
              <div className="flex items-start gap-4">
                <Skeleton className="h-20 w-20 shrink-0 rounded-3xl bg-muted" />
                <div className="min-w-0 flex-1 space-y-3">
                  <Skeleton className="h-8 w-56 max-w-full bg-muted" />
                  <Skeleton className="h-5 w-40 max-w-full bg-muted" />
                  <Skeleton className="h-4 w-full bg-muted" />
                  <Skeleton className="h-4 w-5/6 bg-muted" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {["location", "availability", "applications", "rate", "contact"].map((key) => (
                  <Skeleton key={key} className="h-7 w-28 rounded-full bg-muted" />
                ))}
              </div>

              <Skeleton className="h-4 w-44 bg-muted" />

              <div className="flex flex-wrap gap-2">
                {["workflow", "offer", "save", "call"].map((key) => (
                  <Skeleton key={key} className="h-9 w-36 rounded-md bg-muted" />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <Skeleton className="h-44 rounded-3xl bg-card" />
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {["readiness", "status"].map((key) => (
                  <Skeleton key={key} className="h-28 rounded-2xl bg-card" />
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="mb-8 space-y-4 rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-6 w-48 bg-muted" />
              <Skeleton className="h-4 w-80 max-w-full bg-muted" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-36 rounded-md bg-muted" />
              <Skeleton className="h-9 w-32 rounded-md bg-muted" />
            </div>
          </div>
          <div className="grid gap-3 lg:grid-cols-2">
            <Skeleton className="h-40 rounded-xl bg-card" />
            <Skeleton className="h-40 rounded-xl bg-card" />
          </div>
        </section>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <Skeleton className="h-48 rounded-xl bg-card" />
            <Skeleton className="h-80 rounded-xl bg-card" />
            <Skeleton className="h-72 rounded-xl bg-card" />
          </div>
          <div className="space-y-6">
            <Skeleton className="h-56 rounded-xl bg-card" />
            <Skeleton className="h-72 rounded-xl bg-card" />
          </div>
        </div>
      </div>
    </div>
  );
}
