import { desc, eq } from "drizzle-orm";
import { ArrowLeft, Briefcase, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateNotes } from "@/components/candidate-notes";
import { CvDocumentViewerLazy } from "@/components/cv-document-viewer-lazy";
import { CvDropZone } from "@/components/cv-drop-zone";
import { DeleteCandidateButton } from "@/components/delete-candidate-button";
import { EditCandidateFields } from "@/components/edit-candidate-fields";
import { SkillsRadar } from "@/components/skills-radar";
import { SkillsTags } from "@/components/skills-tags";
import { Badge } from "@/components/ui/badge";
import { db } from "@/src/db";
import { candidates, jobMatches, jobs } from "@/src/db/schema";
import type { StructuredSkills } from "@/src/schemas/candidate-intelligence";

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
  approved: "bg-primary/10 text-primary border-primary/20",
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
    <CvDropZone candidateId={candidate.id}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-6 py-6 space-y-6">
          {/* Back link + delete */}
          <div className="flex items-center justify-between">
            <Link
              href="/professionals"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar kandidaten
            </Link>
            <DeleteCandidateButton candidateId={candidate.id} candidateName={candidate.name} />
          </div>

          {/* Header */}
          <div>
            <h1 className="text-xl font-bold text-foreground mb-2">{candidate.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              {candidate.role && (
                <Badge
                  variant="outline"
                  className="border-border text-muted-foreground bg-transparent text-xs"
                >
                  {candidate.role}
                </Badge>
              )}
              {candidate.availability && (
                <Badge
                  variant="outline"
                  className={
                    candidate.availability === "direct"
                      ? "bg-primary/10 text-primary border-primary/20 text-xs"
                      : "border-border text-muted-foreground bg-transparent text-xs"
                  }
                >
                  {availabilityLabels[candidate.availability] ?? candidate.availability}
                </Badge>
              )}
              {candidate.source && (
                <Badge
                  variant="outline"
                  className="capitalize border-border text-muted-foreground bg-transparent text-xs"
                >
                  {candidate.source}
                </Badge>
              )}
            </div>
          </div>

          {/* Editable profile fields */}
          <EditCandidateFields
            candidateId={candidate.id}
            initialData={{
              name: candidate.name,
              email: candidate.email,
              phone: candidate.phone,
              role: candidate.role,
              location: candidate.location,
              hourlyRate: candidate.hourlyRate,
              availability: candidate.availability,
              linkedinUrl: candidate.linkedinUrl,
            }}
          />

          {/* CV Document Viewer */}
          {candidate.resumeUrl && (
            <CvDocumentViewerLazy url={candidate.resumeUrl} candidateName={candidate.name} />
          )}

          {/* Vaardigheden — structured or legacy */}
          {(() => {
            const structuredSkills = candidate.skillsStructured as StructuredSkills | null;

            if (
              structuredSkills &&
              (structuredSkills.hard.length > 0 || structuredSkills.soft.length > 0)
            ) {
              return (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-4">Vaardigheden</h3>
                  <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                    <div className="bg-card border border-border rounded-xl p-4">
                      <SkillsRadar skills={structuredSkills} />
                    </div>
                    <div className="bg-card border border-border rounded-xl p-4">
                      <SkillsTags skills={structuredSkills} />
                    </div>
                  </div>
                </div>
              );
            }

            // Legacy fallback: flat skills[] array
            if (skills.length > 0) {
              return (
                <div>
                  <h3 className="text-sm font-semibold text-foreground mb-3">Vaardigheden</h3>
                  <div className="flex flex-wrap gap-2">
                    {skills.map((skill) => (
                      <Badge
                        key={skill}
                        variant="outline"
                        className="bg-primary/10 text-primary border-primary/20 text-xs"
                      >
                        {skill}
                      </Badge>
                    ))}
                  </div>
                  <p className="text-xs text-muted-foreground mt-3">
                    Upload een CV om vaardigheden met proficiency-scores te extraheren
                  </p>
                </div>
              );
            }

            return (
              <div>
                <h3 className="text-sm font-semibold text-foreground mb-3">Vaardigheden</h3>
                <div className="bg-card border border-border rounded-xl p-6 text-center">
                  <p className="text-sm text-muted-foreground">
                    Nog geen vaardigheden — upload een CV om vaardigheden te extraheren
                  </p>
                </div>
              </div>
            );
          })()}

          {/* Notes with append form */}
          <CandidateNotes candidateId={candidate.id} initialNotes={candidate.notes} />

          {/* Matches */}
          <div>
            <div className="flex items-center gap-2 mb-4">
              <Sparkles className="h-4 w-4 text-primary" />
              <h3 className="text-sm font-semibold text-foreground">
                Matches ({matchRows.length})
              </h3>
            </div>

            {matchRows.length === 0 ? (
              <div className="bg-card border border-border rounded-xl p-6 text-center">
                <p className="text-sm text-muted-foreground">
                  Nog geen matches voor deze kandidaat
                </p>
              </div>
            ) : (
              <div className="space-y-3">
                {matchRows.map((row) => (
                  <div
                    key={row.match.id}
                    className="bg-card border border-border rounded-xl p-4 hover:border-primary/40 hover:bg-accent transition-colors"
                  >
                    <div className="flex items-start justify-between gap-3 mb-3">
                      <div className="flex-1 min-w-0">
                        {row.job ? (
                          <Link
                            href={`/opdrachten/${row.job.id}`}
                            className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                          >
                            {row.job.title}
                          </Link>
                        ) : (
                          <span className="text-sm font-semibold text-muted-foreground">
                            Vacature verwijderd
                          </span>
                        )}
                        {row.job?.company && (
                          <p className="text-xs text-muted-foreground mt-0.5 flex items-center gap-1">
                            <Briefcase className="h-3 w-3" />
                            {row.job.company}
                          </p>
                        )}
                      </div>
                      <Badge
                        variant="outline"
                        className={`text-[10px] shrink-0 ${statusColors[row.match.status] ?? "border-border text-muted-foreground"}`}
                      >
                        {statusLabels[row.match.status] ?? row.match.status}
                      </Badge>
                    </div>

                    {/* Score bar */}
                    <div className="mb-2">
                      <div className="flex items-center justify-between text-xs mb-1">
                        <span className="text-muted-foreground">Match score</span>
                        <span
                          className={
                            row.match.matchScore >= 80
                              ? "text-primary font-medium"
                              : row.match.matchScore >= 60
                                ? "text-yellow-500 font-medium"
                                : "text-red-500 font-medium"
                          }
                        >
                          {Math.round(row.match.matchScore)}%
                        </span>
                      </div>
                      <div className="w-full h-1.5 bg-muted rounded-full overflow-hidden">
                        <div
                          className={`h-full rounded-full transition-all ${
                            row.match.matchScore >= 80
                              ? "bg-primary"
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
                      <p className="text-xs text-muted-foreground line-clamp-2 mt-2">
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
    </CvDropZone>
  );
}
