"use client";

import { Target, User } from "lucide-react";
import Link from "next/link";
import { getToolErrorMessage, isToolError } from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

type CvIntakeOutput = {
  candidateId: string;
  candidateName: string;
  candidateRole: string | null;
  topSkills: string[];
  matches: Array<{
    jobId: string;
    jobTitle: string;
    company: string | null;
    quickScore: number;
    recommendation: "go" | "no-go" | "conditional" | null;
    reasoning: string | null;
  }>;
  candidateUrl: string;
};

function isCvIntakeOutput(o: unknown): o is CvIntakeOutput {
  return (
    typeof o === "object" &&
    o !== null &&
    "candidateId" in o &&
    "candidateName" in o &&
    "matches" in o &&
    Array.isArray((o as CvIntakeOutput).matches)
  );
}

function scoreColor(score: number): string {
  if (score >= 80) return "text-emerald-600";
  if (score >= 60) return "text-amber-600";
  return "text-red-500";
}

const recommendationConfig: Record<string, { label: string; icon: string; classes: string }> = {
  go: {
    label: "Geschikt",
    icon: "\u2705",
    classes: "bg-emerald-100 text-emerald-800 dark:bg-emerald-900/30 dark:text-emerald-400",
  },
  "no-go": {
    label: "Niet geschikt",
    icon: "\u274C",
    classes: "bg-red-100 text-red-800 dark:bg-red-900/30 dark:text-red-400",
  },
  conditional: {
    label: "Voorwaardelijk",
    icon: "\u26A0\uFE0F",
    classes: "bg-amber-100 text-amber-800 dark:bg-amber-900/30 dark:text-amber-400",
  },
};

export function CvIntakeCard({ output }: { output: unknown }) {
  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "CV intake mislukt")} />;
  if (!isCvIntakeOutput(output)) return null;

  return (
    <Link href={`/kandidaten/${output.candidateId}`}>
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent cursor-pointer space-y-3">
        {/* Header */}
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{output.candidateName}</p>
            {output.candidateRole && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">
                {output.candidateRole}
              </p>
            )}
          </div>
        </div>

        {/* Skills badges */}
        {output.topSkills.length > 0 && (
          <div className="flex flex-wrap gap-1">
            {output.topSkills.map((skill) => (
              <span
                key={skill}
                className="inline-flex items-center rounded-full bg-muted px-2 py-0.5 text-[10px] font-medium text-muted-foreground"
              >
                {skill}
              </span>
            ))}
          </div>
        )}

        {/* Match list */}
        {output.matches.length > 0 && (
          <div className="space-y-1.5">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Target className="h-3.5 w-3.5" />
              <span>
                {output.matches.length} vacature{output.matches.length !== 1 ? "s" : ""} gematcht
              </span>
            </div>
            {output.matches.map((match) => {
              const rec = match.recommendation ? recommendationConfig[match.recommendation] : null;
              return (
                <div
                  key={match.jobId}
                  className="rounded-md border border-border bg-background p-2.5"
                >
                  <div className="flex items-center gap-2.5">
                    <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full border-2 border-current">
                      <span className={`text-xs font-bold ${scoreColor(match.quickScore)}`}>
                        {Math.round(match.quickScore)}
                      </span>
                    </div>
                    <div className="min-w-0 flex-1">
                      <p className="text-xs font-medium text-foreground truncate">
                        {match.jobTitle}
                      </p>
                      {match.company && (
                        <p className="text-[10px] text-muted-foreground truncate">
                          {match.company}
                        </p>
                      )}
                      <div className="flex items-center gap-2 mt-0.5">
                        {rec && (
                          <span
                            className={`inline-flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[10px] font-medium ${rec.classes}`}
                          >
                            {rec.icon} {rec.label}
                          </span>
                        )}
                      </div>
                      {match.reasoning && (
                        <p className="text-[10px] text-muted-foreground mt-0.5 line-clamp-1">
                          {match.reasoning}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        )}
      </div>
    </Link>
  );
}
