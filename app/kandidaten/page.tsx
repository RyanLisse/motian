import { Euro, MapPin, Search, UserPlus, Users, Zap } from "lucide-react";
import Link from "next/link";
import { AddCandidateWizard } from "@/components/add-candidate-wizard";
import { DraggableCandidate } from "@/components/draggable-candidate";
import { EmptyState } from "@/components/shared/empty-state";
import { KPICard } from "@/components/shared/kpi-card";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { and, db, desc, eq, isNull, like, sql } from "@/src/db";
import { candidateSkills, candidates } from "@/src/db/schema";
import { escapeLike } from "@/src/lib/helpers";
import { parsePagination } from "@/src/lib/pagination";
import { getEscoCatalogStatus, listEscoSkillsForFilter } from "@/src/services/esco";

export const revalidate = 30;

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

export default async function KandidatenPage({ searchParams }: Props) {
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

  // Build conditions
  const conditions = [isNull(candidates.deletedAt)];

  if (query) {
    conditions.push(like(candidates.name, `%${escapeLike(query)}%`));
  }
  if (availability) {
    conditions.push(eq(candidates.availability, availability));
  }
  // Only apply ESCO filter when skills loaded successfully (avoids query failure if candidate_skills missing)
  if (escoUri && escoCatalogAvailable) {
    conditions.push(
      sql`EXISTS (SELECT 1 FROM ${candidateSkills} WHERE ${candidateSkills.candidateId} = ${candidates.id} AND ${candidateSkills.escoUri} = ${escoUri})`,
    );
  }

  const whereClause = and(...conditions);

  // Fetch candidates + consolidated counts in parallel (reduces DB connections)
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  // Extra filter conditions beyond isNull(deletedAt) for the filtered count
  const extraFilters = conditions.length > 1 ? and(...conditions.slice(1)) : null;

  const candidateSelect = {
    id: candidates.id,
    name: candidates.name,
    email: candidates.email,
    phone: candidates.phone,
    role: candidates.role,
    location: candidates.location,
    province: candidates.province,
    skills: candidates.skills,
    experience: candidates.experience,
    preferences: candidates.preferences,
    resumeUrl: candidates.resumeUrl,
    linkedinUrl: candidates.linkedinUrl,
    headline: candidates.headline,
    source: candidates.source,
    notes: candidates.notes,
    hourlyRate: candidates.hourlyRate,
    availability: candidates.availability,
    embedding: candidates.embedding,
    resumeRaw: candidates.resumeRaw,
    resumeParsedAt: candidates.resumeParsedAt,
    skillsStructured: candidates.skillsStructured,
    education: candidates.education,
    certifications: candidates.certifications,
    languageSkills: candidates.languageSkills,
    consentGranted: candidates.consentGranted,
    dataRetentionUntil: candidates.dataRetentionUntil,
    createdAt: candidates.createdAt,
    updatedAt: candidates.updatedAt,
    deletedAt: candidates.deletedAt,
  };

  const [candidateRows, statsResult] = await Promise.all([
    db
      .select(candidateSelect)
      .from(candidates)
      .where(whereClause)
      .orderBy(desc(candidates.createdAt))
      .limit(limit)
      .offset(offset),
    // All 3 counts in a single query using FILTER clauses
    db
      .select({
        totalFiltered: extraFilters
          ? sql<number>`cast(count(*) filter (where ${extraFilters}) as integer)`
          : sql<number>`cast(count(*) as integer)`,
        directCount: sql<number>`cast(count(*) filter (where ${candidates.availability} = 'direct') as integer)`,
        weekCount: sql<number>`cast(count(*) filter (where ${candidates.createdAt} >= ${oneWeekAgo}) as integer)`,
      })
      .from(candidates)
      .where(isNull(candidates.deletedAt)),
  ]);

  const totalCount = statsResult[0]?.totalFiltered ?? 0;
  const totalPages = Math.ceil(totalCount / limit) || 1;
  const directCount = statsResult[0]?.directCount ?? 0;
  const weekCount = statsResult[0]?.weekCount ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex flex-col gap-2 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
          <div>
            <h1 className="text-lg sm:text-xl font-bold text-foreground">Kandidaten</h1>
            <p className="text-sm text-muted-foreground mt-0.5">
              Talent pool — overzicht van alle kandidaten
            </p>
          </div>
          <AddCandidateWizard />
        </div>

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
