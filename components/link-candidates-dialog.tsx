"use client";

import { Loader2, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { type ReactNode, useCallback, useEffect, useState } from "react";
import type { CandidateMatchItem } from "@/components/candidate-wizard/candidate-match-card";
import { CandidateMatchCard } from "@/components/candidate-wizard/candidate-match-card";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Skeleton } from "@/components/ui/skeleton";

interface LinkCandidatesDialogProps {
  jobId: string;
  jobTitle: string;
  trigger?: ReactNode;
  variant?: "dialog" | "inline";
  matchingHref?: string;
}

function getInitialSelection(items: CandidateMatchItem[]) {
  const firstAvailable = items.find((item) => !item.isLinked);
  return firstAvailable ? new Set([firstAvailable.matchId]) : new Set<string>();
}

function LinkCandidatesContent({
  variant,
  jobTitle,
  matchingHref,
  loading,
  error,
  matches,
  selected,
  submitting,
  onToggle,
  onClose,
  onConfirm,
}: {
  variant: "dialog" | "inline";
  jobTitle: string;
  matchingHref?: string;
  loading: boolean;
  error: string;
  matches: CandidateMatchItem[];
  selected: Set<string>;
  submitting: boolean;
  onToggle: (matchId: string, checked: boolean) => void;
  onClose?: () => void;
  onConfirm: () => Promise<void>;
}) {
  const selectedCount = matches.filter(
    (match) => selected.has(match.matchId) && !match.isLinked,
  ).length;
  const hasAvailableMatches = matches.some((match) => !match.isLinked);

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
    return <p className="text-sm text-muted-foreground">Geen passende kandidaten gevonden.</p>;
  }

  return (
    <div className="space-y-4">
      {variant === "inline" ? (
        <p className="text-sm text-muted-foreground">
          Top-3 passende kandidaten voor &quot;{jobTitle}&quot;. Selecteer direct wie je aan
          screening wilt toevoegen.
        </p>
      ) : null}
      <div
        className={variant === "inline" ? "space-y-3" : "max-h-[50vh] space-y-3 overflow-y-auto"}
      >
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
          {matchingHref ? (
            <Link href={matchingHref} className="text-primary hover:underline">
              Meer matches in matching
            </Link>
          ) : null}
          {variant === "inline" && hasAvailableMatches ? (
            <span>Geselecteerde kandidaten gaan direct naar screening.</span>
          ) : null}
          {!hasAvailableMatches ? <span>Alle suggesties zijn al gekoppeld.</span> : null}
        </div>
        <div className="flex flex-wrap justify-end gap-2">
          {variant === "dialog" && onClose ? (
            <Button variant="outline" onClick={onClose} disabled={submitting}>
              Annuleren
            </Button>
          ) : null}
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

export function LinkCandidatesDialog({
  jobId,
  jobTitle,
  trigger,
  variant = "dialog",
  matchingHref,
}: LinkCandidatesDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
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
    if (variant === "inline" || open) {
      void fetchMatches();
    }
  }, [fetchMatches, open, variant]);

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
      if (variant === "dialog") {
        setOpen(false);
      }
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

      if (variant === "dialog") {
        setOpen(false);
      }
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Koppelen mislukt");
    } finally {
      setSubmitting(false);
    }
  };

  const content = (
    <LinkCandidatesContent
      variant={variant}
      jobTitle={jobTitle}
      matchingHref={matchingHref}
      loading={loading}
      error={error}
      matches={matches}
      selected={selected}
      submitting={submitting}
      onToggle={toggle}
      onClose={variant === "dialog" ? () => setOpen(false) : undefined}
      onConfirm={handleConfirm}
    />
  );

  if (variant === "inline") {
    return content;
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        {trigger ?? (
          <Button variant="outline" size="sm">
            <UserPlus className="h-4 w-4" />
            Koppel kandidaten
          </Button>
        )}
      </DialogTrigger>
      <DialogContent className="max-h-[90vh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Kandidaten koppelen aan vacature</DialogTitle>
          <DialogDescription>
            Top-3 passende kandidaten voor &quot;{jobTitle}&quot;. Selecteer wie je wilt koppelen.
          </DialogDescription>
        </DialogHeader>
        {content}
      </DialogContent>
    </Dialog>
  );
}
