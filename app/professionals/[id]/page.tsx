import { desc, eq } from "drizzle-orm";
import {
  ArrowLeft,
  Bookmark,
  Briefcase,
  Globe,
  Info,
  Mail,
  MessageCircle,
  Phone,
  Sparkles,
} from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { CandidateNotes } from "@/components/candidate-notes";
import { EmploymentCard } from "@/components/candidate-profile/employment-card";
import { MatchScoresChart } from "@/components/candidate-profile/match-scores-chart";
import { OpenToOffersRing } from "@/components/candidate-profile/open-to-offers-ring";
import { SkillsExperienceSection } from "@/components/candidate-profile/skills-experience-section";
import { CvDocumentViewerLazy } from "@/components/cv-document-viewer-lazy";
import { CvDropZone } from "@/components/cv-drop-zone";
import { DeleteCandidateButton } from "@/components/delete-candidate-button";
import { EditCandidateFields } from "@/components/edit-candidate-fields";
import { SkillsRadar } from "@/components/skills-radar";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { db } from "@/src/db";
import { candidates, jobMatches, jobs } from "@/src/db/schema";
import type { StructuredSkills } from "@/src/schemas/candidate-intelligence";

export const dynamic = "force-dynamic";

interface Props {
  params: Promise<{ id: string }>;
}

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

/** Map availability to an "open to offers" percentage for the ring. */
function availabilityToPercentage(availability: string | null): number {
  switch (availability) {
    case "direct":
      return 90;
    case "1_maand":
      return 70;
    case "3_maanden":
      return 50;
    default:
      return 60;
  }
}

/** Parse experience JSON into a uniform shape (parser or legacy). */
function getExperienceEntries(experience: unknown): Array<{
  title?: string;
  company?: string;
  period?: { start?: string; end?: string };
  responsibilities?: string[];
  duration?: string;
  location?: string;
}> {
  if (!Array.isArray(experience)) return [];
  return experience.map((entry) => {
    if (entry && typeof entry === "object") {
      const e = entry as Record<string, unknown>;
      const period =
        e.period && typeof e.period === "object"
          ? (e.period as { start?: string; end?: string })
          : undefined;
      return {
        title: typeof e.title === "string" ? e.title : undefined,
        company: typeof e.company === "string" ? e.company : undefined,
        period,
        responsibilities: Array.isArray(e.responsibilities)
          ? (e.responsibilities as string[])
          : undefined,
        duration: typeof e.duration === "string" ? e.duration : undefined,
        location: typeof e.location === "string" ? e.location : undefined,
      };
    }
    return {};
  });
}

/** Compute total years of experience from experience array (rough). */
function computeYearsExperience(experience: unknown): string | null {
  const entries = getExperienceEntries(experience);
  if (entries.length === 0) return null;
  let totalMonths = 0;
  for (const e of entries) {
    if (e.period?.start && e.period?.end) {
      const start = e.period.start.slice(0, 4);
      const end =
        e.period.end === "heden" ? new Date().getFullYear().toString() : e.period.end.slice(0, 4);
      const s = Number.parseInt(start, 10);
      const n = Number.parseInt(end, 10);
      if (!Number.isNaN(s) && !Number.isNaN(n)) totalMonths += (n - s) * 12;
    }
  }
  if (totalMonths === 0) return null;
  const years = Math.floor(totalMonths / 12);
  if (years >= 5) return "5+ jaar";
  if (years >= 3) return "3+ jaar";
  if (years >= 1) return "1+ jaar";
  return "< 1 jaar";
}

/** Language skills from DB: array of { language, level }. */
function getLanguageSkills(languageSkills: unknown): Array<{ language: string; level: string }> {
  if (!Array.isArray(languageSkills)) return [];
  return languageSkills
    .filter((x) => x && typeof x === "object")
    .map((x) => {
      const o = x as Record<string, unknown>;
      return {
        language: typeof o.language === "string" ? o.language : "",
        level: typeof o.level === "string" ? o.level : "",
      };
    })
    .filter((l) => l.language);
}

