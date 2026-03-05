"use client";

import { Loader2 } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import type { MatchSuggestionItem } from "./match-suggestion-card";
import { MatchSuggestionCard } from "./match-suggestion-card";

interface WizardStepLinkingProps {
  candidateId: string;
  onComplete: () => void;
  onSkip: () => void;
}

export function WizardStepLinking({ candidateId, onComplete, onSkip }: WizardStepLinkingProps) {
  const [matches, setMatches] = useState<MatchSuggestionItem[]>([]);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    let cancelled = false;
    (async () => {
      setLoading(true);
      setError("");
      try {
        const res = await fetch(`/api/kandidaten/${candidateId}/match`, { method: "POST" });
        if (!res.ok) throw new Error("Matchen mislukt");
        const data = await res.json();
        if (cancelled) return;
        const linkedSet = new Set<string>(data.alreadyLinked ?? []);
        const items: MatchSuggestionItem[] = (data.matches ?? []).map(
          (m: Record<string, unknown>) => ({
            jobId: m.jobId as string,
            jobTitle: (m.jobTitle as string) ?? "",
            company: (m.company as string) ?? null,
            location: (m.location as string) ?? null,
            quickScore: Number(m.quickScore) ?? 0,
            matchId: (m.matchId as string) ?? "",
            reasoning: (m.reasoning as string) ?? null,
            isLinked: linkedSet.has(m.jobId as string),
          }),
        );
        setMatches(items);
        if (items.length > 0 && !items[0].isLinked) {
          setSelected(new Set([items[0].matchId]));
        }
      } catch (err) {
        if (!cancelled) setError(err instanceof Error ? err.message : "Matchen mislukt");
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

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
      .filter((m) => selected.has(m.matchId) && !m.isLinked)
      .map((m) => m.matchId);
    if (matchIds.length === 0) {
      onComplete();
      return;
    }
    setSubmitting(true);
    setError("");
    try {
      const res = await fetch(`/api/kandidaten/${candidateId}/koppel`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchIds }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => null);
        throw new Error(body?.error ?? "Koppelen mislukt");
      }
      onComplete();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Koppelen mislukt");
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Bezig met matchen...</p>
        <div className="space-y-3">
          {[1, 2, 3].map((i) => (
            <Skeleton key={i} className="h-24 rounded-lg" />
          ))}
        </div>
      </div>
    );
  }

  if (error && matches.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-destructive">{error}</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip}>
            Overslaan
          </Button>
        </div>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="space-y-4">
        <p className="text-sm text-muted-foreground">Geen passende vacatures gevonden.</p>
        <div className="flex gap-2">
          <Button variant="outline" onClick={onSkip}>
            Sluiten
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        Selecteer de vacatures waaraan je deze kandidaat wilt koppelen. De beste match staat
        standaard aangevinkt.
      </p>
      <div className="space-y-3 max-h-[50vh] overflow-y-auto">
        {matches.map((match) => (
          <MatchSuggestionCard
            key={match.matchId}
            match={match}
            selected={selected.has(match.matchId)}
            onToggle={(checked) => toggle(match.matchId, checked)}
          />
        ))}
      </div>
      {error && <p className="text-sm text-destructive">{error}</p>}
      <div className="flex justify-end gap-2 pt-2">
        <Button type="button" variant="outline" onClick={onSkip} disabled={submitting}>
          Overslaan
        </Button>
        <Button onClick={handleConfirm} disabled={submitting}>
          {submitting ? (
            <>
              <Loader2 className="h-4 w-4 animate-spin" />
              Koppelen...
            </>
          ) : (
            "Koppelen en afronden"
          )}
        </Button>
      </div>
    </div>
  );
}
