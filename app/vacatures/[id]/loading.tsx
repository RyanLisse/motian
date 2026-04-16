import { Skeleton } from "@/components/ui/skeleton";

export default function VacatureDetailLoading() {
  return (
    <div className="flex min-h-0 min-w-0 flex-1 flex-col overflow-hidden">
      <div className="border-b border-border bg-background/95 px-4 py-4 sm:px-6">
        <Skeleton className="mb-4 h-5 w-36 bg-muted" />

        <div className="mb-3 flex flex-wrap items-center gap-2">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`tag-${i}`} className="h-6 w-20 rounded-full bg-muted" />
          ))}
          <div className="ml-auto flex items-center gap-2">
            <Skeleton className="h-8 w-8 rounded-md bg-muted" />
            <Skeleton className="h-8 w-8 rounded-md bg-muted" />
          </div>
        </div>

        <div className="flex items-start gap-3">
          <Skeleton className="h-14 w-14 rounded-xl bg-muted" />
          <div className="min-w-0 flex-1 space-y-2">
            <Skeleton className="h-8 w-full max-w-xl bg-muted" />
            <Skeleton className="h-5 w-full max-w-xs bg-muted" />
          </div>
        </div>

        <div className="mt-4 flex flex-wrap gap-x-5 gap-y-2">
          {Array.from({ length: 4 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`meta-${i}`} className="h-4 w-28 bg-muted" />
          ))}
        </div>
      </div>

      <div className="min-h-0 flex-1 overflow-y-auto">
        <div className="mx-auto flex w-full max-w-4xl flex-col gap-5 px-4 py-4 sm:px-6 sm:py-5">
          <div className="rounded-lg border border-border bg-card p-3">
            <Skeleton className="h-10 w-full bg-muted" />
          </div>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div className="space-y-2">
                <Skeleton className="h-5 w-40 bg-muted" />
                <Skeleton className="h-4 w-full max-w-lg bg-muted" />
              </div>
              <div className="flex flex-wrap gap-2">
                <Skeleton className="h-9 w-36 rounded-md bg-muted" />
                <Skeleton className="h-9 w-28 rounded-md bg-muted" />
              </div>
            </div>

            <div className="mt-4 grid gap-2 sm:grid-cols-3">
              {["cockpit-deadline", "cockpit-shortlist", "cockpit-next-step"].map((key) => (
                <div key={key} className="rounded-lg border border-border bg-background/60 p-3">
                  <Skeleton className="h-3 w-20 bg-muted" />
                  <Skeleton className="mt-3 h-5 w-28 bg-muted" />
                  <Skeleton className="mt-2 h-4 w-full bg-muted" />
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-5 w-36 bg-muted" />
            <div className="mt-4 grid gap-3 lg:grid-cols-3">
              <Skeleton className="h-24 rounded-xl bg-muted lg:col-span-2" />
              <Skeleton className="h-24 rounded-xl bg-muted" />
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="space-y-2">
                <Skeleton className="h-5 w-28 bg-muted" />
                <Skeleton className="h-4 w-full max-w-md bg-muted" />
              </div>
              <Skeleton className="h-4 w-24 bg-muted" />
            </div>

            <div className="mt-4 grid gap-3 xl:grid-cols-2">
              {["candidate-primary", "candidate-secondary"].map((key) => (
                <div key={key} className="rounded-lg border border-border bg-background/60 p-3">
                  <Skeleton className="h-5 w-full max-w-44 bg-muted" />
                  <Skeleton className="mt-2 h-4 w-full max-w-32 bg-muted" />
                  <div className="mt-4 flex flex-wrap gap-2">
                    <Skeleton className="h-5 w-16 rounded-full bg-muted" />
                    <Skeleton className="h-5 w-20 rounded-full bg-muted" />
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-5 w-44 bg-muted" />
            <Skeleton className="mt-4 h-10 w-full max-w-xs bg-muted" />
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-5 w-32 bg-muted" />
            <Skeleton className="mt-4 h-20 rounded-xl bg-muted" />
          </section>

          <section className="rounded-lg border border-border bg-card p-4">
            <Skeleton className="h-5 w-40 bg-muted" />
            <div className="mt-4 space-y-2">
              {Array.from({ length: 6 }).map((_, i) => (
                // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                <Skeleton key={`description-${i}`} className="h-4 w-full bg-muted" />
              ))}
            </div>
          </section>
        </div>
      </div>
    </div>
  );
}
