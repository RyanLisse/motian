"use client";

import {
  AlertTriangle,
  Building2,
  CheckCircle2,
  ExternalLink,
  Gavel,
  Loader2,
  MapPin,
  Star,
  XCircle,
} from "lucide-react";
import Link from "next/link";
import { useEffect, useState } from "react";
import type { StructuredMatchOutput } from "@/src/schemas/matching";

type JudgeVerdict = {
  agreement: "agree" | "disagree" | "partial";
  adjustedScore: number;
  adjustedRecommendation: "go" | "no-go" | "conditional";
  confidence: number;
  reasoning: string;
  redFlags: string[];
};

type AutoMatchResult = {
  jobId: string;
  jobTitle: string;
  company: string | null;
  location: string | null;
  quickScore: number;
  structuredResult: StructuredMatchOutput | null;
  judgeVerdict: JudgeVerdict | null;
  matchId: string;
};

interface AutoMatchResultsProps {
  candidateId: string;
}

export function AutoMatchResults({ candidateId }: AutoMatchResultsProps) {
  const [status, setStatus] = useState<"loading" | "done" | "error">("loading");
  const [phase, setPhase] = useState<"scanning" | "matching">("scanning");
  const [matches, setMatches] = useState<AutoMatchResult[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;

    async function runAutoMatch() {
      try {
        // Phase 1: scanning
        setPhase("scanning");
        await new Promise((r) => setTimeout(r, 800));
        if (cancelled) return;
        setPhase("matching");

        const res = await fetch("/api/matches/auto", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ candidateId }),
        });

        if (cancelled) return;

        if (!res.ok) {
          const json = await res.json().catch(() => ({}));
          throw new Error(json.error ?? "Auto-matching mislukt");
        }

        const data = await res.json();
        setMatches(data.matches ?? []);
        setStatus("done");
      } catch (err) {
        if (!cancelled) {
          setError(err instanceof Error ? err.message : "Onbekende fout");
          setStatus("error");
        }
      }
    }

    runAutoMatch();
    return () => {
      cancelled = true;
    };
  }, [candidateId]);

  if (status === "loading") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-primary/20 bg-primary/5 p-4">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
        <div>
          <p className="text-sm font-medium text-primary">
            {phase === "scanning"
              ? "Vacatures worden gescand..."
              : "Top matches worden beoordeeld..."}
          </p>
          <p className="text-xs text-muted-foreground">
            {phase === "scanning"
              ? "Alle actieve vacatures worden vergeleken"
              : "Gedetailleerde beoordeling per criterium"}
          </p>
        </div>
      </div>
    );
  }

  if (status === "error") {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-destructive/20 bg-destructive/5 p-4">
        <XCircle className="h-5 w-5 text-destructive" />
        <p className="text-sm text-destructive">{error}</p>
      </div>
    );
  }

  if (matches.length === 0) {
    return (
      <div className="flex items-center gap-3 rounded-lg border border-muted bg-muted/30 p-4">
        <AlertTriangle className="h-5 w-5 text-muted-foreground" />
        <p className="text-sm text-muted-foreground">
          Geen geschikte vacatures gevonden voor deze kandidaat
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-green-600" />
        <p className="text-sm font-medium">
          {matches.length} {matches.length === 1 ? "match" : "matches"} gevonden
        </p>
      </div>

      {matches.map((match) => (
        <MatchCard key={match.jobId} match={match} />
      ))}
    </div>
  );
}

