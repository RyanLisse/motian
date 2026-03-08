"use client";

import { ExternalLink, Loader2, Search, Sparkles, UserCheck, UserRoundX } from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { MatchSuggestionCard } from "./match-suggestion-card";
import type { CandidateSkillPreview, ManualJobSuggestion, WizardIntakeResult } from "./types";

interface WizardStepLinkingProps {
  intake: WizardIntakeResult;
  onComplete: () => void;
  onSkip: () => void;
}

const availabilityLabels: Record<string, string> = {
  direct: "Direct beschikbaar",
  "1_maand": "Binnen 1 maand",
  "3_maanden": "Binnen 3 maanden",
};

const sourceLabels: Record<string, string> = {
  manual: "Handmatig gestart",
  cv: "CV-gestuurd",
  hybrid: "Hybride intake",
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function renderSkillPreview(title: string, skills: CandidateSkillPreview[], accentClass: string) {
  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">{title}</p>
      {skills.length === 0 ? (
        <p className="mt-3 text-sm text-muted-foreground">Nog geen expliciete signalen gevonden.</p>
      ) : (
        <div className="mt-3 space-y-2">
          {skills.slice(0, 3).map((skill) => (
            <div
              key={skill.name}
              className="rounded-lg border border-border/70 bg-background px-3 py-2"
            >
              <div className="flex items-center justify-between gap-2">
                <span className="text-sm font-medium text-foreground">{skill.name}</span>
                <span className={cn("text-xs font-semibold", accentClass)}>
                  {skill.proficiency}/5
                </span>
              </div>
              <p className="mt-1 text-xs text-muted-foreground">{skill.evidence}</p>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

export function WizardStepLinking({ intake, onComplete, onSkip }: WizardStepLinkingProps) {
  const topMatches = intake.matches.slice(0, 5);
  const recommendedMatch = useMemo(
    () =>
      topMatches.find((match) => match.matchId === intake.recommendedMatchId) ??
      topMatches.find((match) => match.isRecommended) ??
      null,
    [intake.recommendedMatchId, topMatches],
  );
  const defaultSelection = useMemo(() => {
    if (!recommendedMatch || recommendedMatch.isLinked) return [];
    return [recommendedMatch.matchId];
  }, [recommendedMatch]);

  const [selectedMatchIds, setSelectedMatchIds] = useState<Set<string>>(new Set(defaultSelection));
  const [manualSearchEnabled, setManualSearchEnabled] = useState(topMatches.length === 0);
  const [manualQuery, setManualQuery] = useState("");
  const [manualResults, setManualResults] = useState<ManualJobSuggestion[]>([]);
  const [selectedJobIds, setSelectedJobIds] = useState<Set<string>>(new Set());
  const [searchingJobs, setSearchingJobs] = useState(false);
  const [submitting, setSubmitting] = useState<"auto" | "confirm" | null>(null);
  const [error, setError] = useState("");

  const selectedMatchCount = topMatches.filter(
    (match) => selectedMatchIds.has(match.matchId) && !match.isLinked,
  ).length;
  const selectedJobCount = selectedJobIds.size;
  const noImmediateLink = manualSearchEnabled && selectedMatchCount === 0 && selectedJobCount === 0;

  const toggleMatch = (matchId: string, checked: boolean) => {
    setSelectedMatchIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(matchId);
      else next.delete(matchId);
      return next;
    });
  };

  const toggleJob = (jobId: string, checked: boolean) => {
    setSelectedJobIds((previous) => {
      const next = new Set(previous);
      if (checked) next.add(jobId);
      else next.delete(jobId);
      return next;
    });
  };

  const runManualSearch = async () => {
    const query = manualQuery.trim();
    if (!query) return;

    setSearchingJobs(true);
    setError("");

    try {
      const response = await fetch(`/api/opdrachten?q=${encodeURIComponent(query)}&limit=5`);
      const body = await response.json().catch(() => null);
      if (!response.ok) {
        const message = isRecord(body) && typeof body.error === "string" ? body.error : null;
        throw new Error(message ?? "Handmatig zoeken mislukt");
      }

      const results = isRecord(body) && Array.isArray(body.data) ? body.data : [];
      setManualResults(
        results
          .map<ManualJobSuggestion | null>((job) => {
            if (!isRecord(job) || typeof job.id !== "string" || typeof job.title !== "string") {
              return null;
            }
            return {
              id: job.id,
              title: job.title,
              company: typeof job.company === "string" ? job.company : null,
              location: typeof job.location === "string" ? job.location : null,
              platform: typeof job.platform === "string" ? job.platform : null,
            };
          })
          .filter((job): job is ManualJobSuggestion => job !== null),
      );
    } catch (err) {
      setError(err instanceof Error ? err.message : "Handmatig zoeken mislukt");
    } finally {
      setSearchingJobs(false);
    }
  };

  const submitLinkBatch = async (payload: { matchIds?: string[]; jobIds?: string[] }) => {
    const response = await fetch(`/api/kandidaten/${intake.candidateId}/koppel`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(payload),
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = isRecord(body) && typeof body.error === "string" ? body.error : null;
      throw new Error(message ?? "Koppelen mislukt");
    }
  };

  const markNoMatch = async () => {
    const response = await fetch(`/api/kandidaten/${intake.candidateId}/geen-match`, {
      method: "POST",
    });

    if (!response.ok) {
      const body = await response.json().catch(() => null);
      const message = isRecord(body) && typeof body.error === "string" ? body.error : null;
      throw new Error(message ?? "Geen-match status opslaan mislukt");
    }
  };

  const handleAutoLink = async () => {
    if (!recommendedMatch || recommendedMatch.isLinked) {
      onComplete();
      return;
    }

    setSubmitting("auto");
    setError("");
    try {
      await submitLinkBatch({ matchIds: [recommendedMatch.matchId] });
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Auto-koppelen mislukt");
    } finally {
      setSubmitting(null);
    }
  };

  const handleConfirm = async () => {
    const matchIds = topMatches
      .filter((match) => selectedMatchIds.has(match.matchId) && !match.isLinked)
      .map((match) => match.matchId);
    const jobIds = Array.from(selectedJobIds);

    setSubmitting("confirm");
    setError("");
    try {
      if (matchIds.length === 0 && jobIds.length === 0) {
        await markNoMatch();
      } else if (matchIds.length > 0) {
        await submitLinkBatch({ matchIds });
        if (jobIds.length > 0) {
          await submitLinkBatch({ jobIds });
        }
      } else if (jobIds.length > 0) {
        await submitLinkBatch({ jobIds });
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Koppelen mislukt");
    } finally {
      setSubmitting(null);
    }
  };

  return (
    <div className="space-y-6">
      <div className="grid gap-6 xl:grid-cols-[1.05fr,1.35fr]">
        <section className="space-y-4 rounded-2xl border border-border bg-muted/20 p-5">
          <div className="flex flex-wrap items-center gap-2">
            <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
              {sourceLabels[intake.profile.source] ?? intake.profile.source}
            </Badge>
            {intake.profile.availability ? (
              <Badge variant="outline" className="text-muted-foreground">
                {availabilityLabels[intake.profile.availability] ?? intake.profile.availability}
              </Badge>
            ) : null}
          </div>

          <div>
            <h3 className="text-lg font-semibold text-foreground">{intake.profile.name}</h3>
            <p className="text-sm text-muted-foreground">{intake.profile.role}</p>
            {intake.profile.headline ? (
              <p className="mt-3 text-sm leading-relaxed text-muted-foreground">
                {intake.profile.headline}
              </p>
            ) : null}
          </div>

          <div className="grid gap-3 sm:grid-cols-2">
            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Samenvatting
              </p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {intake.profile.location ? <p>Locatie: {intake.profile.location}</p> : null}
                {intake.profile.totalYearsExperience !== null ? (
                  <p>Ervaring: {intake.profile.totalYearsExperience} jaar</p>
                ) : null}
                {intake.profile.hourlyRate !== null ? (
                  <p>Tarief: €{intake.profile.hourlyRate}</p>
                ) : null}
                {intake.profile.highestEducationLevel ? (
                  <p>Opleiding: {intake.profile.highestEducationLevel}</p>
                ) : null}
                {!intake.profile.location &&
                intake.profile.totalYearsExperience === null &&
                intake.profile.hourlyRate === null &&
                !intake.profile.highestEducationLevel ? (
                  <p>Nog geen aanvullende recruiterdata vastgelegd.</p>
                ) : null}
              </div>
            </div>

            <div className="rounded-xl border border-border bg-card p-4">
              <p className="text-xs font-semibold uppercase tracking-wide text-muted-foreground">
                Contact & context
              </p>
              <div className="mt-3 space-y-2 text-sm text-muted-foreground">
                {intake.profile.email ? <p>{intake.profile.email}</p> : null}
                {intake.profile.phone ? <p>{intake.profile.phone}</p> : null}
                {intake.profile.linkedinUrl ? (
                  <Link
                    href={intake.profile.linkedinUrl}
                    target="_blank"
                    rel="noreferrer"
                    className="inline-flex items-center gap-1 text-primary hover:underline"
                  >
                    LinkedIn openen
                    <ExternalLink className="h-3 w-3" />
                  </Link>
                ) : null}
                {!intake.profile.email && !intake.profile.phone && !intake.profile.linkedinUrl ? (
                  <p>Geen contactgegevens ingevuld.</p>
                ) : null}
              </div>
            </div>
          </div>

          <div className="grid gap-3 lg:grid-cols-2">
            {renderSkillPreview("Hard skills", intake.profile.hardSkills, "text-amber-600")}
            {renderSkillPreview("Soft skills", intake.profile.softSkills, "text-sky-600")}
          </div>
        </section>

        <section className="space-y-4">
          {recommendedMatch ? (
            <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5">
              <div className="flex flex-col gap-4 lg:flex-row lg:items-start lg:justify-between">
                <div className="space-y-2">
                  <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
                    <Sparkles className="h-3.5 w-3.5" />
                    Aanbevolen topmatch
                  </div>
                  <p className="text-sm text-muted-foreground">
                    Eén klik koppelt direct door naar screening. Recruiters kunnen daarnaast ook
                    handmatig topmatches of een losse vacature kiezen.
                  </p>
                </div>
                <Button
                  onClick={handleAutoLink}
                  disabled={submitting !== null || recommendedMatch.isLinked}
                >
                  {submitting === "auto" ? (
                    <>
                      <Loader2 className="h-4 w-4 animate-spin" />
                      Auto-koppelen...
                    </>
                  ) : recommendedMatch.isLinked ? (
                    "Al gekoppeld"
                  ) : (
                    "Auto-koppel aanbevolen match"
                  )}
                </Button>
              </div>
              <div className="mt-4">
                <MatchSuggestionCard
                  match={recommendedMatch}
                  selected={selectedMatchIds.has(recommendedMatch.matchId)}
                  onToggle={() => undefined}
                  showCheckbox={false}
                />
              </div>
            </div>
          ) : null}

          <div className="rounded-2xl border border-border bg-card p-5 space-y-4">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <h3 className="text-base font-semibold text-foreground">
                  Topmatches en handmatige review
                </h3>
                <p className="text-sm text-muted-foreground mt-1">
                  De wizard toont maximaal vijf vacatures. Selecteer handmatig, auto-koppel de
                  aanbeveling of rond af zonder directe link.
                </p>
              </div>
              <Button
                type="button"
                variant={manualSearchEnabled ? "secondary" : "outline"}
                onClick={() => setManualSearchEnabled((previous) => !previous)}
              >
                <UserRoundX className="h-4 w-4" />
                {manualSearchEnabled ? "Topmatches opnieuw bekijken" : "Geen match voor nu"}
              </Button>
            </div>

            {topMatches.length === 0 ? (
              <EmptyState
                icon={<UserCheck className="h-8 w-8 opacity-40" />}
                title="Nog geen topmatches gevonden"
                subtitle="Zoek handmatig verder of rond af zodat de kandidaat in de inbox blijft staan."
              />
            ) : (
              <div className="space-y-3">
                {topMatches.map((match) => (
                  <MatchSuggestionCard
                    key={match.matchId}
                    match={match}
                    selected={selectedMatchIds.has(match.matchId)}
                    onToggle={(checked) => toggleMatch(match.matchId, checked)}
                  />
                ))}
              </div>
            )}

            {manualSearchEnabled ? (
              <div className="rounded-xl border border-dashed border-border bg-muted/20 p-4 space-y-4">
                <div>
                  <h4 className="text-sm font-semibold text-foreground">
                    Handmatig vacature zoeken
                  </h4>
                  <p className="text-xs text-muted-foreground mt-1">
                    Gebruik deze fallback wanneer de topmatches nog niet bruikbaar zijn.
                    Geselecteerde vacatures worden samen met eventuele topmatches gekoppeld.
                  </p>
                </div>
                <div className="flex gap-2">
                  <Input
                    value={manualQuery}
                    onChange={(event) => setManualQuery(event.target.value)}
                    onKeyDown={(event) => {
                      if (event.key === "Enter") {
                        event.preventDefault();
                        void runManualSearch();
                      }
                    }}
                    placeholder="Zoek op titel, opdrachtgever of locatie"
                  />
                  <Button
                    type="button"
                    variant="outline"
                    onClick={() => void runManualSearch()}
                    disabled={searchingJobs || !manualQuery.trim()}
                  >
                    {searchingJobs ? (
                      <Loader2 className="h-4 w-4 animate-spin" />
                    ) : (
                      <Search className="h-4 w-4" />
                    )}
                    Zoeken
                  </Button>
                </div>

                {manualResults.length > 0 ? (
                  <div className="space-y-2">
                    {manualResults.map((job) => (
                      <label
                        key={job.id}
                        className="flex items-start gap-3 rounded-lg border border-border bg-card px-3 py-3"
                      >
                        <input
                          type="checkbox"
                          checked={selectedJobIds.has(job.id)}
                          onChange={(event) => toggleJob(job.id, event.target.checked)}
                          className="mt-1 h-4 w-4 rounded border-border"
                        />
                        <div className="min-w-0 flex-1">
                          <p className="text-sm font-medium text-foreground">{job.title}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {[job.company, job.location, job.platform].filter(Boolean).join(" • ")}
                          </p>
                        </div>
                      </label>
                    ))}
                  </div>
                ) : manualQuery && !searchingJobs ? (
                  <p className="text-xs text-muted-foreground">
                    Nog geen vacatures gevonden voor deze zoekterm.
                  </p>
                ) : null}
              </div>
            ) : null}
          </div>
        </section>
      </div>

      {error ? <p className="text-sm text-destructive">{error}</p> : null}

      <div className="flex flex-col gap-3 border-t border-border pt-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="text-xs text-muted-foreground">
          {noImmediateLink
            ? "Geen directe koppeling geselecteerd. De kandidaat blijft in de talentpool en kan later vanuit het kandidaatdossier of een vacature opnieuw worden opgepakt."
            : `${selectedMatchCount} topmatch${selectedMatchCount === 1 ? "" : "es"} en ${selectedJobCount} handmatige vacature${selectedJobCount === 1 ? "" : "s"} geselecteerd.`}
        </div>
        <div className="flex justify-end gap-2">
          <Button type="button" variant="outline" onClick={onSkip} disabled={submitting !== null}>
            Later doen
          </Button>
          <Button onClick={handleConfirm} disabled={submitting !== null}>
            {submitting === "confirm" ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Koppelen...
              </>
            ) : noImmediateLink ? (
              "Afronden zonder koppeling"
            ) : (
              "Selectie koppelen en afronden"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}
