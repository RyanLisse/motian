"use client";

import { ArrowRight, Loader2, RefreshCw, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState } from "react";
import { MatchSuggestionCard } from "@/components/candidate-wizard/match-suggestion-card";
import type { MatchSuggestionItem } from "@/components/candidate-wizard/types";
import { Button } from "@/components/ui/button";

interface CandidateRecommendationPanelProps {
  candidateId: string;
  hasResume: boolean;
  initialMatches: MatchSuggestionItem[];
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function asString(value: unknown): string | null {
  return typeof value === "string" && value.length > 0 ? value : null;
}

function asNumber(value: unknown): number | null {
  return typeof value === "number" && Number.isFinite(value) ? value : null;
}

function asRecommendation(value: unknown): MatchSuggestionItem["recommendation"] {
  return value === "go" || value === "conditional" || value === "no-go" ? value : null;
}

function normalizeMatch(value: unknown): MatchSuggestionItem | null {
  if (!isRecord(value)) return null;

  const matchId = asString(value.matchId);
  const jobId = asString(value.jobId);
  const jobTitle = asString(value.jobTitle);
  const quickScore = asNumber(value.quickScore);

  if (!matchId || !jobId || !jobTitle || quickScore === null) {
    return null;
  }

  const recommendation = asRecommendation(value.recommendation);
  const recommendationSource: MatchSuggestionItem["recommendationSource"] = recommendation
    ? "backend"
    : "score";

  return {
    matchId,
    jobId,
    jobTitle,
    company: asString(value.company),
    location: asString(value.location),
    quickScore,
    reasoning: asString(value.reasoning),
    isLinked: value.isLinked === true,
    recommendation,
    recommendationConfidence: asNumber(value.recommendationConfidence),
    recommendationSource,
    status: asString(value.status),
  };
}

function pickRecommendedMatch(matches: MatchSuggestionItem[]): MatchSuggestionItem | null {
  const availableMatches = matches.filter((match) => !match.isLinked);
  const byScore = [...availableMatches].sort((left, right) => right.quickScore - left.quickScore);

  return (
    byScore.find((match) => match.recommendation === "go") ??
    byScore.find((match) => match.recommendation === "conditional") ??
    byScore[0] ??
    null
  );
}

export function CandidateRecommendationPanel({
  candidateId,
  hasResume,
  initialMatches,
}: CandidateRecommendationPanelProps) {
  const router = useRouter();
  const [matches, setMatches] = useState(initialMatches);
  const [pendingAction, setPendingAction] = useState<"refresh" | "link" | null>(null);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setMatches(initialMatches);
  }, [initialMatches]);

  const recommendedMatch = useMemo(() => pickRecommendedMatch(matches), [matches]);
  const highlightedRecommendationSource: MatchSuggestionItem["recommendationSource"] =
    recommendedMatch?.recommendation ? "backend" : "score";
  const highlightedMatch = recommendedMatch
    ? {
        ...recommendedMatch,
        isRecommended: true,
        recommendationSource: highlightedRecommendationSource,
      }
    : null;

  const refreshRecommendations = async () => {
    setPendingAction("refresh");
    setError(null);

    try {
      const response = await fetch(`/api/kandidaten/${candidateId}/match`, {
        method: "POST",
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message = isRecord(body) && typeof body.error === "string" ? body.error : null;
        throw new Error(message ?? "Aanbevelingen vernieuwen mislukt");
      }

      const nextMatches = isRecord(body) && Array.isArray(body.matches) ? body.matches : [];
      setMatches(
        nextMatches
          .map(normalizeMatch)
          .filter((match): match is MatchSuggestionItem => match !== null),
      );
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aanbevelingen vernieuwen mislukt");
    } finally {
      setPendingAction(null);
    }
  };

  const autoLinkRecommendation = async () => {
    if (!recommendedMatch) return;

    setPendingAction("link");
    setError(null);

    try {
      const response = await fetch(`/api/kandidaten/${candidateId}/koppel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchIds: [recommendedMatch.matchId] }),
      });
      const body = await response.json().catch(() => null);

      if (!response.ok) {
        const message = isRecord(body) && typeof body.error === "string" ? body.error : null;
        throw new Error(message ?? "Aanbevolen match koppelen mislukt");
      }

      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Aanbevolen match koppelen mislukt");
    } finally {
      setPendingAction(null);
    }
  };

  return (
    <section className="mb-8">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
        <div className="flex flex-col gap-3 lg:flex-row lg:items-start lg:justify-between">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <Sparkles className="h-3.5 w-3.5" />
              Aanbevolen volgende stap
            </div>
            <p className="text-sm text-muted-foreground">
              Vernieuw kandidaat-aanbevelingen en start direct vanuit dit dossier, zonder eerst naar
              een apart aanbevelingsoverzicht te gaan.
            </p>
          </div>
          <Button
            type="button"
            variant="outline"
            onClick={() => void refreshRecommendations()}
            disabled={pendingAction !== null || !hasResume}
            className="gap-2"
          >
            {pendingAction === "refresh" ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <RefreshCw className="h-4 w-4" />
            )}
            AI aanbevelingen vernieuwen
          </Button>
        </div>

        {highlightedMatch ? (
          <>
            <MatchSuggestionCard
              match={highlightedMatch}
              selected={false}
              onToggle={() => undefined}
              showCheckbox={false}
            />
            <div className="flex flex-wrap gap-2">
              <Button
                type="button"
                onClick={() => void autoLinkRecommendation()}
                disabled={pendingAction !== null}
              >
                {pendingAction === "link" ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Screening starten...
                  </>
                ) : (
                  "Start screening op aanbeveling"
                )}
              </Button>
              <Button asChild variant="outline">
                <Link href={`/vacatures/${highlightedMatch.jobId}`}>
                  Open vacature
                  <ArrowRight className="h-4 w-4" />
                </Link>
              </Button>
              <Button asChild variant="ghost">
                <Link href="#matches">Bekijk alle matchkansen</Link>
              </Button>
            </div>
          </>
        ) : (
          <div className="rounded-xl border border-dashed border-primary/20 bg-background/70 p-4 text-sm text-muted-foreground">
            {hasResume
              ? "Nog geen open aanbeveling beschikbaar. Vernieuw de AI-aanbevelingen of bekijk de matchkansen hieronder."
              : "Upload eerst een CV om deze kandidaat direct vanuit het dossier van nieuwe aanbevelingen te voorzien."}
          </div>
        )}

        {error ? <p className="text-sm text-destructive">{error}</p> : null}
      </div>
    </section>
  );
}