export default async function ProfessionalDetailPage({ params }: Props) {
  const { id } = await params;

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
  const structuredSkills = candidate.skillsStructured as StructuredSkills | null;
  const experienceEntries = getExperienceEntries(candidate.experience);
  const languages = getLanguageSkills(candidate.languageSkills);
  const yearsExp = computeYearsExperience(candidate.experience);
  const openToOffersPct = availabilityToPercentage(candidate.availability);
  const preferences = (candidate.preferences as Record<string, unknown>) ?? {};
  const websiteUrl =
    (typeof preferences.website === "string" && preferences.website) ||
    candidate.linkedinUrl ||
    null;

  const matchChartData = matchRows.map((row) => ({
    jobTitle: row.job?.title ?? "Vacature",
    score: row.match.matchScore,
    jobId: row.job?.id,
  }));

  /** Human-friendly recommendation label */
  const recommendationLabel = (rec: string | null): string => {
    switch (rec) {
      case "go":
        return "Aanbevolen";
      case "conditional":
        return "Voorwaardelijk";
      case "no-go":
        return "Niet aanbevolen";
      default:
        return "";
    }
  };

  /** Color class for recommendation */
  const recommendationColor = (rec: string | null): string => {
    switch (rec) {
      case "go":
        return "text-primary";
      case "conditional":
        return "text-yellow-600 dark:text-yellow-400";
      case "no-go":
        return "text-red-500";
      default:
        return "text-muted-foreground";
    }
  };

  return (
    <CvDropZone candidateId={candidate.id}>
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-5xl mx-auto px-6 py-6">
          {/* Back + delete */}
          <div className="flex items-center justify-between mb-6">
            <Link
              href="/professionals"
              className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <ArrowLeft className="h-4 w-4" />
              Terug naar kandidaten
            </Link>
            <DeleteCandidateButton candidateId={candidate.id} candidateName={candidate.name} />
          </div>

          {/* Header: Open to offers (left), name + role (center), website + actions (right) */}
          <div className="flex flex-wrap items-start gap-4 justify-between mb-8">
            <OpenToOffersRing percentage={openToOffersPct} label="Open voor aanbiedingen" />
            <div className="flex-1 min-w-0 text-center sm:text-left">
              <h1 className="text-2xl font-bold text-foreground">{candidate.name}</h1>
              {candidate.role && (
                <p className="text-base font-semibold text-muted-foreground mt-0.5">
                  {candidate.role}
                </p>
              )}
            </div>
            <div className="flex flex-col items-end gap-2 w-full sm:w-auto">
              {websiteUrl && (
                <a
                  href={websiteUrl.startsWith("http") ? websiteUrl : `https://${websiteUrl}`}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="inline-flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground"
                >
                  <Globe className="h-4 w-4 shrink-0" />
                  <span className="truncate max-w-[200px]">{websiteUrl}</span>
                </a>
              )}
              <div className="flex gap-2">
                <Button variant="secondary" size="sm" className="gap-1.5" disabled>
                  <MessageCircle className="h-4 w-4" />
                  Bericht (binnenkort)
                </Button>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Bookmark className="h-4 w-4" />
                  Kandidaat opslaan
                </Button>
              </div>
            </div>
          </div>

          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
            {/* Left column: About, Employments, Edit, CV, Notes, Matches */}
            <div className="lg:col-span-2 space-y-6">
              {/* About */}
              <section>
                <h2 className="text-lg font-semibold text-foreground mb-3">Overzicht</h2>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="text-sm text-muted-foreground whitespace-pre-line">
                    {candidate.profileSummary ?? candidate.headline ?? "Geen samenvatting."}
                  </p>
                  {languages.length > 0 && (
                    <div className="mt-3 flex flex-wrap gap-2">
                      {languages.map((lang) => (
                        <span
                          key={`${lang.language}-${lang.level}`}
                          className="text-xs text-muted-foreground"
                        >
                          {lang.language} ({lang.level})
                        </span>
                      ))}
                    </div>
                  )}
                </div>
              </section>

              {/* Skills + Employments — unified interactive section */}
              {structuredSkills &&
              (structuredSkills.hard.length > 0 || structuredSkills.soft.length > 0) ? (
                <SkillsExperienceSection
                  experienceEntries={experienceEntries}
                  structuredSkills={structuredSkills}
                  candidateLocation={candidate.location}
                />
              ) : (
                experienceEntries.length > 0 && (
                  <section>
                    <h2 className="text-lg font-semibold text-foreground mb-3">Werkervaring</h2>
                    <div className="space-y-3">
                      {experienceEntries.map((entry, i) => (
                        <EmploymentCard
                          key={`${entry.company ?? ""}-${entry.title ?? ""}-${i}`}
                          entry={entry}
                          location={entry.location ?? candidate.location ?? undefined}
                        />
                      ))}
                    </div>
                  </section>
                )
              )}

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

              {candidate.resumeUrl && (
                <CvDocumentViewerLazy url={candidate.resumeUrl} candidateName={candidate.name} />
              )}

              <CandidateNotes candidateId={candidate.id} initialNotes={candidate.notes} />

              {/* Matches list + chart */}
              <section>
                <div className="flex items-center gap-2 mb-4">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">
                    Matches ({matchRows.length})
                  </h2>
                </div>
                {matchRows.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-6 text-center">
                    <Sparkles className="h-8 w-8 text-muted-foreground/40 mx-auto mb-2" />
                    <p className="text-sm text-muted-foreground">
                      Nog geen matches voor deze kandidaat
                    </p>
                    <p className="text-xs text-muted-foreground/70 mt-1">
                      Matches worden automatisch berekend wanneer vacatures beschikbaar zijn
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    <div className="rounded-xl border border-border bg-card p-4">
                      <MatchScoresChart data={matchChartData} />
                    </div>
                    <div className="space-y-3">
                      {matchRows.map((row) => {
                        const rec = row.match.recommendation;
                        const recConf = row.match.recommendationConfidence;
                        const model = row.match.assessmentModel;

                        return (
                          <details
                            key={row.match.id}
                            className="group rounded-xl border border-border bg-card hover:border-primary/40 hover:bg-accent transition-colors"
                          >
                            <summary className="p-4 cursor-pointer list-none">
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
                                <div className="flex items-center gap-2 shrink-0">
                                  {rec && (
                                    <span
                                      className={`text-[10px] font-medium ${recommendationColor(rec)}`}
                                    >
                                      {recommendationLabel(rec)}
                                    </span>
                                  )}
                                  <Badge
                                    variant="outline"
                                    className={`text-[10px] ${statusColors[row.match.status] ?? "border-border text-muted-foreground"}`}
                                  >
                                    {statusLabels[row.match.status] ?? row.match.status}
                                  </Badge>
                                </div>
                              </div>
                              <div className="mb-1">
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
                              {row.match.reasoning && (
                                <p className="text-xs text-muted-foreground line-clamp-2 mt-2 group-open:hidden">
                                  {row.match.reasoning}
                                </p>
                              )}
                            </summary>

                            {/* Expanded detail */}
                            <div className="px-4 pb-4 space-y-3 border-t border-border/50 pt-3">
                              {row.match.reasoning && (
                                <div>
                                  <p className="text-xs font-medium text-foreground mb-1">
                                    Toelichting
                                  </p>
                                  <p className="text-xs text-muted-foreground leading-relaxed">
                                    {row.match.reasoning}
                                  </p>
                                </div>
                              )}
                              {/* Confidence + model provenance */}
                              <div className="flex items-center gap-3 text-[10px] text-muted-foreground/70 pt-1 border-t border-border/30">
                                <Info className="h-3 w-3 shrink-0" />
                                {recConf != null && (
                                  <span>Betrouwbaarheid: {Math.round(recConf)}%</span>
                                )}
                                {model && <span>Model: {model}</span>}
                                {!recConf && !model && <span>Geen aanvullende metadata</span>}
                              </div>
                            </div>
                          </details>
                        );
                      })}
                    </div>
                  </div>
                )}
              </section>
            </div>

            {/* Right column: Market value, Years exp, Social, Skills (radar + tags), Contacts */}
            <div className="space-y-4">
              <div className="rounded-xl border border-border p-4 bg-red-50 dark:bg-red-950/20">
                <p className="text-xs font-medium text-muted-foreground">Marktwaarde</p>
                <p className="text-sm font-medium text-orange-600 dark:text-orange-400 mt-0.5">
                  Binnenkort…
                </p>
              </div>
              <div className="rounded-xl border border-border p-4 bg-blue-50 dark:bg-blue-950/20">
                <p className="text-xs font-medium text-muted-foreground">Jaren ervaring</p>
                <p className="text-sm font-medium text-foreground mt-0.5">{yearsExp ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-3">Sociale media</h3>
                <div className="flex flex-wrap gap-2">
                  {candidate.linkedinUrl ? (
                    <a
                      href={
                        candidate.linkedinUrl.startsWith("http")
                          ? candidate.linkedinUrl
                          : `https://${candidate.linkedinUrl}`
                      }
                      target="_blank"
                      rel="noopener noreferrer"
                      className="inline-flex items-center justify-center size-9 rounded-full bg-[#0A66C2] text-white hover:opacity-90"
                    >
                      <span className="sr-only">LinkedIn profiel openen</span>
                      <svg className="size-5" viewBox="0 0 24 24" fill="currentColor" aria-hidden>
                        <title>LinkedIn</title>
                        <path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z" />
                      </svg>
                    </a>
                  ) : (
                    <span className="text-xs text-muted-foreground">Geen links</span>
                  )}
                </div>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-3">Vaardigheden</h3>
                {(() => {
                  if (
                    structuredSkills &&
                    (structuredSkills.hard.length > 0 || structuredSkills.soft.length > 0)
                  ) {
                    // Structured skills shown in unified section (left column);
                    // sidebar shows radar only for quick overview
                    return (
                      <div className="min-h-[200px]">
                        <SkillsRadar skills={structuredSkills} />
                      </div>
                    );
                  }
                  if (skills.length > 0) {
                    return (
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
                    );
                  }
                  return (
                    <p className="text-xs text-muted-foreground">
                      Nog geen vaardigheden — Upload een CV om vaardigheden te extraheren
                    </p>
                  );
                })()}
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h3 className="text-sm font-semibold text-foreground mb-3">Contact</h3>
                <div className="space-y-2 text-sm text-muted-foreground">
                  {candidate.phone && (
                    <p className="flex items-center gap-2">
                      <Phone className="h-4 w-4 shrink-0" />
                      {candidate.phone}
                    </p>
                  )}
                  {candidate.email && (
                    <p className="flex items-center gap-2">
                      <Mail className="h-4 w-4 shrink-0" />
                      <a
                        href={`mailto:${candidate.email}`}
                        className="hover:text-foreground truncate"
                      >
                        {candidate.email}
                      </a>
                    </p>
                  )}
                  {!candidate.phone && !candidate.email && (
                    <p className="text-xs">Geen contactgegevens</p>
                  )}
                </div>
              </div>
            </div>
          </div>

          <div className="h-8" />
        </div>
      </div>
    </CvDropZone>
  );
}
