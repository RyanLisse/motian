"use client";

import {
  Building2,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  Lightbulb,
  MapPin,
  ShieldCheck,
  Star,
  XCircle,
} from "lucide-react";
import Link from "next/link";

import { MatchActions } from "@/app/matching/match-actions";
import { CriteriaBreakdownChart } from "@/components/matching/criteria-breakdown-chart";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import type { CriterionResult } from "@/src/schemas/matching";
import type { JudgeVerdict } from "@/src/services/match-judge";

interface CvMatchCardProps {
  jobId: string;
  jobTitle: string;
  company: string | null;
  location: string | null;
  score: number;
  recommendation: "go" | "no-go" | "conditional" | null;
  strengths: string[];
  risks: string[];
  matchId: string;
  reasoning?: string | null;
  criteriaBreakdown?: CriterionResult[];
  enrichmentSuggestions?: string[];
  judgeVerdict?: JudgeVerdict | null;
  onViewDetails?: () => void;
}

const recommendationConfig = {
  go: {
    label: "Go",
    icon: <CheckCircle2 className="h-3 w-3" />,
    className:
      "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800",
  },
  "no-go": {
    label: "No-go",
    icon: <XCircle className="h-3 w-3" />,
    className:
      "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800",
  },
  conditional: {
    label: "Voorwaardelijk",
    icon: null,
    className:
      "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800",
  },
} as const;

const tierConfig = {
  knockout: { label: "Knockout", className: "text-red-600 dark:text-red-400" },
  gunning: { label: "Gunning", className: "text-blue-600 dark:text-blue-400" },
  process: { label: "Proces", className: "text-muted-foreground" },
} as const;

const confidenceConfig = {
  high: { label: "Hoog", className: "text-green-600" },
  medium: { label: "Gemiddeld", className: "text-amber-600" },
  low: { label: "Laag", className: "text-red-500" },
} as const;

function StarRating({ stars }: { stars: number }) {
  return (
    <span className="inline-flex gap-0.5">
      {Array.from({ length: 5 }, (_, i) => (
        <Star
          // biome-ignore lint/suspicious/noArrayIndexKey: Safe for static visual stars
          key={`star-${i}`}
          className={`h-3 w-3 ${i < stars ? "fill-amber-400 text-amber-400" : "text-muted-foreground/30"}`}
        />
      ))}
    </span>
  );
}

