import { and, desc, eq, isNull } from "drizzle-orm";
import {
  ArrowLeft,
  ArrowRight,
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
import { applications, candidates, jobMatches, jobs } from "@/src/db/schema";
import {
  type StructuredSkills,
  structuredSkillsSchema,
} from "@/src/schemas/candidate-intelligence";

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

const applicationStageColors: Record<string, string> = {
  new: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
  screening: "bg-blue-500/10 text-blue-500 border-blue-500/20",
  interview: "bg-purple-500/10 text-purple-500 border-purple-500/20",
  offer: "bg-orange-500/10 text-orange-500 border-orange-500/20",
  hired: "bg-primary/10 text-primary border-primary/20",
  rejected: "bg-red-500/10 text-red-500 border-red-500/20",
};

const applicationStageLabels: Record<string, string> = {
  new: "Nieuw",
  screening: "Screening",
  interview: "Interview",
  offer: "Aanbod",
  hired: "Geplaatst",
  rejected: "Afgewezen",
};

const applicationSourceLabels: Record<string, string> = {
  manual: "Handmatig",
  match: "AI match",
  import: "Import",
};

const activeApplicationStages = ["new", "screening", "interview", "offer", "hired"] as const;

const applicationStagePriority: Record<string, number> = {
  new: 0,
  screening: 1,
  interview: 2,
  offer: 3,
  hired: 4,
  rejected: 5,
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

  const [candidateRows, applicationRows, matchRows] = await Promise.all([
    db.select(candidateSelect).from(candidates).where(eq(candidates.id, id)).limit(1),
    db
      .select({
        application: applications,
        job: {
          id: jobs.id,
          title: jobs.title,
          company: jobs.company,
          location: jobs.location,
        },
        linkedMatch: {
          id: jobMatches.id,
          matchScore: jobMatches.matchScore,
          status: jobMatches.status,
          recommendation: jobMatches.recommendation,
        },
      })
      .from(applications)
      .leftJoin(jobs, eq(applications.jobId, jobs.id))
      .leftJoin(jobMatches, eq(applications.matchId, jobMatches.id))
      .where(and(eq(applications.candidateId, id), isNull(applications.deletedAt)))
      .orderBy(desc(applications.updatedAt), desc(applications.createdAt)),
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
  const structuredSkillsParsed = structuredSkillsSchema.safeParse(candidate.skillsStructured);
  const structuredSkills: StructuredSkills | null = structuredSkillsParsed.success
    ? structuredSkillsParsed.data
    : null;
  const experienceEntries = getExperienceEntries(candidate.experience);
  const languages = getLanguageSkills(candidate.languageSkills);
  const yearsExp = computeYearsExperience(candidate.experience);
  const openToOffersPct = availabilityToPercentage(candidate.availability);
  const preferences = (candidate.preferences as Record<string, unknown>) ?? {};
  const websiteUrl =
    (typeof preferences.website === "string" && preferences.website) ||
    candidate.linkedinUrl ||
    null;
  const recruiterApplications = [...applicationRows].sort((a, b) => {
    const stageDelta =
      (applicationStagePriority[a.application.stage] ?? Number.MAX_SAFE_INTEGER) -
      (applicationStagePriority[b.application.stage] ?? Number.MAX_SAFE_INTEGER);
    if (stageDelta !== 0) return stageDelta;
    return (
      new Date(b.application.updatedAt ?? b.application.createdAt ?? 0).getTime() -
      new Date(a.application.updatedAt ?? a.application.createdAt ?? 0).getTime()
    );
  });
  const activeApplications = recruiterApplications.filter(
    (row) => row.application.stage !== "rejected",
  );
  const rejectedApplicationCount = recruiterApplications.length - activeApplications.length;
  const primaryActiveApplication = activeApplications[0];
  const primaryWorkflowAction = primaryActiveApplication?.job?.id
    ? {
        href: `/pipeline?vacature=${primaryActiveApplication.job.id}&fase=${primaryActiveApplication.application.stage}`,
        label: "Open fase",
      }
    : { href: "/matching", label: "Bekijk matches" };
  const applicationStageCountMap: Record<string, number> = {};
  for (const row of recruiterApplications) {
    applicationStageCountMap[row.application.stage] =
      (applicationStageCountMap[row.application.stage] ?? 0) + 1;
  }
  const linkedMatchIds = new Set(
    recruiterApplications
      .map((row) => row.linkedMatch?.id)
      .filter((matchId): matchId is string => Boolean(matchId)),
  );
  const remainingMatchRows = activeApplications.length
    ? matchRows.filter((row) => !linkedMatchIds.has(row.match.id))
    : matchRows;
  const matchChartData = remainingMatchRows.map((row) => ({
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
                <Link href={primaryWorkflowAction.href}>
                  <Button variant="secondary" size="sm" className="gap-1.5">
                    <MessageCircle className="h-4 w-4" />
                    {primaryWorkflowAction.label}
                  </Button>
                </Link>
                <Button variant="outline" size="sm" className="gap-1.5">
                  <Bookmark className="h-4 w-4" />
                  Kandidaat opslaan
                </Button>
              </div>
            </div>
          </div>

          <section className="mb-8">
            <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
              <div className="flex flex-wrap items-start justify-between gap-3">
                <div>
                  <div className="flex items-center gap-2 mb-1">
                    <Briefcase className="h-4 w-4 text-primary" />
                    <h2 className="text-lg font-semibold text-foreground">Recruiter context</h2>
                    <Badge
                      variant="outline"
                      className="text-[10px] bg-primary/10 text-primary border-primary/20"
                    >
                      {activeApplications.length > 0
                        ? `${activeApplications.length} actief`
                        : recruiterApplications.length > 0
                          ? `${recruiterApplications.length} gekoppeld`
                          : "Nog leeg"}
                    </Badge>
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Actieve sollicitaties, gekoppelde vacatures en de eerstvolgende recruiteractie
                    voor deze kandidaat.
                  </p>
                </div>
                <div className="flex flex-wrap gap-2">
                  <Link href={primaryWorkflowAction.href}>
                    <Button variant="secondary" size="sm" className="gap-1.5">
                      <Briefcase className="h-4 w-4" />
                      {primaryWorkflowAction.label}
                    </Button>
                  </Link>
                  {primaryActiveApplication?.job?.id && (
                    <Link href={`/opdrachten/${primaryActiveApplication.job.id}`}>
                      <Button variant="outline" size="sm" className="gap-1.5">
                        <ArrowRight className="h-4 w-4" />
                        Open vacature
                      </Button>
                    </Link>
                  )}
                </div>
              </div>

              {activeApplications.length === 0 ? (
                <div className="rounded-xl border border-dashed border-border p-4 text-sm text-muted-foreground">
                  {recruiterApplications.length > 0
                    ? "Er zijn momenteel geen actieve sollicitaties meer. Gebruik matches om een nieuwe workflow te starten."
                    : "Nog geen actieve sollicitaties gekoppeld. Gebruik matches om deze kandidaat aan relevante vacatures te verbinden."}
                </div>
              ) : (
                <>
                  <div className="space-y-2">
                    <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                      Actieve sollicitaties
                    </p>
                    <div className="flex flex-wrap gap-2">
                      {activeApplicationStages.map((stage) => {
                        const count = applicationStageCountMap[stage] ?? 0;
                        if (count === 0) return null;
                        return (
                          <Badge
                            key={stage}
                            variant="outline"
                            className={applicationStageColors[stage]}
                          >
                            {count} {applicationStageLabels[stage].toLowerCase()}
                          </Badge>
                        );
                      })}
                    </div>
                  </div>

                  <div className="grid gap-3 lg:grid-cols-2">
                    {activeApplications.map((row) => (
                      <div
                        key={row.application.id}
                        className="rounded-xl border border-border bg-background/60 p-4"
                      >
                        <div className="flex items-start justify-between gap-3">
                          <div className="min-w-0">
                            {row.job?.id ? (
                              <Link
                                href={`/opdrachten/${row.job.id}`}
                                className="text-sm font-semibold text-foreground hover:text-primary transition-colors"
                              >
                                {row.job.title}
                              </Link>
                            ) : (
                              <p className="text-sm font-semibold text-muted-foreground">
                                Vacature verwijderd
                              </p>
                            )}
                            {(row.job?.company || row.job?.location) && (
                              <p className="text-xs text-muted-foreground mt-1 line-clamp-1">
                                {[row.job?.company, row.job?.location].filter(Boolean).join(" • ")}
                              </p>
                            )}
                          </div>
                          <div className="flex flex-wrap justify-end gap-1.5">
                            <Badge
                              variant="outline"
                              className={
                                applicationStageColors[row.application.stage] ??
                                "border-border text-muted-foreground"
                              }
                            >
                              {applicationStageLabels[row.application.stage] ??
                                row.application.stage}
                            </Badge>
                            {row.linkedMatch?.status && (
                              <Badge
                                variant="outline"
                                className={
                                  statusColors[row.linkedMatch.status] ??
                                  "border-border text-muted-foreground"
                                }
                              >
                                {statusLabels[row.linkedMatch.status] ?? row.linkedMatch.status}
                              </Badge>
                            )}
                          </div>
                        </div>

                        <div className="mt-3 flex flex-wrap gap-2 text-xs text-muted-foreground">
                          {row.linkedMatch?.matchScore != null && (
                            <span className="font-medium text-foreground">
                              {Math.round(row.linkedMatch.matchScore)}% match
                            </span>
                          )}
                          {row.application.source && (
                            <span>
                              Bron:{" "}
                              {applicationSourceLabels[row.application.source] ??
                                row.application.source}
                            </span>
                          )}
                          {row.application.createdAt && (
                            <span>
                              Gestart op{" "}
                              {new Date(row.application.createdAt).toLocaleDateString("nl-NL", {
                                day: "numeric",
                                month: "short",
                                year: "numeric",
                              })}
                            </span>
                          )}
                        </div>

                        {row.linkedMatch?.recommendation && (
                          <p className="text-xs text-muted-foreground mt-3">
                            AI advies: {recommendationLabel(row.linkedMatch.recommendation)}
                          </p>
                        )}

                        <div className="mt-3 flex flex-wrap gap-3 text-xs">
                          {row.job?.id && (
                            <Link
                              href={`/pipeline?vacature=${row.job.id}&fase=${row.application.stage}`}
                              className="text-primary hover:underline"
                            >
                              Open fase
                            </Link>
                          )}
                          {row.job?.id && (
                            <Link
                              href={`/opdrachten/${row.job.id}`}
                              className="text-primary hover:underline"
                            >
                              Vacature
                            </Link>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>

                  {rejectedApplicationCount > 0 && (
                    <p className="text-xs text-muted-foreground">
                      {rejectedApplicationCount} afgewezen sollicitatie
                      {rejectedApplicationCount === 1 ? " staat" : "s staan"} nog in de
                      workflowhistorie.
                    </p>
                  )}
                </>
              )}
            </div>
          </section>

          <div className="grid grid-cols-1 gap-8 lg:grid-cols-3">
            {/* Left column: About, Employments, Edit, CV, Notes, Matches */}
            <div className="space-y-6 lg:col-span-2">
              {/* About */}
              <section>
                <h2 className="mb-3 text-lg font-semibold text-foreground">Overzicht</h2>
                <div className="rounded-xl border border-border bg-card p-4">
                  <p className="whitespace-pre-line text-sm text-muted-foreground">
                    {candidate.headline ?? "Geen samenvatting."}
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
                    <h2 className="mb-3 text-lg font-semibold text-foreground">Werkervaring</h2>
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
                <div className="mb-4 flex items-center gap-2">
                  <Sparkles className="h-4 w-4 text-primary" />
                  <h2 className="text-lg font-semibold text-foreground">
                    {activeApplications.length > 0
                      ? `Overige matchkansen (${remainingMatchRows.length})`
                      : `Matches (${remainingMatchRows.length})`}
                  </h2>
                </div>
                {remainingMatchRows.length === 0 ? (
                  <div className="rounded-xl border border-border bg-card p-6 text-center">
                    <Sparkles className="mx-auto mb-2 h-8 w-8 text-muted-foreground/40" />
                    <p className="text-sm text-muted-foreground">
                      {activeApplications.length > 0
                        ? "Alle bekende matches zijn al gekoppeld aan sollicitaties"
                        : "Nog geen matches voor deze kandidaat"}
                    </p>
                    <p className="mt-1 text-xs text-muted-foreground/70">
                      {activeApplications.length > 0
                        ? "De gelinkte matchcontext staat hierboven in Recruiter context"
                        : "Matches worden automatisch berekend wanneer vacatures beschikbaar zijn"}
                    </p>
                  </div>
                ) : (
                  <div className="space-y-4">
                    {activeApplications.length > 0 && (
                      <p className="text-sm text-muted-foreground">
                        Gelinkte matches staan hierboven in Recruiter context.
                      </p>
                    )}
                    <div className="rounded-xl border border-border bg-card p-4">
                      <MatchScoresChart data={matchChartData} />
                    </div>
                    <div className="space-y-3">
                      {remainingMatchRows.map((row) => {
                        const rec = row.match.recommendation;
                        const recConf = row.match.recommendationConfidence;
                        const model = row.match.assessmentModel;

                        return (
                          <details
                            key={row.match.id}
                            className="group rounded-xl border border-border bg-card transition-colors hover:border-primary/40 hover:bg-accent"
                          >
                            <summary className="list-none cursor-pointer p-4">
                              <div className="mb-3 flex items-start justify-between gap-3">
                                <div className="min-w-0 flex-1">
                                  {row.job ? (
                                    <Link
                                      href={`/opdrachten/${row.job.id}`}
                                      className="text-sm font-semibold text-foreground transition-colors hover:text-primary"
                                    >
                                      {row.job.title}
                                    </Link>
                                  ) : (
                                    <span className="text-sm font-semibold text-muted-foreground">
                                      Vacature verwijderd
                                    </span>
                                  )}
                                  {row.job?.company && (
                                    <p className="mt-0.5 flex items-center gap-1 text-xs text-muted-foreground">
                                      <Briefcase className="h-3 w-3" />
                                      {row.job.company}
                                    </p>
                                  )}
                                </div>
                                <div className="flex shrink-0 items-center gap-2">
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
                                <div className="mb-1 flex items-center justify-between text-xs">
                                  <span className="text-muted-foreground">Match score</span>
                                  <span
                                    className={
                                      row.match.matchScore >= 80
                                        ? "font-medium text-primary"
                                        : row.match.matchScore >= 60
                                          ? "font-medium text-yellow-500"
                                          : "font-medium text-red-500"
                                    }
                                  >
                                    {Math.round(row.match.matchScore)}%
                                  </span>
                                </div>
                                <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
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
                                <p className="mt-2 line-clamp-2 text-xs text-muted-foreground group-open:hidden">
                                  {row.match.reasoning}
                                </p>
                              )}
                            </summary>

                            {/* Expanded detail */}
                            <div className="space-y-3 border-t border-border/50 px-4 pt-3 pb-4">
                              {row.match.reasoning && (
                                <div>
                                  <p className="mb-1 text-xs font-medium text-foreground">
                                    Toelichting
                                  </p>
                                  <p className="text-xs leading-relaxed text-muted-foreground">
                                    {row.match.reasoning}
                                  </p>
                                </div>
                              )}
                              {/* Confidence + model provenance */}
                              <div className="flex items-center gap-3 border-t border-border/30 pt-1 text-[10px] text-muted-foreground/70">
                                <Info className="h-3 w-3 shrink-0" />
                                {recConf != null && (
                                  <span>Betrouwbaarheid: {Math.round(recConf)}%</span>
                                )}
                                {model && <span>Model: {model}</span>}
                                {recConf == null && !model && (
                                  <span>Geen aanvullende metadata</span>
                                )}
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
              <div className="rounded-xl border border-border bg-red-50 p-4 dark:bg-red-950/20">
                <p className="text-xs font-medium text-muted-foreground">Marktwaarde</p>
                <p className="mt-0.5 text-sm font-medium text-orange-600 dark:text-orange-400">
                  Binnenkort…
                </p>
              </div>
              <div className="rounded-xl border border-border bg-blue-50 p-4 dark:bg-blue-950/20">
                <p className="text-xs font-medium text-muted-foreground">Jaren ervaring</p>
                <p className="mt-0.5 text-sm font-medium text-foreground">{yearsExp ?? "—"}</p>
              </div>
              <div className="rounded-xl border border-border bg-card p-4 shadow-sm">
                <h3 className="mb-3 text-sm font-semibold text-foreground">Sociale media</h3>
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
                      className="inline-flex size-9 items-center justify-center rounded-full bg-[#0A66C2] text-white hover:opacity-90"
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
                <h3 className="mb-3 text-sm font-semibold text-foreground">Vaardigheden</h3>
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
                            className="border-primary/20 bg-primary/10 text-xs text-primary"
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
                <h3 className="mb-3 text-sm font-semibold text-foreground">Contact</h3>
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
                        className="truncate hover:text-foreground"
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
