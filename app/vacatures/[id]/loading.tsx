import { Skeleton } from "@/components/ui/skeleton";

export default function VacatureDetailLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-[1400px] px-4 py-6 md:px-6 lg:px-8">
        <section className="rounded-[28px] border border-border bg-card p-5 shadow-sm sm:p-6">
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              <Skeleton className="h-6 w-24 rounded-full bg-muted" />
              <Skeleton className="h-6 w-36 rounded-full bg-muted" />
              <Skeleton className="ml-auto h-9 w-24 rounded-md bg-muted" />
            </div>

            <div className="flex items-start gap-3">
              <Skeleton className="h-14 w-14 shrink-0 rounded-2xl bg-muted" />
              <div className="min-w-0 flex-1 space-y-3">
                <Skeleton className="h-8 w-80 max-w-full bg-muted" />
                <Skeleton className="h-5 w-40 max-w-full bg-muted" />
              </div>
            </div>

            <div className="flex flex-wrap gap-x-5 gap-y-2">
              {["location", "arrangement", "rate", "start"].map((key) => (
                <Skeleton key={key} className="h-5 w-36 rounded-full bg-muted" />
              ))}
            </div>
          </div>
        </section>

        <div className="mx-auto mt-5 flex w-full max-w-4xl flex-col gap-5">
          <section className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div className="space-y-2">
                  <Skeleton className="h-6 w-44 bg-muted" />
                  <Skeleton className="h-4 w-96 max-w-full bg-muted" />
                </div>
                <div className="flex flex-wrap gap-2">
                  <Skeleton className="h-9 w-40 rounded-md bg-muted" />
                  <Skeleton className="h-9 w-28 rounded-md bg-muted" />
                </div>
              </div>

              <div className="grid gap-2 sm:grid-cols-3">
                {["deadline", "shortlist", "action"].map((key) => (
                  <Skeleton key={key} className="h-28 rounded-lg bg-card" />
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-40 bg-muted" />
                <Skeleton className="h-4 w-72 max-w-full bg-muted" />
              </div>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {["top-1", "top-2", "top-3"].map((key) => (
                  <Skeleton key={key} className="h-44 rounded-lg bg-card" />
                ))}
              </div>
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="space-y-4">
              <div className="space-y-2">
                <Skeleton className="h-6 w-32 bg-muted" />
                <Skeleton className="h-4 w-full bg-muted" />
                <Skeleton className="h-4 w-5/6 bg-muted" />
              </div>
              <Skeleton className="h-64 rounded-lg bg-card" />
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
