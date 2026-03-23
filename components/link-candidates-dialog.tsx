"use client";

import { Loader2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
import type { CandidateMatchItem } from "@/components/candidate-wizard/candidate-match-card";
import { CandidateMatchCard } from "@/components/candidate-wizard/candidate-match-card";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";

interface LinkCandidatesDialogProps {
  jobId: string;
  jobTitle: string;
}

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
        Top-3 passende kandidaten voor &quot;{jobTitle}&quot;. Selecteer direct wie je aan screening
        wilt toevoegen.
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
  const [matches, setMatches] = useState<CandidateMatchItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  const fetchMatches = useCallback(async () => {
    setLoading(true);
    setError("");
    try {
      const res = await fetch(`/api/opdrachten/${jobId}/match-kandidaten`, { method: "POST" });
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
      setMatches(items);
      setSelected(getInitialSelection(items));
    } catch (err) {
      setError(err instanceof Error ? err.message : "Matchen mislukt");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    void fetchMatches();
  }, [fetchMatches]);

  const toggle = useCallback((matchId: string, checked: boolean) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (checked) next.add(matchId);
      else next.delete(matchId);
      return next;
    });
  }, []);

  const handleConfirm = async () => {
    const matchIds = matches
      .filter((match) => selected.has(match.matchId) && !match.isLinked)
      .map((match) => match.matchId);

    if (matchIds.length === 0) {
      router.refresh();
      return;
    }

    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/opdrachten/${jobId}/koppel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Koppelen mislukt");
      }

      const linkedMatchIds = new Set(matchIds);
      setMatches((prev) =>
        prev.map((match) =>
          linkedMatchIds.has(match.matchId) ? { ...match, isLinked: true } : match,
        ),
      );
      setSelected(new Set());
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Koppelen mislukt");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <LinkCandidatesContent
      jobId={jobId}
      jobTitle={jobTitle}
      loading={loading}
      error={error}
      matches={matches}
      selected={selected}
      submitting={submitting}
      onToggle={toggle}
      onConfirm={handleConfirm}
    />
  );
}
