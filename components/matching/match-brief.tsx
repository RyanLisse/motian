import { AlertTriangle, CheckCircle2, Sparkles, XCircle } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { MatchBrief as MatchBriefData } from "@/src/services/recruiter-insights";

const recommendationStyles = {
  Go: "border-primary/20 bg-primary/10 text-primary",
  Twijfel: "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  "No-go": "border-red-500/20 bg-red-500/10 text-red-500",
} as const;

type Props = {
  brief: MatchBriefData;
};

export function RecruiterMatchBrief({ brief }: Props) {
  return (
    <div className="rounded-xl border border-primary/15 bg-primary/5 p-4 space-y-4">
      <div className="flex items-start justify-between gap-3 flex-wrap">
        <div className="space-y-1">
          <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-[11px] font-semibold text-primary">
            <Sparkles className="h-3.5 w-3.5" />
            Match brief
          </div>
          <p className="text-sm text-foreground">{brief.summary}</p>
        </div>
        <Badge
          variant="outline"
          className={recommendationStyles[brief.recommendation.label]}
        >
          {brief.recommendation.label}
          {brief.recommendation.confidence != null
            ? ` · ${Math.round(brief.recommendation.confidence)}%`
            : ""}
        </Badge>
      </div>

      {brief.whyThisMatchExists.length > 0 ? (
        <div>
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Waarom deze match bestaat
          </p>
          <ul className="space-y-1">
            {brief.whyThisMatchExists.map((reason) => (
              <li key={reason} className="flex items-start gap-2 text-sm text-muted-foreground">
                <span className="mt-1 h-1.5 w-1.5 rounded-full bg-primary shrink-0" />
                <span>{reason}</span>
              </li>
            ))}
          </ul>
        </div>
      ) : null}

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background/80 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Must-haves gehaald
          </p>
          {brief.mustHavesMet.length > 0 ? (
            <div className="space-y-1.5">
              {brief.mustHavesMet.map((criterion) => (
                <div key={criterion} className="flex items-start gap-2 text-sm text-foreground">
                  <CheckCircle2 className="mt-0.5 h-4 w-4 text-primary shrink-0" />
                  <span>{criterion}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Nog geen bevestigde must-haves.</p>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background/80 p-3">
          <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Must-haves gemist
          </p>
          {brief.mustHavesMissing.length > 0 ? (
            <div className="space-y-1.5">
              {brief.mustHavesMissing.map((criterion) => (
                <div key={criterion} className="flex items-start gap-2 text-sm text-foreground">
                  <XCircle className="mt-0.5 h-4 w-4 text-red-500 shrink-0" />
                  <span>{criterion}</span>
                </div>
              ))}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">Geen expliciete knock-out gaten gevonden.</p>
          )}
        </div>
      </div>

      <div className="grid gap-3 md:grid-cols-2">
        <div className="rounded-lg border border-border bg-background/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            ESCO overlap
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {brief.escoOverlap.sharedCount} gedeeld
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {brief.escoOverlap.sharedLabels.length > 0
              ? brief.escoOverlap.sharedLabels.join(", ")
              : "Nog geen canonieke overlap gevonden."}
          </p>
        </div>

        <div className="rounded-lg border border-border bg-background/80 p-3">
          <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
            Rauwe skill overlap
          </p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {brief.rawSkillOverlap.sharedCount} direct gedeeld
          </p>
          <p className="mt-1 text-sm text-muted-foreground">
            {brief.rawSkillOverlap.sharedSkills.length > 0
              ? brief.rawSkillOverlap.sharedSkills.join(", ")
              : "Geen directe skill-overlap gevonden."}
          </p>
        </div>
      </div>

      <div className="rounded-lg border border-border bg-background/80 p-3">
        <p className="mb-2 text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Commerciële blockers
        </p>
        {brief.commercialBlockers.length > 0 ? (
          <div className="space-y-1.5">
            {brief.commercialBlockers.map((blocker) => (
              <div key={blocker} className="flex items-start gap-2 text-sm text-foreground">
                <AlertTriangle className="mt-0.5 h-4 w-4 text-yellow-500 shrink-0" />
                <span>{blocker}</span>
              </div>
            ))}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">Geen directe commerciële blockers gedetecteerd.</p>
        )}
      </div>

      <div className="rounded-lg border border-border bg-card p-3">
        <p className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
          Eindadvies
        </p>
        <p className="mt-1 text-sm text-foreground">{brief.recommendation.reason}</p>
      </div>
    </div>
  );
}
