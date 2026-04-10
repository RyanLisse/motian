"use client";

import { ChevronDown, ClipboardList, ShieldCheck, Sparkles } from "lucide-react";
import { memo } from "react";
import {
  genuiDisclosureSummaryClassName,
  getToolErrorMessage,
  isToolError,
  useGenUIMobile,
} from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

type ClarificationOutput = {
  status: "needs_clarification";
  missingInformation: string[];
  recommendedQuestions: string[];
  nextStep: string;
};

type ScorecardCriterion = {
  criterion: string;
  whatGoodLooksLike: string;
  redFlag: string;
};

type ReadyOutput = {
  status: "ready";
  artifact: {
    prepSummary: {
      interviewType: string;
      interviewGoal: string;
      recommendedDuration: string;
      contextSummary: string;
    };
    openingPrompt: string;
    mustAskQuestions: string[];
    scorecardCriteria: ScorecardCriterion[];
    evidenceToCapture: string[];
    recruiterNotes: string[];
    humanGuardrails: string[];
    writebackPayload: {
      type: "interview_prep_template";
      interviewType: string;
      linkedJobId: string | null;
      linkedCandidateId: string | null;
      linkedMatchId: string | null;
      mustAskQuestions: string[];
      evidenceToCapture: string[];
    };
  };
};

function isRecord(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null;
}

function isClarificationOutput(value: unknown): value is ClarificationOutput {
  return (
    isRecord(value) &&
    value.status === "needs_clarification" &&
    Array.isArray(value.recommendedQuestions)
  );
}

function isReadyOutput(value: unknown): value is ReadyOutput {
  return (
    isRecord(value) &&
    value.status === "ready" &&
    isRecord(value.artifact) &&
    isRecord(value.artifact.prepSummary)
  );
}

function BulletList({ items }: { items: string[] }) {
  return (
    <ul className="space-y-1 text-sm text-foreground">
      {items.map((item) => (
        <li key={item}>• {item}</li>
      ))}
    </ul>
  );
}

