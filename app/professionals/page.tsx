import { and, desc, eq, gte, ilike, isNull, sql } from "drizzle-orm";
import { Euro, MapPin, Search, UserPlus, Users, Zap } from "lucide-react";
import Link from "next/link";
import { AddCandidateDialog } from "@/components/add-candidate-dialog";
import { DraggableCandidate } from "@/components/draggable-candidate";
import { EmptyState } from "@/components/shared/empty-state";
import { KPICard } from "@/components/shared/kpi-card";
import { Pagination } from "@/components/shared/pagination";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";
import { candidates } from "@/src/db/schema";
import { escapeLike } from "@/src/lib/helpers";

export const revalidate = 60;

interface Props {
  searchParams: Promise<{
    q?: string;
    beschikbaarheid?: string;
    pagina?: string;
  }>;
}

const PER_PAGE = 20;

const availabilityLabels: Record<string, string> = {
  direct: "Direct beschikbaar",
  "1_maand": "Binnen 1 maand",
  "3_maanden": "Binnen 3 maanden",
};

export default async function ProfessionalsPage({ searchParams }: Props) {
  const params = await searchParams;
  const query = params.q ?? "";
  const availability = params.beschikbaarheid ?? "";
  const page = Math.max(1, parseInt(params.pagina ?? "1", 10));
  const offset = (page - 1) * PER_PAGE;

  // Build conditions
  const conditions = [isNull(candidates.deletedAt)];

  if (query) {
    conditions.push(ilike(candidates.name, `%${escapeLike(query)}%`));
  }
  if (availability) {
    conditions.push(eq(candidates.availability, availability));
  }

  const whereClause = and(...conditions);

  // Fetch candidates + counts in parallel
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [candidateRows, countResult, availableCount, newThisWeekCount] = await Promise.all([
    db
      .select()
      .from(candidates)
      .where(whereClause)
      .orderBy(desc(candidates.createdAt))
      .limit(PER_PAGE)
      .offset(offset),
    db.select({ count: sql<number>`count(*)::int` }).from(candidates).where(whereClause),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(candidates)
      .where(and(isNull(candidates.deletedAt), eq(candidates.availability, "direct"))),
    db
      .select({ count: sql<number>`count(*)::int` })
      .from(candidates)
      .where(and(isNull(candidates.deletedAt), gte(candidates.createdAt, oneWeekAgo))),
  ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const directCount = availableCount[0]?.count ?? 0;
  const weekCount = newThisWeekCount[0]?.count ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-[1400px] mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-start justify-between gap-4">
          <div>
            <h1 className="text-xl font-bold text-foreground">Professionals</h1>
            <p className="text-sm text-muted-foreground mt-1">
              Talent pool — overzicht van alle kandidaten
            </p>
          </div>
          <AddCandidateDialog />
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
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
        <form className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
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
          <button
            type="submit"
            className="h-9 px-4 bg-primary hover:bg-primary/90 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Zoeken
          </button>
        </form>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">{totalCount} professionals gevonden</p>
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
            title="Geen professionals gevonden"
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
                  <Link href={`/professionals/${candidate.id}`}>
                    <div className="bg-card border border-border rounded-lg p-4 hover:border-primary/40 hover:bg-accent transition-colors cursor-pointer pl-6">
                      {/* Name + source */}
                      <div className="flex items-start justify-between gap-2 mb-3">
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
                      <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-3">
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
                        <div className="flex flex-wrap gap-1.5 mb-3">
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
          buildHref={(p) =>
            `/professionals?${new URLSearchParams({
              ...(query ? { q: query } : {}),
              ...(availability ? { beschikbaarheid: availability } : {}),
              pagina: String(p),
            }).toString()}`
          }
        />

        <div className="h-8" />
      </div>
    </div>
  );
}
