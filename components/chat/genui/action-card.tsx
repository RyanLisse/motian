"use client";
import { ArrowRight, Calendar, Check, CheckCircle2, Loader2, Mail, X, XCircle } from "lucide-react";
import { memo, useState } from "react";
import { ToolErrorBlock } from "./tool-error-block";

/* ── Shared action handler ── */
type ActionState = "idle" | "loading" | "success" | "error";

function useAction() {
  const [state, setState] = useState<ActionState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const execute = async (endpoint: string, method: string, body: Record<string, unknown>) => {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(body),
      });
      if (!res.ok) {
        const text = await res.text();
        throw new Error(text || `Fout ${res.status}`);
      }
      setState("success");
    } catch (err) {
      setState("error");
      setErrorMsg(err instanceof Error ? err.message : "Actie mislukt");
    }
  };

  return { state, errorMsg, execute };
}

function ActionButton({
  label,
  variant,
  icon: Icon,
  onClick,
  disabled,
}: {
  label: string;
  variant: "primary" | "destructive" | "outline";
  icon: typeof Check;
  onClick: () => void;
  disabled?: boolean;
}) {
  const base =
    "inline-flex items-center gap-1.5 rounded-md px-3 py-1.5 text-xs font-medium transition-colors";
  const variants = {
    primary: "bg-primary text-primary-foreground hover:bg-primary/90",
    destructive: "bg-destructive text-destructive-foreground hover:bg-destructive/90",
    outline: "border border-border text-foreground hover:bg-accent",
  };
  return (
    <button
      type="button"
      onClick={onClick}
      disabled={disabled}
      className={`${base} ${variants[variant]} disabled:opacity-50`}
    >
      <Icon className="h-3.5 w-3.5" />
      {label}
    </button>
  );
}

function StatusOverlay({ state, errorMsg }: { state: ActionState; errorMsg: string }) {
  if (state === "loading") {
    return (
      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-card/80">
        <Loader2 className="h-5 w-5 animate-spin text-primary" />
      </div>
    );
  }
  if (state === "success") {
    return (
      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-emerald-500/10">
        <div className="flex items-center gap-2 text-emerald-600">
          <CheckCircle2 className="h-5 w-5" />
          <span className="text-sm font-medium">Gelukt</span>
        </div>
      </div>
    );
  }
  if (state === "error") {
    return (
      <div className="absolute inset-0 flex items-center justify-center rounded-lg bg-destructive/10">
        <div className="flex items-center gap-2 text-destructive">
          <XCircle className="h-5 w-5" />
          <span className="text-sm font-medium">{errorMsg || "Mislukt"}</span>
        </div>
      </div>
    );
  }
  return null;
}

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

  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
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
              approve.execute(`/api/matches/${output.id}`, "PUT", { status: "approved" })
            }
          />
          <ActionButton
            label="Afwijzen"
            variant="destructive"
            icon={X}
            onClick={() =>
              reject.execute(`/api/matches/${output.id}`, "PUT", { status: "rejected" })
            }
          />
        </div>
      )}
    </div>
  );
});

/* ── Match Approved Card ── */
export const MatchApprovedCard = memo(function MatchApprovedCard({ output }: { output: unknown }) {
  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
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
  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
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
const stageLabels: Record<string, string> = {
  new: "Nieuw",
  screening: "Screening",
  interview: "Interview",
  offer: "Aanbod",
  hired: "Aangenomen",
  rejected: "Afgewezen",
};

export const StageUpdateCard = memo(function StageUpdateCard({ output }: { output: unknown }) {
  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
  const o = output as { stage?: string; previousStage?: string } | null;
  if (!o || !o.stage) return null;
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
export const InterviewPlannedCard = memo(function InterviewPlannedCard({
  output,
}: {
  output: unknown;
}) {
  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
  const o = output as { id?: string; scheduledAt?: string; type?: string } | null;
  if (!o) return null;
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
export const MessageSentCard = memo(function MessageSentCard({ output }: { output: unknown }) {
  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
  const o = output as { subject?: string; channel?: string } | null;
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