export const InterviewPrepCard = memo(function InterviewPrepCard({ output }: { output: unknown }) {
  const isMobile = useGenUIMobile();

  if (isToolError(output)) {
    return (
      <ToolErrorBlock
        message={getToolErrorMessage(output, "Interviewvoorbereiding niet beschikbaar")}
      />
    );
  }

  if (isClarificationOutput(output)) {
    return (
      <div className="my-1.5 rounded-lg border border-amber-500/30 bg-amber-500/5 p-4">
        <div className="flex items-center gap-2">
          <ClipboardList className="h-4 w-4 text-amber-600" />
          <p className="text-sm font-semibold text-foreground">Eerst verduidelijken</p>
        </div>
        <p className="mt-2 text-sm leading-6 text-muted-foreground">
          Er ontbreekt nog context voordat Motian een bruikbare interviewvoorbereiding kan maken.
        </p>
        <div className="mt-4 rounded-md border border-border/70 bg-background/70 p-3">
          <p className="text-sm font-semibold text-foreground">Nog nodig</p>
          <BulletList items={output.missingInformation} />
        </div>
        <div className="mt-4 rounded-md border border-border/70 bg-background/70 p-3">
          <p className="text-sm font-semibold text-foreground">Aanbevolen vragen</p>
          <ol className="mt-2 space-y-2 text-sm text-foreground">
            {output.recommendedQuestions.map((question, index) => (
              <li key={question}>
                <span className="mr-2 text-muted-foreground">{index + 1}.</span>
                {question}
              </li>
            ))}
          </ol>
        </div>
        <p className="mt-3 text-xs text-muted-foreground">{output.nextStep}</p>
      </div>
    );
  }

  if (!isReadyOutput(output)) return null;

  const { artifact } = output;
  const scorecardContent = (
    <div className="mt-2 space-y-2">
      {artifact.scorecardCriteria.map((criterion) => (
        <div
          key={criterion.criterion}
          className="rounded-md border border-border/70 bg-muted/30 p-3"
        >
          <p className="text-sm font-medium text-foreground">{criterion.criterion}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Goed signaal: {criterion.whatGoodLooksLike}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">Red flag: {criterion.redFlag}</p>
        </div>
      ))}
    </div>
  );

  return (
    <div className="my-1.5 rounded-lg border border-border bg-card p-4">
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="flex items-center gap-2">
            <Sparkles className="h-4 w-4 text-primary" />
            <p className="text-sm font-semibold text-foreground">
              Interviewprep: {artifact.prepSummary.interviewType}
            </p>
          </div>
          <p className="mt-2 text-sm leading-6 text-muted-foreground">
            {artifact.prepSummary.contextSummary}
          </p>
        </div>
        <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-400">
          Recruiter-ready
        </span>
      </div>

      <div className="mt-4 grid gap-2 sm:grid-cols-2">
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Doel</p>
          <p className="mt-1 text-sm text-foreground">{artifact.prepSummary.interviewGoal}</p>
        </div>
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="text-[11px] uppercase tracking-wide text-muted-foreground">Duur</p>
          <p className="mt-1 text-sm text-foreground">{artifact.prepSummary.recommendedDuration}</p>
        </div>
      </div>

      <div className="mt-4 rounded-md border border-border/70 bg-background/70 p-3">
        <p className="text-sm font-semibold text-foreground">Opening voor de recruiter</p>
        <p className="mt-2 text-sm leading-6 text-foreground">{artifact.openingPrompt}</p>
      </div>

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="text-sm font-semibold text-foreground">Must-ask vragen</p>
          <div className="mt-2">
            <BulletList items={artifact.mustAskQuestions} />
          </div>
        </div>
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <div className="flex items-center gap-2">
            <ShieldCheck className="h-4 w-4 text-blue-600" />
            <p className="text-sm font-semibold text-foreground">Human guardrails</p>
          </div>
          <div className="mt-2">
            <BulletList items={artifact.humanGuardrails} />
          </div>
        </div>
      </div>

      {isMobile ? (
        <details className="mt-4 rounded-md border border-border/70 bg-background/70">
          <summary className={genuiDisclosureSummaryClassName}>
            <span>Scorecardcriteria</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </summary>
          <div className="border-t border-border/70 p-3">{scorecardContent}</div>
        </details>
      ) : (
        <div className="mt-4 rounded-md border border-border/70 bg-background/70 p-3">
          <p className="text-sm font-semibold text-foreground">Scorecardcriteria</p>
          {scorecardContent}
        </div>
      )}

      <div className="mt-4 grid gap-4 lg:grid-cols-2">
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="text-sm font-semibold text-foreground">Evidence vastleggen</p>
          <div className="mt-2">
            <BulletList items={artifact.evidenceToCapture} />
          </div>
        </div>
        <div className="rounded-md border border-border/70 bg-background/70 p-3">
          <p className="text-sm font-semibold text-foreground">Recruiter notes</p>
          <div className="mt-2">
            <BulletList items={artifact.recruiterNotes} />
          </div>
        </div>
      </div>

      {isMobile ? (
        <details className="mt-4 rounded-md border border-border/70 bg-background/70">
          <summary className={genuiDisclosureSummaryClassName}>
            <span>Writeback payload</span>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </summary>
          <div className="space-y-1 border-t border-border/70 p-3">
            <p className="text-xs text-muted-foreground">Type: {artifact.writebackPayload.type}</p>
            <p className="text-xs text-muted-foreground">
              Job: {artifact.writebackPayload.linkedJobId ?? "geen"} · Kandidaat:{" "}
              {artifact.writebackPayload.linkedCandidateId ?? "geen"} · Match:{" "}
              {artifact.writebackPayload.linkedMatchId ?? "geen"}
            </p>
          </div>
        </details>
      ) : (
        <div className="mt-4 rounded-md border border-border/70 bg-background/70 p-3">
          <p className="text-sm font-semibold text-foreground">Writeback payload</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Type: {artifact.writebackPayload.type}
          </p>
          <p className="text-xs text-muted-foreground">
            Job: {artifact.writebackPayload.linkedJobId ?? "geen"} · Kandidaat:{" "}
            {artifact.writebackPayload.linkedCandidateId ?? "geen"} · Match:{" "}
            {artifact.writebackPayload.linkedMatchId ?? "geen"}
          </p>
        </div>
      )}
    </div>
  );
});
