import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Briefcase, Euro, Mail, MapPin, Phone, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";
import { candidates, jobMatches, jobs } from "@/src/db/schema";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

const availabilityLabels: Record<string, string> = {
  direct: "Direct beschikbaar",
  "1_maand": "Binnen 1 maand",
  "3_maanden": "Binnen 3 maanden",
};

const statusColors: Record<string, string> = {
  pending: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  approved: "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

const statusLabels: Record<string, string> = {
  pending: "In afwachting",
  approved: "Goedgekeurd",
  rejected: "Afgewezen",
};

export default async function ProfessionalDetailPage({ params }: Props) {
  const { id } = await params;

  // Fetch candidate + their matches with joined job data
  const [candidateRows, matchRows] = await Promise.all([
    db.select().from(candidates).where(eq(candidates.id, id)).limit(1),
    db
      .select({
        match: jobMatches,
        job: {
          id: jobs.id,
          title: jobs.title,
          company: jobs.company,
          location: jobs.location,
        },
      })
      .from(jobMatches)
      .leftJoin(jobs, eq(jobMatches.jobId, jobs.id))
      .where(eq(jobMatches.candidateId, id))
      .orderBy(desc(jobMatches.matchScore)),
  ]);

  const candidate = candidateRows[0];
  if (!candidate) {
    notFound();
  }

  const skills = Array.isArray(candidate.skills) ? (candidate.skills as string[]) : [];

  return (
    <div className="flex-1 overflow-y-auto">
      <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
        {/* Back link */}
        <Link
          href="/professionals"
          className="inline-flex items-center gap-1.5 text-sm text-[#8e8e8e] hover:text-[#ececec] transition-colors"
        >
          <ArrowLeft className="h-4 w-4" />
          Terug naar professionals
        </Link>

        {/* Header */}
        <div>
          <h1 className="text-xl font-bold text-[#ececec] mb-2">{candidate.name}</h1>
          <div className="flex items-center gap-2 flex-wrap">
            {candidate.role && (
              <Badge
                variant="outline"
                className="border-[#2d2d2d] text-[#8e8e8e] bg-transparent text-xs"
              >
                {candidate.role}
              </Badge>
            )}
            {candidate.availability && (
              <Badge
                variant="outline"
                className={
                  candidate.availability === "direct"
                    ? "bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20 text-xs"
                    : "border-[#2d2d2d] text-[#8e8e8e] bg-transparent text-xs"
                }
              >
                {availabilityLabels[candidate.availability] ?? candidate.availability}
              </Badge>
            )}
            {candidate.source && (
              <Badge
                variant="outline"
                className="capitalize border-[#2d2d2d] text-[#6b6b6b] bg-transparent text-xs"
              >
                {candidate.source}
              </Badge>
            )}
          </div>
        </div>

        {/* Contact info */}
        <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
          <h3 className="text-sm font-semibold text-[#ececec] mb-3">Contactgegevens</h3>
          <div className="flex flex-wrap gap-x-6 gap-y-2 text-sm text-[#8e8e8e]">
            {candidate.email && (
              <span className="flex items-center gap-1.5">
                <Mail className="h-4 w-4 text-[#6b6b6b]" />
                {candidate.email}
              </span>
            )}
            {candidate.phone && (
              <span className="flex items-center gap-1.5">
                <Phone className="h-4 w-4 text-[#6b6b6b]" />
                {candidate.phone}
              </span>
            )}
            {candidate.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-4 w-4 text-[#6b6b6b]" />
                {candidate.location}
              </span>
            )}
            {candidate.hourlyRate && (
              <span className="flex items-center gap-1.5">
                <Euro className="h-4 w-4 text-[#6b6b6b]" />
                EUR {candidate.hourlyRate} per uur
              </span>
            )}
          </div>
        </div>

        {/* Skills */}
        {skills.length > 0 && (
          <div>
            <h3 className="text-sm font-semibold text-[#ececec] mb-3">Vaardigheden</h3>
            <div className="flex flex-wrap gap-2">
              {skills.map((skill, i) => (
                <Badge
                  key={i}
                  variant="outline"
                  className="bg-[#10a37f]/10 text-[#10a37f] border-[#10a37f]/20 text-xs"
                >
                  {skill}
                </Badge>
              ))}
            </div>
          </div>
        )}

        {/* Notes */}
        {candidate.notes && (
          <div>
            <h3 className="text-sm font-semibold text-[#ececec] mb-3">Notities</h3>
            <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4">
              <p className="text-sm text-[#8e8e8e] whitespace-pre-wrap leading-relaxed">
                {candidate.notes}
              </p>
            </div>
          </div>
        )}

        {/* Matches */}
        <div>
          <div className="flex items-center gap-2 mb-4">
            <Sparkles className="h-4 w-4 text-[#10a37f]" />
            <h3 className="text-sm font-semibold text-[#ececec]">Matches ({matchRows.length})</h3>
          </div>

          {matchRows.length === 0 ? (
            <div className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-6 text-center">
              <p className="text-sm text-[#6b6b6b]">Nog geen matches voor deze professional</p>
            </div>
          ) : (
            <div className="space-y-3">
              {matchRows.map((row) => (
                <div
                  key={row.match.id}
                  className="bg-[#1e1e1e] border border-[#2d2d2d] rounded-xl p-4 hover:border-[#10a37f]/40 hover:bg-[#232323] transition-colors"
                >
                  <div className="flex items-start justify-between gap-3 mb-3">
                    <div className="flex-1 min-w-0">
                      {row.job ? (
                        <Link
                          href={`/opdrachten/${row.job.id}`}
                          className="text-sm font-semibold text-[#ececec] hover:text-[#10a37f] transition-colors"
                        >
                          {row.job.title}
                        </Link>
                      ) : (
                        <span className="text-sm font-semibold text-[#6b6b6b]">
                          Opdracht verwijderd
                        </span>
                      )}
                      {row.job?.company && (
                        <p className="text-xs text-[#8e8e8e] mt-0.5 flex items-center gap-1">
                          <Briefcase className="h-3 w-3" />
                          {row.job.company}
                        </p>
                      )}
                    </div>
                    <Badge
                      variant="outline"
                      className={`text-[10px] shrink-0 ${statusColors[row.match.status] ?? "border-[#2d2d2d] text-[#6b6b6b]"}`}
                    >
                      {statusLabels[row.match.status] ?? row.match.status}
                    </Badge>
                  </div>

                  {/* Score bar */}
                  <div className="mb-2">
                    <div className="flex items-center justify-between text-xs mb-1">
                      <span className="text-[#6b6b6b]">Match score</span>
                      <span
                        className={
                          row.match.matchScore >= 80
                            ? "text-[#10a37f] font-medium"
                            : row.match.matchScore >= 60
                              ? "text-yellow-500 font-medium"
                              : "text-red-500 font-medium"
                        }
                      >
                        {Math.round(row.match.matchScore)}%
                      </span>
                    </div>
                    <div className="w-full h-1.5 bg-[#2d2d2d] rounded-full overflow-hidden">
                      <div
                        className={`h-full rounded-full transition-all ${
                          row.match.matchScore >= 80
                            ? "bg-[#10a37f]"
                            : row.match.matchScore >= 60
                              ? "bg-yellow-500"
                              : "bg-red-500"
                        }`}
                        style={{
                          width: `${Math.min(100, Math.round(row.match.matchScore))}%`,
                        }}
                      />
                    </div>
                  </div>

                  {/* Reasoning */}
                  {row.match.reasoning && (
                    <p className="text-xs text-[#6b6b6b] line-clamp-2 mt-2">
                      {row.match.reasoning}
                    </p>
                  )}
                </div>
              ))}
            </div>
          )}
        </div>

        <div className="h-8" />
      </div>
    </div>
  );
}
