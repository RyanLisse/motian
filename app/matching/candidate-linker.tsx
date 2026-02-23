"use client";

import { CheckCircle2, Loader2, Search, UserPlus } from "lucide-react";
import { useCallback, useRef, useState, useTransition } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { linkCandidateToJob } from "./actions";

type Candidate = {
  id: string;
  name: string;
  role?: string | null;
  location?: string | null;
};

interface CandidateLinkerProps {
  jobId: string;
  /** IDs of candidates already linked to this job (to show status) */
  linkedCandidateIds: string[];
}

export function CandidateLinker({ jobId, linkedCandidateIds }: CandidateLinkerProps) {
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [linked, setLinked] = useState<Set<string>>(new Set(linkedCandidateIds));
  const [linkingId, setLinkingId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();
  const [error, setError] = useState<string | null>(null);
  const abortRef = useRef<AbortController | null>(null);

  const search = useCallback(async () => {
    if (!query.trim()) return;
    abortRef.current?.abort();
    abortRef.current = new AbortController();
    setSearching(true);
    setError(null);
    try {
      const res = await fetch(`/api/kandidaten?q=${encodeURIComponent(query.trim())}&limiet=10`, {
        signal: abortRef.current.signal,
      });
      if (!res.ok) throw new Error("Zoeken mislukt");
      const json = await res.json();
      setResults(json.data ?? []);
    } catch (e) {
      if (e instanceof Error && e.name === "AbortError") return;
      setError("Kan kandidaten niet laden");
    } finally {
      setSearching(false);
    }
  }, [query]);

  const handleLink = (candidateId: string) => {
    setLinkingId(candidateId);
    setError(null);
    startTransition(async () => {
      const result = await linkCandidateToJob(jobId, candidateId);
      if (result.success) {
        setLinked((prev) => new Set(prev).add(candidateId));
      } else {
        setError(result.error ?? "Koppelen mislukt");
      }
      setLinkingId(null);
    });
  };

  return (
    <div className="bg-card border border-border rounded-xl p-4 space-y-3">
      <div className="flex items-center gap-2">
        <UserPlus className="h-4 w-4 text-primary" />
        <h3 className="text-sm font-semibold text-foreground">Handmatig koppelen</h3>
      </div>

      <div className="flex gap-2">
        <Input
          placeholder="Zoek kandidaat op naam..."
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          onKeyDown={(e) => e.key === "Enter" && search()}
          className="h-9 text-sm"
        />
        <Button
          variant="outline"
          size="sm"
          onClick={search}
          disabled={searching || !query.trim()}
          className="h-9 px-3 shrink-0"
        >
          {searching ? (
            <Loader2 className="h-4 w-4 animate-spin" />
          ) : (
            <Search className="h-4 w-4" />
          )}
        </Button>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {results.length > 0 && (
        <div className="space-y-1.5 max-h-60 overflow-y-auto">
          {results.map((c) => {
            const isLinked = linked.has(c.id);
            const isLinking = linkingId === c.id && isPending;

            return (
              <div
                key={c.id}
                className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg bg-background border border-border"
              >
                <div className="min-w-0">
                  <p className="text-sm font-medium text-foreground truncate">{c.name}</p>
                  {(c.role || c.location) && (
                    <p className="text-xs text-muted-foreground truncate">
                      {[c.role, c.location].filter(Boolean).join(" · ")}
                    </p>
                  )}
                </div>
                {isLinked ? (
                  <span className="flex items-center gap-1 text-xs text-primary shrink-0">
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Gekoppeld
                  </span>
                ) : (
                  <Button
                    variant="outline"
                    size="sm"
                    onClick={() => handleLink(c.id)}
                    disabled={isLinking}
                    className="h-7 px-2.5 text-xs shrink-0"
                  >
                    {isLinking ? <Loader2 className="h-3 w-3 animate-spin" /> : "Koppelen"}
                  </Button>
                )}
              </div>
            );
          })}
        </div>
      )}

      {results.length === 0 && query && !searching && !error && (
        <p className="text-xs text-muted-foreground">Geen kandidaten gevonden</p>
      )}
    </div>
  );
}
