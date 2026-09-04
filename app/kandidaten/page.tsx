import { Search, UserPlus, Users, Zap } from "lucide-react";
import { Suspense } from "react";
import { AddCandidateWizard } from "@/components/add-candidate-wizard";
import { CandidateResultsList } from "@/components/candidate-results-list";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KPICard } from "@/components/shared/kpi-card";
import { Pagination } from "@/components/shared/pagination";
import { Skeleton } from "@/components/ui/skeleton";
import { parsePagination } from "@/src/lib/pagination";
import { loadKandidatenPageData } from "./data";

export const revalidate = 120;

/** Search and pagination via URL (Next.js Learn: adding-search-and-pagination). */
interface Props {
  searchParams: Promise<{
    q?: string;
    beschikbaarheid?: string;
    vaardigheid?: string;
    pagina?: string;
    page?: string;
    limit?: string;
    perPage?: string;
  }>;
}

const DEFAULT_PER_PAGE = 20;
const MAX_PER_PAGE = 50;

function KandidatenSkeleton() {
  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        <Skeleton className="h-8 w-48" />
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          {Array.from({ length: 3 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`kpi-${i}`} className="h-20 rounded-xl" />
          ))}
        </div>
        <Skeleton className="h-9 w-full rounded-lg" />
        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {Array.from({ length: 6 }).map((_, i) => (
            // biome-ignore lint/suspicious/noArrayIndexKey: static skeleton list
            <Skeleton key={`card-${i}`} className="h-40 rounded-lg" />
          ))}
        </div>
      </div>
    </div>
  );
}

async function KandidatenContent({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q ?? "";
  const availability = params.beschikbaarheid ?? "";
  const skillSlug = params.vaardigheid ?? "";

  const urlParams = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value === undefined || value === "") continue;
    const v = Array.isArray(value) ? value[0] : value;
    if (v) urlParams.set(key, v);
  }
  const { page, limit, offset } = parsePagination(urlParams, {
    limit: DEFAULT_PER_PAGE,
    maxLimit: MAX_PER_PAGE,
  });

  const { skillsData, stats, candidateRows, totalCount } = await loadKandidatenPageData({
    query,
    availability,
    skillSlug,
    limit,
    offset,
  });
  const { skillOptions, escoCatalogAvailable, escoCatalogMessage } = skillsData;

  const totalPages = Math.ceil(totalCount / limit) || 1;
  const { directCount, weekCount } = stats;

  return (
    <div className="min-h-0 flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <PageHeader title="Kandidaten" description="Talent pool — overzicht van alle kandidaten">
          <AddCandidateWizard />
        </PageHeader>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-2 sm:gap-3">
          <KPICard icon={<Users className="h-4 w-4" />} label="Totaal" value={totalCount} />
          <KPICard
            icon={<Zap className="h-4 w-4" />}
            label="Direct beschikbaar"
            value={directCount}
            valueClassName="text-primary"
          />
          <KPICard
            icon={<UserPlus className="h-4 w-4" />}
            label="Nieuw deze week"
            value={weekCount}
          />
        </div>

        {/* Search + filters */}
        <form className="grid grid-cols-2 sm:flex sm:flex-row gap-2 sm:gap-3">
          <div className="relative col-span-2">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Zoek op naam..."
              className="w-full h-9 pl-9 pr-3 bg-card border border-border rounded-lg text-sm text-foreground placeholder:text-muted-foreground focus:outline-none focus:border-primary/40"
            />
          </div>
          <select
            name="beschikbaarheid"
            defaultValue={availability}
            className="h-9 px-3 bg-card border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:border-primary/40"
          >
            <option value="">Alle beschikbaarheid</option>
            <option value="direct">Direct beschikbaar</option>
            <option value="1_maand">Binnen 1 maand</option>
            <option value="3_maanden">Binnen 3 maanden</option>
          </select>
          <select
            name="vaardigheid"
            defaultValue={skillSlug}
            className="h-9 px-3 min-w-0 bg-card border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:border-primary/40"
            title="Filter op vaardigheid"
            disabled={!escoCatalogAvailable}
          >
            <option value="">
              {escoCatalogAvailable
                ? "Alle vaardigheden"
                : "Vaardigheden-filter tijdelijk niet beschikbaar"}
            </option>
            {skillOptions.map((s) => (
              <option key={s.slug} value={s.slug} title={s.fullName}>
                {s.name}
              </option>
            ))}
          </select>
          <button
            type="submit"
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Zoeken
          </button>
        </form>
        {!escoCatalogAvailable && (
          <p className="text-xs text-amber-600 dark:text-amber-400">{escoCatalogMessage}</p>
        )}

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            {totalCount} {totalCount === 1 ? "kandidaat" : "kandidaten"} gevonden
          </p>
          {totalPages > 1 && (
            <p className="text-sm text-muted-foreground">
              Pagina {page} van {totalPages}
            </p>
          )}
        </div>

        {/* Grid */}
        {candidateRows.length === 0 ? (
          <EmptyState
            icon={<Users className="h-8 w-8" />}
            title="Geen kandidaten gevonden"
            subtitle="Pas je zoekopdracht of filters aan"
          />
        ) : (
          <CandidateResultsList candidates={candidateRows} />
        )}

        {/* Pagination */}
        <Pagination
          page={page}
          totalPages={totalPages}
          buildHref={(p) => {
            const sp = new URLSearchParams();
            if (query) sp.set("q", query);
            if (availability) sp.set("beschikbaarheid", availability);
            sp.set("pagina", String(p));
            if (limit !== DEFAULT_PER_PAGE) sp.set("limit", String(limit));
            return `/kandidaten?${sp.toString()}`;
          }}
        />

        <div className="h-8" />
      </div>
    </div>
  );
}

export default function KandidatenPage(props: Props) {
  return (
    <Suspense fallback={<KandidatenSkeleton />}>
      <KandidatenContent {...props} />
    </Suspense>
  );
}
