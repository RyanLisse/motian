import { ArrowRight, CheckCircle2, FileSearch, Layers3, Sparkles, UserRoundSearch } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { CandidateIntakeScorecard as CandidateIntakeScorecardData } from "@/src/services/recruiter-insights";

const toneStyles = {
  goed: "border-primary/20 bg-primary/10 text-primary",
  "let-op": "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  actie: "border-red-500/20 bg-red-500/10 text-red-500",
} as const;

const nextActionIcon = {
  verrijk: FileSearch,
  bel: UserRoundSearch,
  afwijzen: Layers3,
  "auto-match": Sparkles,
} as const;

type Props = {
  scorecard: CandidateIntakeScorecardData;
};

export function CandidateIntakeScorecard({ scorecard }: Props) {
  const NextActionIcon = nextActionIcon[scorecard.nextAction.key];

  return (
    <section className="mb-8">
      <div className="rounded-2xl border border-primary/20 bg-primary/5 p-5 space-y-4">
        <div className="flex items-start justify-between gap-4 flex-wrap">
          <div className="space-y-2">
            <div className="inline-flex items-center gap-2 rounded-full bg-primary/10 px-3 py-1 text-xs font-semibold text-primary">
              <CheckCircle2 className="h-3.5 w-3.5" />
              Kandidaat intake scorecard
            </div>
            <p className="text-sm text-muted-foreground">{scorecard.summary}</p>
          </div>
          <div className="text-right">
            <p className="text-xs text-muted-foreground">Profielsterkte</p>
            <p className="text-2xl font-semibold text-foreground">{scorecard.completenessScore}%</p>
            <p className="text-xs text-muted-foreground">{scorecard.completenessLabel}</p>
          </div>
        </div>

        <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
          {scorecard.completenessItems.map((item) => (
            <div key={item.label} className="rounded-xl border border-border bg-background/70 p-3">
              <div className="flex items-center justify-between gap-2">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <Badge variant="outline" className={toneStyles[item.tone]}>
                  {item.value}
                </Badge>
              </div>
            </div>
          ))}
        </div>

        <div className="grid gap-3 md:grid-cols-3">
          {[scorecard.parsedSkillsQuality, scorecard.escoCoverage, scorecard.likelySeniority].map(
            (item) => (
              <div key={item.label} className="rounded-xl border border-border bg-background/70 p-3">
                <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
                  {item.label}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  <Badge variant="outline" className={toneStyles[item.tone]}>
                    {item.value}
                  </Badge>
                </div>
              </div>
            ),
          )}
        </div>

        <div className="rounded-xl border border-border bg-background/80 p-4 flex items-start gap-3">
          <div className="rounded-full bg-primary/10 p-2 text-primary shrink-0">
            <NextActionIcon className="h-4 w-4" />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium uppercase tracking-wide text-muted-foreground">
              Aanbevolen volgende stap
            </p>
            <div className="mt-1 flex items-center gap-2 flex-wrap">
              <p className="text-sm font-semibold text-foreground">{scorecard.nextAction.label}</p>
              <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
            </div>
            <p className="mt-1 text-sm text-muted-foreground">{scorecard.nextAction.reason}</p>
          </div>
        </div>
      </div>
    </section>
  );
}
