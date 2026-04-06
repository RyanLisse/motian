import { AlertTriangle, Briefcase, CheckCircle2, Gauge, Target } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import type { VacatureTriageScorecard as VacatureTriageScorecardModel } from "@/src/services/recruiter-insights";

const toneClasses = {
  goed: "border-primary/20 bg-primary/10 text-primary",
  "let-op": "border-yellow-500/20 bg-yellow-500/10 text-yellow-600 dark:text-yellow-400",
  actie: "border-red-500/20 bg-red-500/10 text-red-600 dark:text-red-400",
} as const;

export function VacatureTriageScorecard({
  scorecard,
}: {
  scorecard: VacatureTriageScorecardModel;
}) {
  return (
    <section className="rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Target className="h-4 w-4 text-primary" />
            <h2 className="text-sm font-semibold text-foreground">Vacature triage</h2>
          </div>
          <p className="mt-1 text-sm text-muted-foreground">{scorecard.summary}</p>
        </div>
        <Badge variant="outline" className={toneClasses[scorecard.readiness.tone]}>
          {scorecard.readiness.value}
        </Badge>
      </div>

      <div className="mt-4 grid gap-3 md:grid-cols-2 xl:grid-cols-4">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Must-haves</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{scorecard.mustHaveCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">Nice-to-haves</p>
          <p className="mt-1 text-lg font-semibold text-foreground">{scorecard.niceToHaveCount}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">{scorecard.seniority.label}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">{scorecard.seniority.value}</p>
        </div>
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <p className="text-xs text-muted-foreground">{scorecard.sourcingDifficulty.label}</p>
          <p className="mt-1 text-sm font-semibold text-foreground">
            {scorecard.sourcingDifficulty.value}
          </p>
        </div>
      </div>

      <div className="mt-4 grid gap-3 lg:grid-cols-[1.2fr_1fr]">
        <div className="rounded-lg border border-border bg-background/60 p-3">
          <div className="flex items-center gap-2">
            <Briefcase className="h-4 w-4 text-muted-foreground" />
            <h3 className="text-sm font-medium text-foreground">Werkafspraken</h3>
          </div>
          {scorecard.workConstraints.length === 0 ? (
            <p className="mt-2 text-sm text-muted-foreground">
              Nog geen harde contract- of werkvormafspraken gevonden.
            </p>
          ) : (
            <ul className="mt-2 space-y-1">
              {scorecard.workConstraints.map((constraint) => (
                <li key={constraint} className="text-sm text-muted-foreground">
                  {constraint}
                </li>
              ))}
            </ul>
          )}
        </div>

        <div className="rounded-lg border border-border bg-background/60 p-3">
          <div className="flex items-center gap-2">
            {scorecard.readiness.tone === "goed" ? (
              <CheckCircle2 className="h-4 w-4 text-primary" />
            ) : scorecard.readiness.tone === "let-op" ? (
              <Gauge className="h-4 w-4 text-yellow-600 dark:text-yellow-400" />
            ) : (
              <AlertTriangle className="h-4 w-4 text-red-600 dark:text-red-400" />
            )}
            <h3 className="text-sm font-medium text-foreground">Matching readiness</h3>
          </div>
          <p className="mt-2 text-sm text-muted-foreground">
            {scorecard.readiness.value}. Let extra op {scorecard.sourcingDifficulty.value.toLowerCase()} sourcingdruk
            voordat je recruiters blind op de ranking laat vertrouwen.
          </p>
        </div>
      </div>
    </section>
  );
}
