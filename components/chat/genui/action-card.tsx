"use client";
import { ArrowRight, Calendar, Check, CheckCircle2, Mail, X, XCircle } from "lucide-react";
import { memo } from "react";
import { ActionButton, StatusOverlay, useAction } from "./action-primitives";
import { getToolErrorMessage, isToolError, stageLabels } from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

/* ── Match Created Card ── */
type MatchCreatedOutput = {
  id: string;
  jobId?: string | null;
  candidateId?: string | null;
  matchScore: number;
  status: string;
};

function isMatchCreated(o: unknown): o is MatchCreatedOutput {
  return typeof o === "object" && o !== null && "id" in o && "matchScore" in o;
}

export const MatchCreatedCard = memo(function MatchCreatedCard({ output }: { output: unknown }) {
  const approve = useAction();
  const reject = useAction();

  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Match niet aangemaakt")} />;
  if (!isMatchCreated(output)) return null;

  const actionTaken = approve.state !== "idle" || reject.state !== "idle";

  return (
    <div className="relative my-1.5 rounded-lg border border-border bg-card p-4">
      <StatusOverlay
        state={approve.state === "idle" ? reject.state : approve.state}
        errorMsg={approve.errorMsg || reject.errorMsg}
      />
      <div className="flex items-center justify-between gap-2 mb-2">
        <p className="text-sm font-semibold text-foreground">
          Match aangemaakt — {Math.round(output.matchScore)}%
        </p>
        <span className="text-xs text-muted-foreground capitalize">{output.status}</span>
      </div>
      {!actionTaken && output.status === "pending" && (
        <div className="flex items-center gap-2 mt-3">
          <ActionButton
            label="Goedkeuren"
            variant="primary"
            icon={Check}
            onClick={() =>
              approve.execute(`/api/matches/${output.id}`, "PATCH", { status: "approved" })
            }
          />
          <ActionButton
            label="Afwijzen"
            variant="destructive"
            icon={X}
            onClick={() =>
              reject.execute(`/api/matches/${output.id}`, "PATCH", { status: "rejected" })
            }
          />
        </div>
      )}
    </div>
  );
});

/* ── Match Approved Card ── */
export const MatchApprovedCard = memo(function MatchApprovedCard({ output }: { output: unknown }) {
  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Match niet goedgekeurd")} />;
  return (
    <div className="my-1.5 rounded-lg border border-emerald-500/30 bg-emerald-500/5 p-4">
      <div className="flex items-center gap-2">
        <CheckCircle2 className="h-4 w-4 text-emerald-600" />
        <p className="text-sm font-semibold text-foreground">Match goedgekeurd</p>
      </div>
    </div>
  );
});

/* ── Match Rejected Card ── */
export const MatchRejectedCard = memo(function MatchRejectedCard({ output }: { output: unknown }) {
  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Match niet afgewezen")} />;
  return (
    <div className="my-1.5 rounded-lg border border-red-500/30 bg-red-500/5 p-4">
      <div className="flex items-center gap-2">
        <XCircle className="h-4 w-4 text-red-500" />
        <p className="text-sm font-semibold text-foreground">Match afgewezen</p>
      </div>
    </div>
  );
});

/* ── Stage Update Card ── */
function isStageUpdate(o: unknown): o is { stage: string; previousStage?: string } {
  return (
    typeof o === "object" &&
    o !== null &&
    "stage" in o &&
    typeof (o as { stage: unknown }).stage === "string"
  );
}

export const StageUpdateCard = memo(function StageUpdateCard({ output }: { output: unknown }) {
  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Fase niet bijgewerkt")} />;
  if (!isStageUpdate(output)) return null;
  const o = output;
  return (
    <div className="my-1.5 rounded-lg border border-border bg-card p-4">
      <div className="flex items-center gap-2">
        <ArrowRight className="h-4 w-4 text-primary" />
        <p className="text-sm font-semibold text-foreground">
          Fase bijgewerkt
          {o.previousStage ? `: ${stageLabels[o.previousStage] ?? o.previousStage}` : ""} →{" "}
          {stageLabels[o.stage] ?? o.stage}
        </p>
      </div>
    </div>
  );
});

/* ── Interview Planned Card ── */
function isInterviewPlanned(o: unknown): o is { id?: string; scheduledAt?: string; type?: string } {
  return typeof o === "object" && o !== null;
}

export const InterviewPlannedCard = memo(function InterviewPlannedCard({
  output,
}: {
  output: unknown;
}) {
  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Interview niet gepland")} />;
  if (!isInterviewPlanned(output)) return null;
  const o = output;
  const dateStr = o.scheduledAt
    ? new Date(o.scheduledAt).toLocaleDateString("nl-NL", {
        weekday: "long",
        day: "numeric",
        month: "long",
        hour: "2-digit",
        minute: "2-digit",
      })
    : null;
  return (
    <div className="my-1.5 rounded-lg border border-purple-500/30 bg-purple-500/5 p-4">
      <div className="flex items-center gap-2">
        <Calendar className="h-4 w-4 text-purple-600" />
        <p className="text-sm font-semibold text-foreground">Interview gepland</p>
      </div>
      {dateStr && <p className="text-xs text-muted-foreground mt-1">{dateStr}</p>}
      {o.type && <p className="text-xs text-muted-foreground capitalize">{o.type}</p>}
    </div>
  );
});

/* ── Message Sent Card ── */
function isMessageSent(o: unknown): o is { subject?: string; channel?: string } {
  return typeof o === "object" && o !== null;
}

export const MessageSentCard = memo(function MessageSentCard({ output }: { output: unknown }) {
  if (isToolError(output))
    return <ToolErrorBlock message={getToolErrorMessage(output, "Bericht niet verstuurd")} />;
  const o = isMessageSent(output) ? output : null;
  return (
    <div className="my-1.5 rounded-lg border border-blue-500/30 bg-blue-500/5 p-4">
      <div className="flex items-center gap-2">
        <Mail className="h-4 w-4 text-blue-600" />
        <p className="text-sm font-semibold text-foreground">Bericht verstuurd</p>
      </div>
      {o?.subject && <p className="text-xs text-muted-foreground mt-1">{o.subject}</p>}
      {o?.channel && <p className="text-xs text-muted-foreground capitalize">{o.channel}</p>}
    </div>
  );
});
