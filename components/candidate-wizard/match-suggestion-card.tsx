"use client";

import { Building2, MapPin, Sparkles } from "lucide-react";
import { ScoreRing } from "@/components/score-ring";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import type { MatchSuggestionItem } from "./types";

interface MatchSuggestionCardProps {
  match: MatchSuggestionItem;
  selected: boolean;
  onToggle: (checked: boolean) => void;
  showCheckbox?: boolean;
}

const recommendationLabels = {
  go: "Aanbevolen",
  conditional: "Voorwaardelijk",
  "no-go": "Geen fit",
} as const;

export function MatchSuggestionCard({
  match,
  selected,
  onToggle,
  showCheckbox = true,
}: MatchSuggestionCardProps) {
  const isLinked = match.isLinked ?? false;

  return (
    <div
      className={cn(
        "border rounded-xl p-4 flex items-start gap-3 transition-colors",
        isLinked ? "opacity-70 bg-muted/30 border-muted" : "bg-card border-border",
        selected && !isLinked && "border-primary/50 bg-primary/5",
        match.isRecommended && !isLinked && "ring-1 ring-primary/20",
      )}
    >
      {showCheckbox ? (
        <div className="pt-0.5">
          <input
            type="checkbox"
            checked={selected}
            onChange={(e) => onToggle(e.target.checked)}
            disabled={isLinked}
            aria-label={match.jobTitle}
            className={cn(
              "h-4 w-4 rounded border-border bg-background text-primary focus-visible:ring-2 focus-visible:ring-ring disabled:opacity-50",
            )}
          />
        </div>
      ) : null}
      <div className="flex-1 min-w-0">
        <div className="flex items-start justify-between gap-2">
          <div>
            <div className="flex flex-wrap items-center gap-1.5 mb-1.5">
              {match.isRecommended ? (
                <Badge variant="outline" className="border-primary/20 bg-primary/10 text-primary">
                  <Sparkles className="h-3 w-3" />
                  {match.recommendationSource === "score"
                    ? "Beste score"
                    : recommendationLabels[match.recommendation ?? "go"]}
                </Badge>
              ) : null}
              {match.recommendation && match.recommendation !== "go" ? (
                <Badge variant="outline" className="text-muted-foreground">
                  {recommendationLabels[match.recommendation]}
                </Badge>
              ) : null}
            </div>
            <h4 className="font-medium text-foreground truncate">{match.jobTitle}</h4>
            {match.company && (
              <p className="text-sm text-muted-foreground flex items-center gap-1 mt-0.5">
                <Building2 className="h-3.5 w-3.5 shrink-0" />
                {match.company}
              </p>
            )}
            {match.location && (
              <p className="text-xs text-muted-foreground flex items-center gap-1 mt-0.5">
                <MapPin className="h-3 w-3 shrink-0" />
                {match.location}
              </p>
            )}
          </div>
          <ScoreRing score={match.quickScore} size={44} strokeWidth={3} />
        </div>
        {match.reasoning && (
          <p className="text-xs text-muted-foreground mt-2 line-clamp-2">{match.reasoning}</p>
        )}
        {typeof match.recommendationConfidence === "number" ? (
          <p className="mt-2 text-[11px] text-muted-foreground">
            Aanbevelingszekerheid: {Math.round(match.recommendationConfidence)}%
          </p>
        ) : null}
        {isLinked && (
          <Badge variant="secondary" className="mt-2 text-xs">
            Al gekoppeld
          </Badge>
        )}
      </div>
    </div>
  );
}
