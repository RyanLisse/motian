"use client";

import { CheckCircle2, Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import type { CandidateMatchItem } from "@/components/candidate-wizard/candidate-match-card";
import { CandidateMatchCard } from "@/components/candidate-wizard/candidate-match-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface LinkCandidatesDialogProps {
  jobId: string;
  jobTitle: string;
}

/** Auto-select the first available (unlinked) candidate for quick linking. */
function getInitialSelection(items: CandidateMatchItem[]) {
  const firstAvailable = items.find((item) => !item.isLinked);
  return firstAvailable ? new Set([firstAvailable.matchId]) : new Set<string>();
}

function LinkCandidatesContent({
  jobId,
  jobTitle,
  loading,
  error,
  matches,
  selected,
  submitting,
  linkedCount,
  onToggle,
  onConfirm,
}: {
  jobId: string;
  jobTitle: string;
  loading: boolean;
  error: string;
  matches: CandidateMatchItem[];
  selected: Set<string>;
  submitting: boolean;
  linkedCount: number;
  onToggle: (matchId: string, checked: boolean) => void;
  onConfirm: () => Promise<void>;
}) {
  const selectedCount = matches.filter(
    (match) => selected.has(match.matchId) && !match.isLinked,
  ).length;
  const hasAvailableMatches = matches.some((match) => !match.isLinked);
  const recruiterCockpitHref = `/vacatures/${jobId}#recruiter-cockpit`;
  const gradingHref = `/vacatures/${jobId}#ai-grading`;

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Bezig met matchen...</p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-20 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error && matches.length === 0) {
    return <p className="text-sm text-destructive">{error}</p>;
  }

  if (matches.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Geen passende kandidaten gevonden.</p>
        <div className="flex flex-wrap gap-2 text-xs">
          <a href={recruiterCockpitHref} className="text-primary hover:underline">
            Recruiter cockpit
          </a>
          <a href={gradingHref} className="text-primary hover:underline">
            AI Grading
          </a>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Top-3 passende kandidaten voor &quot;{jobTitle}&quot;. Vink aan wie je wilt toevoegen aan de
        screening pipeline.
      </p>
      <div className="space-y-3">
        {matches.map((match) => (
          <CandidateMatchCard
            key={match.matchId}
            match={match}
            selected={selected.has(match.matchId)}
            onToggle={(checked) => onToggle(match.matchId, checked)}
          />
        ))}
      </div>
      {linkedCount > 0 ? (
        <div className="flex items-center gap-2 rounded-lg border border-green-200 bg-green-50 p-3 dark:border-green-800 dark:bg-green-950/30">
          <CheckCircle2 className="h-4 w-4 text-green-600 shrink-0" />
          <p className="text-sm text-green-800 dark:text-green-300">
            {linkedCount} {linkedCount === 1 ? "kandidaat" : "kandidaten"} toegevoegd aan screening pipeline.
          </p>
        </div>
      ) : null}
      {error ? <p className="text-sm text-destructive">{error}</p> : null}
      <div className="flex flex-wrap items-center justify-between gap-2 border-t border-border pt-4">
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          {hasAvailableMatches ? (
            <span>Geselecteerde kandidaten gaan direct naar screening.</span>
          ) : null}
          {!hasAvailableMatches ? <span>Alle suggesties zijn al gekoppeld.</span> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          <Button onClick={() => void onConfirm()} disabled={submitting || selectedCount === 0}>
            {submitting ? (
              <>
                <Loader2 className="h-4 w-4 animate-spin" />
                Koppelen...
              </>
            ) : selectedCount > 1 ? (
              `Koppel ${selectedCount} kandidaten aan screening`
            ) : (
              "Koppel aan screening"
            )}
          </Button>
        </div>
      </div>
    </div>
  );
}

export function LinkCandidatesDialog({ jobId, jobTitle }: LinkCandidatesDialogProps) {
  const router = useRouter();
  const [userSelection, setUserSelection] = useState<Set<string> | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");
  const [linkedCount, setLinkedCount] = useState(0);

  const { data: matches = [], isLoading, error: queryError } = useQuery({
    queryKey: ["link-candidates", jobId],
    queryFn: async () => {
      const res = await fetch(`/api/vacatures/${jobId}/match-kandidaten`, { method: "POST" });
      if (!res.ok) throw new Error("Matchen mislukt");
      const data = await res.json();
      const linkedSet = new Set<string>(data.alreadyLinked ?? []);
      const items: CandidateMatchItem[] = (data.matches ?? []).map(
        (match: Record<string, unknown>) => ({
          candidateId: match.candidateId as string,
          candidateName: (match.candidateName as string) ?? "",
          quickScore: Number(match.quickScore ?? 0),
          matchId: (match.matchId as string) ?? "",
          reasoning: (match.reasoning as string) ?? null,
          isLinked: linkedSet.has(match.candidateId as string),
        }),
      );
      return items;
    },
  });

  const selected = useMemo(
    () => userSelection ?? getInitialSelection(matches),
    [userSelection, matches],
  );

  const error = submitError || (queryError instanceof Error ? queryError.message : "");

  const toggle = useCallback((matchId: string, checked: boolean) => {
    setUserSelection((prev) => {
      const next = new Set(prev ?? getInitialSelection(matches));
      if (checked) next.add(matchId);
      else next.delete(matchId);
      return next;
    });
  }, [matches]);

  const handleConfirm = async () => {
    const matchIds = matches
      .filter((match) => selected.has(match.matchId) && !match.isLinked)
      .map((match) => match.matchId);

    if (matchIds.length === 0) {
      router.refresh();
      return;
    }

    setSubmitting(true);
    setSubmitError("");
    try {
      const res = await fetch(`/api/vacatures/${jobId}/koppel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Koppelen mislukt");
      }

      const result = await res.json();
      setLinkedCount(result.created ?? matchIds.length);
      setUserSelection(new Set());
      router.refresh();
    } catch (err) {
      setSubmitError(err instanceof Error ? err.message : "Koppelen mislukt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinkCandidatesContent
      jobId={jobId}
      jobTitle={jobTitle}
      loading={isLoading}
      error={error}
      matches={matches}
      selected={selected}
      submitting={submitting}
      linkedCount={linkedCount}
      onToggle={toggle}
      onConfirm={handleConfirm}
    />
  );
}
