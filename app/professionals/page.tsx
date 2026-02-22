import { db } from "@/src/db";
import { candidates } from "@/src/db/schema";
import { desc, isNull, ilike, eq, and, sql, gte } from "drizzle-orm";
import Link from "next/link";
import { MapPin, Euro, Search, Users, Zap, UserPlus } from "lucide-react";
import { Badge } from "@/components/ui/badge";

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
    conditions.push(ilike(candidates.name, `%${query}%`));
  }
  if (availability) {
    conditions.push(eq(candidates.availability, availability));
  }

  const whereClause = and(...conditions);

  // Fetch candidates + counts in parallel
  const oneWeekAgo = new Date();
  oneWeekAgo.setDate(oneWeekAgo.getDate() - 7);

  const [candidateRows, countResult, availableCount, newThisWeekCount] =
    await Promise.all([
      db
        .select()
        .from(candidates)
        .where(whereClause)
        .orderBy(desc(candidates.createdAt))
        .limit(PER_PAGE)
        .offset(offset),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(candidates)
        .where(whereClause),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(candidates)
        .where(
          and(isNull(candidates.deletedAt), eq(candidates.availability, "direct"))
        ),
      db
        .select({ count: sql<number>`count(*)::int` })
        .from(candidates)
        .where(
          and(
            isNull(candidates.deletedAt),
            gte(candidates.createdAt, oneWeekAgo)
          )
        ),
    ]);

  const totalCount = countResult[0]?.count ?? 0;
  const totalPages = Math.ceil(totalCount / PER_PAGE);
  const directCount = availableCount[0]?.count ?? 0;
  const weekCount = newThisWeekCount[0]?.count ?? 0;

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-6xl mx-auto px-4 md:px-6 lg:px-8 py-6 space-y-6">
        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[#ececec]">Professionals</h1>
          <p className="text-sm text-[#8e8e8e] mt-1">
            Talent pool — overzicht van alle kandidaten
          </p>
        </div>

        {/* KPI row */}
        <div className="grid grid-cols-3 gap-3">
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#6b6b6b] mb-1">
              <Users className="h-4 w-4" />
              <span className="text-xs">Totaal</span>
            </div>
            <p className="text-2xl font-bold text-[#ececec]">{totalCount}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#6b6b6b] mb-1">
              <Zap className="h-4 w-4" />
              <span className="text-xs">Direct beschikbaar</span>
            </div>
            <p className="text-2xl font-bold text-[#10a37f]">{directCount}</p>
          </div>
          <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
            <div className="flex items-center gap-2 text-[#6b6b6b] mb-1">
              <UserPlus className="h-4 w-4" />
              <span className="text-xs">Nieuw deze week</span>
            </div>
            <p className="text-2xl font-bold text-[#ececec]">{weekCount}</p>
          </div>
        </div>

        {/* Search + filters */}
        <form className="flex flex-col sm:flex-row gap-3">
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-[#6b6b6b]" />
            <input
              type="text"
              name="q"
              defaultValue={query}
              placeholder="Zoek op naam..."
              className="w-full h-9 pl-9 pr-3 bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg text-sm text-[#ececec] placeholder:text-[#6b6b6b] focus:outline-none focus:border-[#10a37f]/40"
            />
          </div>
          <select
            name="beschikbaarheid"
            defaultValue={availability}
            className="h-9 px-3 bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg text-sm text-[#8e8e8e] focus:outline-none focus:border-[#10a37f]/40"
          >
            <option value="">Alle beschikbaarheid</option>
            <option value="direct">Direct beschikbaar</option>
            <option value="1_maand">Binnen 1 maand</option>
            <option value="3_maanden">Binnen 3 maanden</option>
          </select>
          <button
            type="submit"
            className="h-9 px-4 bg-[#10a37f] hover:bg-[#10a37f]/90 text-white text-sm font-medium rounded-lg transition-colors"
          >
            Zoeken
          </button>
        </form>

        {/* Results count */}
        <div className="flex items-center justify-between">
          <p className="text-sm text-[#8e8e8e]">
            {totalCount} professionals gevonden
          </p>
          {totalPages > 1 && (
            <p className="text-sm text-[#6b6b6b]">
              Pagina {page} van {totalPages}
            </p>
          )}
        </div>

        {/* Grid */}
        {candidateRows.length === 0 ? (
          <div className="text-center py-16 text-[#6b6b6b]">
            <p className="text-lg">Geen professionals gevonden</p>
            <p className="text-sm mt-1">
              Pas je zoekopdracht of filters aan
            </p>
          </div>
        ) : (
          <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
            {candidateRows.map((candidate) => {
              const skills = Array.isArray(candidate.skills)
                ? (candidate.skills as string[])
                : [];

              return (
                <Link
                  key={candidate.id}
                  href={`/professionals/${candidate.id}`}
                >
                  <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg p-4 hover:border-[#10a37f]/40 hover:bg-[#232323] transition-colors cursor-pointer">
                    {/* Name + source */}
                    <div className="flex items-start justify-between gap-2 mb-3">
                      <div>
                        <h3 className="text-sm font-semibold text-[#ececec] leading-snug">
                          {candidate.name}
                        </h3>
                        {candidate.role && (
                          <p className="text-xs text-[#8e8e8e] mt-0.5">
                            {candidate.role}
                          </p>
                        )}
                      </div>
                      {candidate.source && (
                        <Badge
                          variant="outline"
                          className="shrink-0 text-[10px] capitalize border-[#2d2d2d] text-[#6b6b6b] bg-transparent"
                        >
                          {candidate.source}
                        </Badge>
                      )}
                    </div>

                    {/* Meta */}
                    <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-[#8e8e8e] mb-3">
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
                        {skills.slice(0, 5).map((skill, i) => (
                          <Badge
                            key={i}
                            variant="outline"
                            className="bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20 text-[10px]"
                          >
                            {skill}
                          </Badge>
                        ))}
                        {skills.length > 5 && (
                          <Badge
                            variant="outline"
                            className="text-[10px] border-[#2d2d2d] text-[#6b6b6b] bg-transparent"
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
                            ? "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20 text-[10px]"
                            : "text-[10px] border-[#2d2d2d] text-[#6b6b6b] bg-transparent"
                        }
                      >
                        {availabilityLabels[candidate.availability] ??
                          candidate.availability}
                      </Badge>
                    )}
                  </div>
                </Link>
              );
            })}
          </div>
        )}

        {/* Pagination */}
        {totalPages > 1 && (
          <div className="flex items-center justify-center gap-2 pt-4">
            {page > 1 && (
              <Link
                href={`/professionals?${new URLSearchParams({
                  ...(query ? { q: query } : {}),
                  ...(availability ? { beschikbaarheid: availability } : {}),
                  pagina: String(page - 1),
                }).toString()}`}
                className="h-9 px-4 flex items-center bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#232323] transition-colors"
              >
                Vorige
              </Link>
            )}
            <span className="text-sm text-[#6b6b6b] px-2">
              {page} / {totalPages}
            </span>
            {page < totalPages && (
              <Link
                href={`/professionals?${new URLSearchParams({
                  ...(query ? { q: query } : {}),
                  ...(availability ? { beschikbaarheid: availability } : {}),
                  pagina: String(page + 1),
                }).toString()}`}
                className="h-9 px-4 flex items-center bg-[#1e1e1e] border border-[#2d2d2d] rounded-lg text-sm text-[#8e8e8e] hover:text-[#ececec] hover:bg-[#232323] transition-colors"
              >
                Volgende
              </Link>
            )}
          </div>
        )}

        <div className="h-8" />
      </div>
    </div>
  );
}