function MatchCard({ match }: { match: AutoMatchResult }) {
  const sr = match.structuredResult;
  const recommendation = sr?.recommendation;

  return (
    <div className="rounded-lg border bg-card p-4 space-y-3">
      {/* Header: Job title + badge */}
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <h4 className="font-medium text-sm truncate">{match.jobTitle}</h4>
          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {match.company && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3" />
                {match.company}
              </span>
            )}
            {match.location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3" />
                {match.location}
              </span>
            )}
          </div>
        </div>
        <RecommendationBadge recommendation={recommendation} />
      </div>

      {/* Score bars */}
      <div className="space-y-1.5">
        <ScoreBar label="Quick score" score={match.quickScore} />
        {sr && <ScoreBar label="Beoordeling" score={sr.overallScore} />}
      </div>

      {/* Top criteria (gunning stars) */}
      {sr && sr.criteriaBreakdown.length > 0 && (
        <div className="space-y-1">
          {sr.criteriaBreakdown
            .filter((c) => c.tier === "knockout")
            .slice(0, 2)
            .map((c) => (
              <div key={c.criterion} className="flex items-center gap-2 text-xs">
                {c.passed ? (
                  <CheckCircle2 className="h-3 w-3 text-green-600 shrink-0" />
                ) : (
                  <XCircle className="h-3 w-3 text-destructive shrink-0" />
                )}
                <span className="truncate">{c.criterion}</span>
              </div>
            ))}
          {sr.criteriaBreakdown
            .filter((c) => c.tier === "gunning" && c.stars != null)
            .sort((a, b) => (b.stars ?? 0) - (a.stars ?? 0))
            .slice(0, 2)
            .map((c) => (
              <div key={c.criterion} className="flex items-center gap-2 text-xs">
                <span className="flex shrink-0">
                  {Array.from({ length: c.stars ?? 0 }).map((_, i) => (
                    <Star
                      key={`${c.criterion}-star-${i}`}
                      className="h-3 w-3 fill-amber-400 text-amber-400"
                    />
                  ))}
                </span>
                <span className="truncate text-muted-foreground">{c.criterion}</span>
              </div>
            ))}
        </div>
      )}

      {/* Grok Judge Verdict */}
      {match.judgeVerdict && <JudgeVerdictSection verdict={match.judgeVerdict} />}

      {/* Risk flags */}
      {sr && sr.riskProfile.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {sr.riskProfile.slice(0, 2).map((risk) => (
            <span
              key={risk}
              className="inline-flex items-center gap-1 rounded-full bg-amber-100 px-2 py-0.5 text-xs text-amber-800 dark:bg-amber-900/30 dark:text-amber-300"
            >
              <AlertTriangle className="h-2.5 w-2.5" />
              {risk.length > 40 ? `${risk.slice(0, 40)}…` : risk}
            </span>
          ))}
        </div>
      )}

      {/* Links */}
      <div className="flex gap-3 pt-1">
        <Link
          href={`/opdrachten/${match.jobId}`}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
        >
          Bekijk opdracht
          <ExternalLink className="h-3 w-3" />
        </Link>
        {match.matchId && (
          <Link
            href={`/matching/${match.matchId}`}
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline"
          >
            Bekijk match
            <ExternalLink className="h-3 w-3" />
          </Link>
        )}
      </div>
    </div>
  );
}

function JudgeVerdictSection({ verdict }: { verdict: JudgeVerdict }) {
  const agreementConfig = {
    agree: {
      label: "Bevestigd",
      icon: <CheckCircle2 className="h-3 w-3 text-green-600" />,
      bg: "bg-green-50 border-green-200 dark:bg-green-950/30 dark:border-green-800",
    },
    disagree: {
      label: "Afwijkend",
      icon: <XCircle className="h-3 w-3 text-red-600" />,
      bg: "bg-red-50 border-red-200 dark:bg-red-950/30 dark:border-red-800",
    },
    partial: {
      label: "Deels eens",
      icon: <AlertTriangle className="h-3 w-3 text-amber-600" />,
      bg: "bg-amber-50 border-amber-200 dark:bg-amber-950/30 dark:border-amber-800",
    },
  };

  const config = agreementConfig[verdict.agreement];

  return (
    <div className={`rounded-md border p-2.5 space-y-1.5 ${config.bg}`}>
      <div className="flex items-center gap-1.5">
        <Gavel className="h-3 w-3 text-muted-foreground" />
        <span className="text-xs font-medium">Grok Judge</span>
        <span className="flex items-center gap-1 text-xs">
          {config.icon}
          {config.label}
        </span>
        <span className="ml-auto text-xs text-muted-foreground">{verdict.adjustedScore}%</span>
      </div>
      <p className="text-xs text-muted-foreground leading-relaxed">{verdict.reasoning}</p>
      {verdict.redFlags.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {verdict.redFlags.slice(0, 2).map((flag) => (
            <span
              key={flag}
              className="inline-flex items-center gap-1 rounded-full bg-red-100 px-1.5 py-0.5 text-[10px] text-red-700 dark:bg-red-900/40 dark:text-red-300"
            >
              {flag.length > 35 ? `${flag.slice(0, 35)}…` : flag}
            </span>
          ))}
        </div>
      )}
    </div>
  );
}

function ScoreBar({ label, score }: { label: string; score: number }) {
  const color = score >= 70 ? "bg-green-500" : score >= 50 ? "bg-amber-500" : "bg-red-500";

  return (
    <div className="flex items-center gap-2">
      <span className="text-xs text-muted-foreground w-20 shrink-0">{label}</span>
      <div className="flex-1 h-2 rounded-full bg-muted overflow-hidden">
        <div
          className={`h-full rounded-full transition-all ${color}`}
          style={{ width: `${Math.min(100, score)}%` }}
        />
      </div>
      <span className="text-xs font-medium w-8 text-right">{score}%</span>
    </div>
  );
}

function RecommendationBadge({
  recommendation,
}: {
  recommendation?: "go" | "no-go" | "conditional" | null;
}) {
  if (!recommendation) return null;

  const config = {
    go: {
      label: "Go",
      className: "bg-green-100 text-green-800 dark:bg-green-900/30 dark:text-green-300",
    },
    "no-go": {
      label: "No-go",
      className: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-300",
    },
    conditional: {
      label: "Voorwaardelijk",
      className: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-300",
    },
  };

  const { label, className } = config[recommendation];

  return (
    <span
      className={`inline-flex items-center rounded-full px-2 py-0.5 text-xs font-medium shrink-0 ${className}`}
    >
      {label}
    </span>
  );
}
