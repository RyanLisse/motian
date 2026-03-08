"use client";

import { AlertTriangle, CheckCircle2, Lightbulb, ShieldAlert, Star, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CriterionResult } from "@/src/schemas/matching";

interface MatchDetailProps {
  criteriaBreakdown: CriterionResult[];
  overallScore: number;
  knockoutsPassed: boolean;
  riskProfile: string[];
  enrichmentSuggestions: string[];
  recommendation: string;
  recommendationReasoning: string;
  recommendationConfidence: number;
}

const recColors: Record<string, string> = {
  go: "bg-primary/10 text-primary border-primary/20",
  "no-go": "bg-red-500/10 text-red-500 border-red-500/20",
  conditional: "bg-yellow-500/10 text-yellow-500 border-yellow-500/20",
};

const recLabels: Record<string, string> = {
  go: "Doorgaan",
  "no-go": "Niet doorgaan",
  conditional: "Voorwaardelijk",
};

export function MatchDetail({
  criteriaBreakdown,
  overallScore,
  knockoutsPassed,
  riskProfile,
  enrichmentSuggestions,
  recommendation,
  recommendationReasoning,
  recommendationConfidence,
}: MatchDetailProps) {
  const knockouts = criteriaBreakdown.filter((c) => c.tier === "knockout");
  const gunning = criteriaBreakdown.filter((c) => c.tier === "gunning");
  const process = criteriaBreakdown.filter((c) => c.tier === "process");

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-3 flex-wrap">
        <Badge variant="outline" className={`text-xs ${recColors[recommendation] ?? ""}`}>
          {recLabels[recommendation] ?? recommendation}
        </Badge>
        <span className="text-sm font-medium text-foreground">{overallScore}/100</span>
        <span className="text-xs text-muted-foreground">{recommendationConfidence}% zekerheid</span>
      </div>

      {!knockoutsPassed && (
        <div className="flex items-center gap-2 bg-red-500/10 border border-red-500/20 rounded-lg px-3 py-2">
          <XCircle className="h-4 w-4 text-red-500 shrink-0" />
          <p className="text-xs text-red-500">Niet alle knock-out criteria zijn voldaan</p>
        </div>
      )}

      {knockouts.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
            Knock-out criteria
          </h4>
          <div className="space-y-2">
            {knockouts.map((k, i) => (
              <div
                key={`ko-${i}-${k.criterion.slice(0, 20)}`}
                className="flex items-start gap-2 bg-background border border-border rounded-lg px-3 py-2"
              >
                {k.passed ? (
                  <CheckCircle2 className="h-4 w-4 text-primary shrink-0 mt-0.5" />
                ) : (
                  <XCircle className="h-4 w-4 text-red-500 shrink-0 mt-0.5" />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground">{k.criterion}</p>
                  <p className="text-xs text-muted-foreground mt-0.5">{k.evidence}</p>
                </div>
                <Badge
                  variant="outline"
                  className={`text-[10px] shrink-0 ${
                    k.confidence === "high"
                      ? "border-primary/20 text-primary"
                      : k.confidence === "medium"
                        ? "border-yellow-500/20 text-yellow-500"
                        : "border-border text-muted-foreground"
                  }`}
                >
                  {k.confidence}
                </Badge>
              </div>
            ))}
          </div>
        </div>
      )}

      {gunning.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
            Gunningscriteria
          </h4>
          <div className="space-y-2">
            {gunning.map((g, i) => (
              <div
                key={`gun-${i}-${g.criterion.slice(0, 20)}`}
                className="bg-background border border-border rounded-lg px-3 py-2"
              >
                <div className="flex items-center justify-between mb-1">
                  <p className="text-sm text-foreground">{g.criterion}</p>
                  <div className="flex gap-0.5 shrink-0">
                    {[1, 2, 3, 4, 5].map((n) => (
                      <Star
                        key={`star-${n}`}
                        className={`h-3.5 w-3.5 ${
                          n <= (g.stars ?? 0)
                            ? (g.stars ?? 0) >= 4
                              ? "text-primary fill-primary"
                              : (g.stars ?? 0) >= 3
                                ? "text-yellow-500 fill-yellow-500"
                                : "text-red-500 fill-red-500"
                            : "text-muted-foreground/30"
                        }`}
                      />
                    ))}
                  </div>
                </div>
                <p className="text-xs text-muted-foreground">{g.evidence}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {process.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2">
            Proceseisen
          </h4>
          <div className="space-y-1">
            {process.map((p, i) => (
              <div
                key={`proc-${i}-${p.criterion.slice(0, 20)}`}
                className="flex items-start gap-2 text-xs text-muted-foreground"
              >
                <span className="text-muted-foreground/50">&#8226;</span>
                <span>
                  <span className="text-foreground">{p.criterion}:</span> {p.evidence}
                </span>
              </div>
            ))}
          </div>
        </div>
      )}

      {riskProfile.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <ShieldAlert className="h-3.5 w-3.5 text-yellow-500" />
            Risicoprofiel
          </h4>
          <div className="space-y-1">
            {riskProfile.map((risk) => (
              <div
                key={risk}
                className="flex items-start gap-2 bg-yellow-500/5 border border-yellow-500/10 rounded-lg px-3 py-1.5"
              >
                <AlertTriangle className="h-3.5 w-3.5 text-yellow-500 shrink-0 mt-0.5" />
                <p className="text-xs text-foreground">{risk}</p>
              </div>
            ))}
          </div>
        </div>
      )}

      {enrichmentSuggestions.length > 0 && (
        <div>
          <h4 className="text-xs font-semibold text-foreground uppercase tracking-wider mb-2 flex items-center gap-1.5">
            <Lightbulb className="h-3.5 w-3.5 text-primary" />
            Aanbevelingen
          </h4>
          <ol className="space-y-1 list-decimal list-inside">
            {enrichmentSuggestions.map((s) => (
              <li key={s} className="text-xs text-muted-foreground">
                {s}
              </li>
            ))}
          </ol>
        </div>
      )}

      <div className="bg-card border border-border rounded-lg px-3 py-2">
        <p className="text-xs text-muted-foreground italic">{recommendationReasoning}</p>
      </div>
    </div>
  );
}
