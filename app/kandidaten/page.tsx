import { Euro, MapPin, Search, UserPlus, Users, Zap } from "lucide-react";
import Link from "next/link";
import { Suspense } from "react";
import { AddCandidateWizard } from "@/components/add-candidate-wizard";
import { DataRefreshListener } from "@/components/data-refresh-listener";
import { DraggableCandidate } from "@/components/draggable-candidate";
import { PageHeader } from "@/components/page-header";
import { EmptyState } from "@/components/shared/empty-state";
import { KPICard } from "@/components/shared/kpi-card";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { Skeleton } from "@/components/ui/skeleton";
import { db, isNull, sql } from "@/src/db";
import { candidates } from "@/src/db/schema";
import { parsePagination } from "@/src/lib/pagination";
import { countCandidates, listCandidates, searchCandidates } from "@/src/services/candidates";
import { getEscoCatalogStatus, listEscoSkillsForFilter } from "@/src/services/esco";

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

const availabilityLabels: Record<string, string> = {
  direct: "Direct beschikbaar",
  "1_maand": "Binnen 1 maand",
  "3_maanden": "Binnen 3 maanden",
};

function KandidatenSkeleton() {
  return (
    <div className="flex-1 overflow-y-auto">
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
  const escoUri = params.vaardigheid ?? "";

  let skillOptions: { uri: string; labelNl: string | null; labelEn: string }[] = [];
  let escoCatalogAvailable = false;
  let escoCatalogMessage = "ESCO-filter is tijdelijk niet beschikbaar.";
  try {
    const [catalogStatus, nextSkillOptions] = await Promise.all([
      getEscoCatalogStatus(),
      listEscoSkillsForFilter(),
    ]);
    skillOptions = nextSkillOptions;
    escoCatalogAvailable = catalogStatus.available;
    if (catalogStatus.issue === "missing_catalog" || catalogStatus.issue === "missing_skills") {
      escoCatalogMessage = "ESCO-catalogus ontbreekt; importeer eerst de dataset.";
    } else if (catalogStatus.issue === "missing_aliases") {
      escoCatalogMessage =
        "ESCO-aliases ontbreken; exacte labels werken nog wel, maar mapping is beperkt.";
    }
  } catch (err) {
    console.error("[Kandidaten] listEscoSkillsForFilter failed:", err);
  }

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

  // Fetch candidates + consolidated counts in parallel (reduces DB connections)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);
  const useSearch = Boolean(query || availability || (escoUri && escoCatalogAvailable));
  const searchOptions = {
    query: query || undefined,
    availability: availability || undefined,
    escoUri: escoCatalogAvailable ? escoUri || undefined : undefined,
    limit,
    offset,
  };

  const [candidateRows, statsResult, totalCount] = await Promise.all([
    useSearch ? searchCandidates(searchOptions) : listCandidates({ limit, offset }),
    // All 3 counts in a single query using FILTER clauses
    db
      .select({
        directCount: sql<number>`cast(count(*) filter (where ${candidates.availability} = 'direct') as integer)`,
        weekCount: sql<number>`cast(count(*) filter (where ${candidates.createdAt} >= ${oneWeekAgo}) as integer)`,
      })
      .from(candidates)
      .where(isNull(candidates.deletedAt)),
    useSearch
      ? countCandidates({
          query: searchOptions.query,
          availability: searchOptions.availability,
          escoUri: searchOptions.escoUri,
        })
      : countCandidates(),
  ]);

  const totalPages = Math.ceil(totalCount / limit) || 1;
  const directCount = statsResult[0]?.directCount ?? 0;
  const weekCount = statsResult[0]?.weekCount ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
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
            defaultValue={escoUri}
            className="h-9 px-3 min-w-[180px] bg-card border border-border rounded-lg text-sm text-muted-foreground focus:outline-none focus:border-primary/40"
            title="Filter op canonieke vaardigheid (ESCO)"
            disabled={!escoCatalogAvailable}
          >
            <option value="">
              {escoCatalogAvailable
                ? "Alle vaardigheden"
                : "ESCO-filter tijdelijk niet beschikbaar"}
            </option>
            {skillOptions.map((s) => (
              <option key={s.uri} value={s.uri}>
                {s.labelNl ?? s.labelEn}
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
          <p className="text-sm text-muted-foreground">{totalCount} kandidaten gevonden</p>
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
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {candidateRows.map((candidate) => {
              const skills = Array.isArray(candidate.skills) ? (candidate.skills as string[]) : [];

              return (
                <DraggableCandidate
                  key={candidate.id}
                  candidateId={candidate.id}
                  candidateName={candidate.name}
                >
                  <Link href={`/kandidaten/${candidate.id}`}>
                    <div className="bg-card border border-border rounded-lg p-3 sm:p-4 hover:border-primary/40 hover:bg-accent transition-colors cursor-pointer pl-6">
                      {/* Name + source */}
                      <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
                        <div>
                          <h3 className="text-sm font-semibold text-foreground leading-snug">
                            {candidate.name}
                          </h3>
                          {candidate.role && (
                            <p className="text-xs text-muted-foreground mt-0.5">{candidate.role}</p>
                          )}
                        </div>
                        {candidate.source && (
                          <Badge
                            variant="outline"
                            className="shrink-0 text-[10px] capitalize border-border text-muted-foreground bg-transparent"
                          >
                            {candidate.source}
                          </Badge>
                        )}
                      </div>

                      {/* Meta */}
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-2 sm:mb-3">
                        {candidate.location && (
                          <span className="flex items-center gap-1.5">
                            <MapPin className="h-3.5 w-3.5" />
                            {candidate.location}
                          </span>
                        )}
                        {candidate.hourlyRate && (
                          <span className="flex items-center gap-1.5">
                            <Euro className="h-3.5 w-3.5" />
                            {candidate.hourlyRate}/uur
                          </span>
                        )}
                      </div>

                      {/* Skills */}
                      {skills.length > 0 && (
                        <div className="flex flex-wrap gap-1.5 mb-2 sm:mb-3">
                          {skills.slice(0, 5).map((skill) => (
                            <Badge
                              key={`${candidate.id}-${skill}`}
                              variant="outline"
                              className="bg-primary/10 text-primary border-primary/20 text-[10px]"
                            >
                              {skill}
                            </Badge>
                          ))}
                          {skills.length > 5 && (
                            <Badge
                              variant="outline"
                              className="text-[10px] border-border text-muted-foreground bg-transparent"
                            >
                              +{skills.length - 5}
                            </Badge>
                          )}
                        </div>
                      )}

                      {/* Availability badge */}
                      {candidate.availability && (
                        <Badge
                          variant="outline"
                          className={
                            candidate.availability === "direct"
                              ? "bg-primary/10 text-primary border-primary/20 text-[10px]"
                              : "text-[10px] border-border text-muted-foreground bg-transparent"
                          }
                        >
                          {availabilityLabels[candidate.availability] ?? candidate.availability}
                        </Badge>
                      )}
                    </div>
                  </Link>
                </DraggableCandidate>
              );
            })}
          </div>
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
    <>
      <DataRefreshListener
        events={["candidate:created", "candidate:updated", "candidate:deleted"]}
      />
      <Suspense fallback={<KandidatenSkeleton />}>
        <KandidatenContent {...props} />
      </Suspense>
    </>
  );
}
