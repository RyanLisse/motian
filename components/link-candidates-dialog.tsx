"use client";

import { Award, Loader2, Sparkles, UserPlus } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useState } from "react";
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
  trigger?: React.ReactNode;
}

export function LinkCandidatesDialog({ jobId, jobTitle, trigger }: LinkCandidatesDialogProps) {
  const router = useRouter();
  const recruiterCockpitHref = `/opdrachten/${jobId}#recruiter-cockpit`;
  const gradingHref = `/opdrachten/${jobId}#ai-grading`;
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
        (m: Record<string, unknown>) => ({
          candidateId: m.candidateId as string,
          candidateName: (m.candidateName as string) ?? "",
          quickScore: Number(m.quickScore) ?? 0,
          matchId: (m.matchId as string) ?? "",
          reasoning: (m.reasoning as string) ?? null,
          isLinked: linkedSet.has(m.candidateId as string),
        }),
      );
      setMatches(items);
      if (items.length > 0 && !items[0].isLinked) {
        setSelected(new Set([items[0].matchId]));
      } else {
        setSelected(new Set());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Matchen mislukt");
    } finally {
      setLoading(false);
    }
  }, [jobId]);

  useEffect(() => {
    if (open) void fetchMatches();
  }, [open, fetchMatches]);

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
      setOpen(false);
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
      setOpen(false);
      router.refresh();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Koppelen mislukt");
    } finally {
      setSubmitting(false);
    }
  };

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
            Top-3 passende kandidaten voor &quot;{jobTitle}&quot;. Selecteer wie je wilt koppelen of
            open eerst de recruiter cockpit of AI grading op de vacaturepagina voor extra context.
          </DialogDescription>
        </DialogHeader>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm">
            <Link href={recruiterCockpitHref} onClick={() => setOpen(false)}>
              <Sparkles className="h-4 w-4" />
              Recruiter cockpit
            </Link>
          </Button>
          <Button asChild variant="outline" size="sm">
            <Link href={gradingHref} onClick={() => setOpen(false)}>
              <Award className="h-4 w-4" />
              AI Grading
            </Link>
          </Button>
        </div>
        {loading ? (
          <div className="space-y-4">
            <p className="text-sm text-muted-foreground">Bezig met matchen...</p>
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <Skeleton key={i} className="h-20 rounded-lg" />
              ))}
            </div>
          </div>
        ) : error && matches.length === 0 ? (
          <p className="text-sm text-destructive">{error}</p>
        ) : matches.length === 0 ? (
          <p className="text-sm text-muted-foreground">Geen passende kandidaten gevonden.</p>
        ) : (
          <div className="space-y-4">
            <div className="space-y-3 max-h-[50vh] overflow-y-auto">
              {matches.map((match) => (
                <CandidateMatchCard
                  key={match.matchId}
                  match={match}
                  selected={selected.has(match.matchId)}
                  onToggle={(checked) => toggle(match.matchId, checked)}
                />
              ))}
            </div>
            {error && <p className="text-sm text-destructive">{error}</p>}
            <div className="flex justify-end gap-2 pt-2">
              <Button variant="outline" onClick={() => setOpen(false)} disabled={submitting}>
                Annuleren
              </Button>
              <Button onClick={handleConfirm} disabled={submitting}>
                {submitting ? (
                  <>
                    <Loader2 className="h-4 w-4 animate-spin" />
                    Koppelen...
                  </>
                ) : (
                  "Koppelen"
                )}
              </Button>
            </div>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