export function CvMatchCard({
  jobId,
  jobTitle,
  company,
  location,
  score,
  recommendation,
  strengths,
  risks,
  matchId,
  reasoning,
  criteriaBreakdown,
  enrichmentSuggestions,
  judgeVerdict,
  onViewDetails,
}: CvMatchCardProps) {
  const hasReasoning =
    reasoning || (criteriaBreakdown && criteriaBreakdown.length > 0) || judgeVerdict;
  return (
    <div className="rounded-xl border border-border bg-card p-5 space-y-4 shadow-sm">
      {/* Header: ScoreRing + recommendation badge + job info */}
      <div className="flex items-start gap-4">
        <ScoreRing score={score} size={64} strokeWidth={5} />

        <div className="min-w-0 flex-1">
          <div className="flex items-center gap-2 flex-wrap">
            {recommendation && (
              <Badge variant="outline" className={recommendationConfig[recommendation].className}>
                {recommendationConfig[recommendation].icon}
                {recommendationConfig[recommendation].label}
              </Badge>
            )}
          </div>

          <h3 className="font-semibold text-sm mt-1 truncate">{jobTitle}</h3>

          <div className="flex items-center gap-3 text-xs text-muted-foreground mt-0.5">
            {company && (
              <span className="flex items-center gap-1">
                <Building2 className="h-3 w-3 shrink-0" />
                {company}
              </span>
            )}
            {location && (
              <span className="flex items-center gap-1">
                <MapPin className="h-3 w-3 shrink-0" />
                {location}
              </span>
            )}
          </div>
        </div>
      </div>

      {/* Strengths and risks columns */}
      {(strengths.length > 0 || risks.length > 0) && (
        <div className="grid grid-cols-2 gap-4">
          {/* Sterke punten */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Sterke punten</p>
            {strengths.slice(0, 3).map((s, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Strings are unique enough for this static list
                key={`s-${i}`}
                className="flex items-start gap-1.5 text-xs"
              >
                <CheckCircle2 className="h-3.5 w-3.5 text-green-600 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{s}</span>
              </div>
            ))}
            {strengths.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Geen data</p>
            )}
          </div>

          {/* Risico's */}
          <div className="space-y-1.5">
            <p className="text-xs font-medium text-muted-foreground">Risico&apos;s</p>
            {risks.slice(0, 3).map((r, i) => (
              <div
                // biome-ignore lint/suspicious/noArrayIndexKey: Strings are unique enough for this static list
                key={`r-${i}`}
                className="flex items-start gap-1.5 text-xs"
              >
                <XCircle className="h-3.5 w-3.5 text-red-500 shrink-0 mt-0.5" />
                <span className="line-clamp-2">{r}</span>
              </div>
            ))}
            {risks.length === 0 && (
              <p className="text-xs text-muted-foreground italic">Geen risico&apos;s</p>
            )}
          </div>
        </div>
      )}

      {/* Expandable reasoning & judge verdict (structured match + judge) */}
      {hasReasoning && (
        <details className="group">
          <summary className="flex items-center gap-1.5 cursor-pointer text-xs font-medium text-primary hover:text-primary/80 transition-colors list-none [&::-webkit-details-marker]:hidden">
            <ChevronDown className="h-3.5 w-3.5 transition-transform group-open:rotate-180" />
            Reasoning & oordeel
          </summary>

          <div className="mt-3 space-y-3">
            {/* AI Recommendation Reasoning */}
            {reasoning && (
              <div className="rounded-lg border border-border bg-muted/30 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1">AI Motivatie</p>
                <p className="text-xs leading-relaxed">{reasoning}</p>
              </div>
            )}

            {/* Criteria Breakdown + chart */}
            {criteriaBreakdown && criteriaBreakdown.length > 0 && (
              <div className="space-y-2">
                <p className="text-xs font-medium text-muted-foreground">Criteria Analyse</p>
                <CriteriaBreakdownChart criteria={criteriaBreakdown} className="mb-3" />
                {criteriaBreakdown.map((criterion) => (
                  <div
                    key={criterion.criterion}
                    className="rounded-lg border border-border p-2.5 space-y-1"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <span className="text-xs font-medium truncate flex-1">
                        {criterion.criterion}
                      </span>
                      <div className="flex items-center gap-2 shrink-0">
                        <span
                          className={`text-[10px] font-medium ${tierConfig[criterion.tier].className}`}
                        >
                          {tierConfig[criterion.tier].label}
                        </span>
                        {criterion.tier === "knockout" &&
                          criterion.passed !== null &&
                          (criterion.passed ? (
                            <ShieldCheck className="h-3.5 w-3.5 text-green-600" />
                          ) : (
                            <XCircle className="h-3.5 w-3.5 text-red-500" />
                          ))}
                        {criterion.tier === "gunning" && criterion.stars !== null && (
                          <StarRating stars={criterion.stars} />
                        )}
                      </div>
                    </div>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {criterion.evidence}
                    </p>
                    <div className="flex items-center gap-1">
                      <span
                        className={`text-[10px] ${confidenceConfig[criterion.confidence].className}`}
                      >
                        Zekerheid: {confidenceConfig[criterion.confidence].label}
                      </span>
                    </div>
                  </div>
                ))}
              </div>
            )}

            {/* Enrichment Suggestions */}
            {enrichmentSuggestions && enrichmentSuggestions.length > 0 && (
              <div className="rounded-lg border border-border bg-amber-50/50 dark:bg-amber-900/10 p-3">
                <p className="text-xs font-medium text-muted-foreground mb-1.5 flex items-center gap-1">
                  <Lightbulb className="h-3 w-3 text-amber-500" />
                  Verrijkingssuggesties
                </p>
                <ul className="space-y-1">
                  {enrichmentSuggestions.map((s) => (
                    <li key={s} className="text-xs text-muted-foreground leading-relaxed">
                      &bull; {s}
                    </li>
                  ))}
                </ul>
              </div>
            )}

            {/* Judge Verdict */}
            {judgeVerdict && (
              <div className="rounded-lg border border-purple-200 dark:border-purple-800 bg-purple-50/50 dark:bg-purple-900/10 p-3 space-y-2">
                <div className="flex items-center justify-between">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <ShieldCheck className="h-3 w-3 text-purple-500" />
                    Onafhankelijk Oordeel (Grok Judge)
                  </p>
                  <Badge
                    variant="outline"
                    className={
                      judgeVerdict.agreement === "agree"
                        ? "bg-green-100 text-green-800 border-green-200 dark:bg-green-900/30 dark:text-green-300 dark:border-green-800"
                        : judgeVerdict.agreement === "disagree"
                          ? "bg-red-100 text-red-800 border-red-200 dark:bg-red-900/30 dark:text-red-300 dark:border-red-800"
                          : "bg-amber-100 text-amber-800 border-amber-200 dark:bg-amber-900/30 dark:text-amber-300 dark:border-amber-800"
                    }
                  >
                    {judgeVerdict.agreement === "agree"
                      ? "Eens"
                      : judgeVerdict.agreement === "disagree"
                        ? "Oneens"
                        : "Gedeeltelijk"}
                  </Badge>
                </div>

                <div className="flex items-center gap-4 text-xs">
                  <span>
                    Score: <strong>{judgeVerdict.adjustedScore}</strong>/100
                  </span>
                  <span>
                    Aanbeveling:{" "}
                    <strong>
                      {judgeVerdict.adjustedRecommendation === "go"
                        ? "Go"
                        : judgeVerdict.adjustedRecommendation === "no-go"
                          ? "No-go"
                          : "Voorwaardelijk"}
                    </strong>
                  </span>
                  <span className="text-muted-foreground">
                    Zekerheid: {judgeVerdict.confidence}%
                  </span>
                </div>

                <p className="text-xs leading-relaxed">{judgeVerdict.reasoning}</p>

                {judgeVerdict.redFlags.length > 0 && (
                  <div className="pt-1 space-y-1">
                    <p className="text-[10px] font-medium text-red-600 dark:text-red-400 uppercase tracking-wider">
                      Rode vlaggen
                    </p>
                    {judgeVerdict.redFlags.map((flag) => (
                      <div key={flag} className="flex items-start gap-1.5 text-xs">
                        <XCircle className="h-3 w-3 text-red-500 shrink-0 mt-0.5" />
                        <span className="text-muted-foreground">{flag}</span>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            )}
          </div>
        </details>
      )}

      {/* Actions row */}
      <div className="flex items-center justify-between gap-3 pt-1 border-t border-border">
        <MatchActions matchId={matchId} />

        <Link
          href={`/opdrachten/${jobId}`}
          onClick={onViewDetails}
          className="inline-flex items-center gap-1 text-xs text-primary hover:underline shrink-0"
        >
          Bekijk vacature
          <ExternalLink className="h-3 w-3" />
        </Link>
      </div>
    </div>
  );
}
