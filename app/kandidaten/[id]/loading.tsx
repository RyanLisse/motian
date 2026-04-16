import { Skeleton } from "@/components/ui/skeleton";

export default function KandidaatDetailLoading() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="mx-auto max-w-6xl space-y-6 px-4 py-6 sm:px-6 lg:px-8">
        <section className="rounded-[28px] border border-border/80 bg-card/95 p-5 shadow-sm sm:p-6">
          <div className="mb-5 flex flex-wrap items-start justify-between gap-3">
            <Skeleton className="h-5 w-40 bg-muted" />
            <Skeleton className="h-9 w-28 rounded-md bg-muted" />
          </div>

          <div className="grid gap-5 xl:grid-cols-[minmax(0,1.4fr)_minmax(320px,0.8fr)]">
            <div className="min-w-0 space-y-5">
              <div className="flex items-start gap-4">
                <Skeleton className="h-20 w-20 shrink-0 rounded-3xl bg-muted" />
                <div className="min-w-0 flex-1 space-y-3">
                  <Skeleton className="h-8 w-full max-w-sm bg-muted" />
                  <Skeleton className="h-5 w-full max-w-56 bg-muted" />
                  <Skeleton className="h-4 w-full max-w-xl bg-muted" />
                  <Skeleton className="h-4 w-full max-w-lg bg-muted" />
                </div>
              </div>

              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 5 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  <Skeleton key={`badge-${i}`} className="h-6 w-24 rounded-full bg-muted" />
                ))}
              </div>

              <div className="flex flex-wrap gap-2">
                {Array.from({ length: 3 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  <Skeleton key={`action-${i}`} className="h-9 w-32 rounded-md bg-muted" />
                ))}
              </div>
            </div>

            <div className="space-y-3">
              <div className="rounded-2xl border border-border/70 bg-background/55 p-4">
                <div className="flex items-center gap-4">
                  <Skeleton className="h-16 w-16 rounded-full bg-muted" />
                  <div className="flex-1 space-y-2">
                    <Skeleton className="h-4 w-28 bg-muted" />
                    <Skeleton className="h-6 w-36 bg-muted" />
                    <Skeleton className="h-4 w-full max-w-xs bg-muted" />
                  </div>
                </div>
              </div>

              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-1">
                {["hero-primary", "hero-secondary"].map((key) => (
                  <div
                    key={key}
                    className="rounded-2xl border border-border/70 bg-background/55 p-4"
                  >
                    <Skeleton className="h-3 w-28 bg-muted" />
                    <Skeleton className="mt-3 h-5 w-36 bg-muted" />
                    <Skeleton className="mt-2 h-4 w-full max-w-xs bg-muted" />
                  </div>
                ))}
              </div>
            </div>
          </div>
        </section>

        <section className="rounded-2xl border border-border bg-card p-5">
          <div className="flex flex-wrap items-start justify-between gap-3">
            <div className="space-y-2">
              <Skeleton className="h-5 w-44 bg-muted" />
              <Skeleton className="h-4 w-full max-w-md bg-muted" />
            </div>
            <div className="flex flex-wrap gap-2">
              <Skeleton className="h-9 w-32 rounded-md bg-muted" />
              <Skeleton className="h-9 w-28 rounded-md bg-muted" />
            </div>
          </div>

          <div className="mt-4 grid gap-3 lg:grid-cols-2">
            {["workflow-primary", "workflow-secondary"].map((key) => (
              <div key={key} className="rounded-xl border border-border bg-background/60 p-4">
                <Skeleton className="h-5 w-full max-w-56 bg-muted" />
                <Skeleton className="mt-2 h-4 w-full max-w-40 bg-muted" />
                <div className="mt-4 flex flex-wrap gap-2">
                  <Skeleton className="h-5 w-20 rounded-full bg-muted" />
                  <Skeleton className="h-5 w-24 rounded-full bg-muted" />
                </div>
              </div>
            ))}
          </div>
        </section>

        <div className="rounded-2xl border border-border bg-card p-5">
          <div className="grid gap-4 lg:grid-cols-3">
            <Skeleton className="h-32 rounded-xl bg-muted lg:col-span-2" />
            <Skeleton className="h-32 rounded-xl bg-muted" />
          </div>
        </div>

        <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
          <div className="space-y-6 lg:col-span-2">
            <section className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-5 w-28 bg-muted" />
              <Skeleton className="mt-4 h-4 w-full bg-muted" />
              <Skeleton className="mt-2 h-4 w-full max-w-3xl bg-muted" />
              <Skeleton className="mt-2 h-4 w-full max-w-2xl bg-muted" />
            </section>

            <section>
              <Skeleton className="mb-3 h-5 w-36 bg-muted" />
              <div className="space-y-3">
                {["employment-primary", "employment-secondary", "employment-tertiary"].map(
                  (key) => (
                    <div key={key} className="rounded-xl border border-border bg-card p-4">
                      <Skeleton className="h-5 w-full max-w-52 bg-muted" />
                      <Skeleton className="mt-2 h-4 w-32 bg-muted" />
                      <Skeleton className="mt-4 h-4 w-full bg-muted" />
                      <Skeleton className="mt-2 h-4 w-full max-w-2xl bg-muted" />
                    </div>
                  ),
                )}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-5 w-32 bg-muted" />
              <Skeleton className="mt-4 h-24 rounded-xl bg-muted" />
            </section>
          </div>

          <div className="space-y-6">
            <section className="rounded-xl border border-border bg-card p-4">
              <div className="flex items-center gap-2">
                <Skeleton className="h-5 w-36 bg-muted" />
              </div>
              <Skeleton className="mt-4 h-32 rounded-xl bg-muted" />
              <div className="mt-4 space-y-3">
                {["match-primary", "match-secondary"].map((key) => (
                  <div key={key} className="rounded-xl border border-border bg-background/60 p-4">
                    <Skeleton className="h-5 w-full max-w-40 bg-muted" />
                    <Skeleton className="mt-2 h-4 w-full max-w-28 bg-muted" />
                    <div className="mt-4 flex flex-wrap gap-2">
                      <Skeleton className="h-5 w-16 rounded-full bg-muted" />
                      <Skeleton className="h-5 w-20 rounded-full bg-muted" />
                    </div>
                  </div>
                ))}
              </div>
            </section>

            <section className="rounded-xl border border-border bg-card p-4">
              <Skeleton className="h-5 w-32 bg-muted" />
              <div className="mt-4 grid gap-3">
                {Array.from({ length: 2 }).map((_, i) => (
                  // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
                  <Skeleton key={`score-${i}`} className="h-24 rounded-xl bg-muted" />
                ))}
              </div>
            </section>
          </div>
        </div>
      </div>
    </div>
  );
}
