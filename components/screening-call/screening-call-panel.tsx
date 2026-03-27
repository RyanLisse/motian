"use client";

import {
  AlertTriangle,
  Briefcase,
  CheckCircle2,
  ChevronDown,
  ChevronUp,
  MessageSquare,
  Mic,
  MicOff,
  Phone,
  PhoneCall,
  PhoneOff,
  Star,
  User,
} from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetHeader,
  SheetTitle,
} from "@/components/ui/sheet";

type CallState = "idle" | "creating" | "ready" | "active" | "completed" | "error";

interface ScreeningQuestion {
  id: string;
  question: string;
  category: "ai_generated" | "template" | "custom";
  priority: number;
  answer?: string;
  sentiment?: "positive" | "neutral" | "negative";
}

interface ScreeningCallPanelProps {
  open: boolean;
  onClose: () => void;
  callId: string;
  candidateName: string;
  jobTitle?: string;
  matchScore?: number;
  onStateChange?: (state: CallState) => void;
}

export function ScreeningCallPanel({
  open,
  onClose,
  callId,
  candidateName,
  jobTitle,
  matchScore,
  onStateChange,
}: ScreeningCallPanelProps) {
  const [callDetails, setCallDetails] = useState<Record<string, unknown> | null>(null);
  const [callState, setCallState] = useState<CallState>("ready");
  const [isMuted, setIsMuted] = useState(false);
  const [activeQuestionIdx, setActiveQuestionIdx] = useState(0);
  const [showTranscript, setShowTranscript] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Fetch call details
  useEffect(() => {
    if (!callId) return;
    fetch(`/api/screening-calls/${callId}`)
      .then((r) => r.json())
      .then((json) => setCallDetails(json.data ?? json))
      .catch(() => setError("Kan gespreksgegevens niet laden"));
  }, [callId]);

  // Notify parent of state changes
  useEffect(() => {
    onStateChange?.(callState);
  }, [callState, onStateChange]);

  const startCall = useCallback(async () => {
    setCallState("active");
    try {
      // Get LiveKit token for this screening call room
      const tokenRes = await fetch(`/api/screening-calls/${callId}/token`, {
        method: "POST",
      });
      if (!tokenRes.ok) throw new Error("Kan geen verbinding maken");
      // Token data contains server_url, participant_token, room_name
      // LiveKit connection would happen here via @livekit/components-react
      // For now, update status to active
      await fetch(`/api/screening-calls/${callId}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status: "active" }),
      });
    } catch {
      setCallState("error");
      setError("Kan geen verbinding maken met de spraakagent");
    }
  }, [callId]);

  const endCall = useCallback(async () => {
    setCallState("completed");
    await fetch(`/api/screening-calls/${callId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        status: "completed",
        endedAt: new Date().toISOString(),
      }),
    });
  }, [callId]);

  const questions: ScreeningQuestion[] = callDetails?.screeningQuestions ?? [];
  const candidateContext = callDetails?.candidateContext ?? {};
  const jobContext = callDetails?.jobContext ?? {};
  const matchContext = callDetails?.matchContext ?? {};
  const transcript = callDetails?.transcript ?? [];

  return (
    <Sheet
      open={open}
      onOpenChange={(isOpen) => {
        if (!isOpen) onClose();
      }}
    >
      <SheetContent className="w-full overflow-y-auto sm:max-w-lg">
        <SheetHeader>
          <SheetTitle className="flex items-center gap-2">
            <PhoneCall className="h-5 w-5 text-primary" />
            Screening gesprek
          </SheetTitle>
          <SheetDescription>AI-gestuurd screeninggesprek met {candidateName}</SheetDescription>
        </SheetHeader>

        <div className="mt-6 space-y-6">
          {/* Call Controls */}
          <div className="flex items-center justify-between rounded-lg border border-border bg-muted/30 p-4 dark:bg-muted/10">
            <div className="flex items-center gap-3">
              <div
                className={`flex h-10 w-10 items-center justify-center rounded-full ${
                  callState === "active"
                    ? "bg-green-100 text-green-700 dark:bg-green-950 dark:text-green-400"
                    : "bg-muted text-muted-foreground"
                }`}
              >
                {callState === "active" ? (
                  <PhoneCall className="h-5 w-5 animate-pulse" />
                ) : callState === "completed" ? (
                  <CheckCircle2 className="h-5 w-5 text-primary" />
                ) : (
                  <Phone className="h-5 w-5" />
                )}
              </div>
              <div>
                <p className="text-sm font-medium">{candidateName}</p>
                <p className="text-xs text-muted-foreground">
                  {callState === "ready" && "Klaar om te bellen"}
                  {callState === "active" && "In gesprek — AI voert screening uit"}
                  {callState === "completed" && "Gesprek afgerond"}
                  {callState === "error" && "Verbindingsfout"}
                </p>
              </div>
            </div>
            <div className="flex gap-2">
              {callState === "active" && (
                <Button
                  variant="outline"
                  size="icon"
                  className="h-9 w-9"
                  onClick={() => setIsMuted(!isMuted)}
                >
                  {isMuted ? <MicOff className="h-4 w-4" /> : <Mic className="h-4 w-4" />}
                </Button>
              )}
              {callState === "ready" && (
                <Button
                  onClick={startCall}
                  className="gap-1.5 bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
                >
                  <Phone className="h-4 w-4" /> Start gesprek
                </Button>
              )}
              {callState === "active" && (
                <Button variant="destructive" onClick={endCall} className="gap-1.5">
                  <PhoneOff className="h-4 w-4" /> Beëindig
                </Button>
              )}
            </div>
          </div>

          {/* Context Cards */}
          <div className="grid grid-cols-2 gap-3">
            {/* Candidate Card */}
            <div className="rounded-lg border border-border p-3 dark:border-input">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <User className="h-3.5 w-3.5" /> Kandidaat
              </div>
              <p className="text-sm font-medium">{candidateContext.name ?? candidateName}</p>
              {candidateContext.role && (
                <p className="text-xs text-muted-foreground">{candidateContext.role}</p>
              )}
              {candidateContext.location && (
                <p className="mt-1 text-xs text-muted-foreground">{candidateContext.location}</p>
              )}
              {candidateContext.hourlyRate && (
                <p className="mt-1 text-xs">€{candidateContext.hourlyRate}/uur</p>
              )}
            </div>

            {/* Job Card */}
            <div className="rounded-lg border border-border p-3 dark:border-input">
              <div className="mb-2 flex items-center gap-1.5 text-xs font-medium text-muted-foreground">
                <Briefcase className="h-3.5 w-3.5" /> Vacature
              </div>
              <p className="text-sm font-medium">{jobContext.title ?? jobTitle ?? "—"}</p>
              {jobContext.company && (
                <p className="text-xs text-muted-foreground">{jobContext.company}</p>
              )}
              {jobContext.location && (
                <p className="mt-1 text-xs text-muted-foreground">{jobContext.location}</p>
              )}
              {(jobContext.rateMin || jobContext.rateMax) && (
                <p className="mt-1 text-xs">
                  €{jobContext.rateMin ?? "?"} – €{jobContext.rateMax ?? "?"}/uur
                </p>
              )}
            </div>
          </div>

          {/* Match Score */}
          {(matchScore ?? matchContext.matchScore) && (
            <div className="flex items-center gap-2 rounded-lg border border-border bg-muted/30 p-3 dark:bg-muted/10 dark:border-input">
              <Star className="h-4 w-4 text-yellow-500" />
              <span className="text-sm font-medium">
                Match score: {matchScore ?? matchContext.matchScore}%
              </span>
              {matchContext.recommendation && (
                <Badge
                  variant="outline"
                  className={
                    matchContext.recommendation === "go"
                      ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
                      : matchContext.recommendation === "no-go"
                        ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                        : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                  }
                >
                  {matchContext.recommendation}
                </Badge>
              )}
              {matchContext.reasoning && (
                <p className="text-xs text-muted-foreground line-clamp-2">
                  {matchContext.reasoning}
                </p>
              )}
            </div>
          )}

          {/* Screening Questions */}
          <div>
            <h3 className="mb-3 flex items-center gap-2 text-sm font-semibold">
              <MessageSquare className="h-4 w-4" />
              Screeningvragen ({questions.length})
            </h3>
            <div className="space-y-2">
              {questions.map((q, i) => (
                <button
                  key={q.id}
                  type="button"
                  className={`w-full rounded-lg border p-3 text-left transition-colors ${
                    i === activeQuestionIdx
                      ? "border-primary bg-primary/5 dark:border-primary/50"
                      : q.answer
                        ? "border-green-200 bg-green-50/50 dark:border-green-900 dark:bg-green-950/30"
                        : "border-border hover:border-primary/40 dark:border-input dark:hover:border-primary/40"
                  }`}
                  onClick={() => setActiveQuestionIdx(i)}
                >
                  <div className="flex items-start justify-between gap-2">
                    <div className="flex-1">
                      <div className="mb-1 flex items-center gap-1.5">
                        <span className="flex h-5 w-5 items-center justify-center rounded-full bg-muted text-[10px] font-bold dark:bg-muted/50">
                          {i + 1}
                        </span>
                        <Badge variant="outline" className="text-[10px]">
                          {q.category === "ai_generated"
                            ? "AI"
                            : q.category === "template"
                              ? "Standaard"
                              : "Aangepast"}
                        </Badge>
                      </div>
                      <p className="text-sm">{q.question}</p>
                    </div>
                    {q.answer && <CheckCircle2 className="mt-1 h-4 w-4 shrink-0 text-green-600" />}
                  </div>
                  {q.answer && (
                    <p className="mt-2 border-t border-border/50 pt-2 text-xs text-muted-foreground dark:border-input/30">
                      {q.answer}
                    </p>
                  )}
                </button>
              ))}
            </div>
          </div>

          {/* Live Transcript Toggle */}
          <div>
            <button
              type="button"
              className="flex w-full items-center justify-between text-sm font-semibold"
              onClick={() => setShowTranscript(!showTranscript)}
            >
              <span className="flex items-center gap-2">
                <MessageSquare className="h-4 w-4" />
                Live transcript
              </span>
              {showTranscript ? (
                <ChevronUp className="h-4 w-4" />
              ) : (
                <ChevronDown className="h-4 w-4" />
              )}
            </button>
            {showTranscript && (
              <div className="mt-2 max-h-60 space-y-2 overflow-y-auto rounded-lg border border-border bg-muted/20 p-3 dark:border-input dark:bg-muted/5">
                {transcript.length === 0 ? (
                  <p className="text-center text-xs text-muted-foreground">
                    {callState === "active"
                      ? "Wachten op spraak..."
                      : "Transcript verschijnt hier tijdens het gesprek"}
                  </p>
                ) : (
                  transcript.map((entry: { speaker: string; text: string }, i: number) => (
                    <div
                      // biome-ignore lint/suspicious/noArrayIndexKey: transcript entries have no stable id
                      key={i}
                      className={`text-xs ${
                        entry.speaker === "agent" ? "text-primary" : "text-foreground"
                      }`}
                    >
                      <span className="font-medium">
                        {entry.speaker === "agent" ? "AI Agent" : candidateName}:
                      </span>{" "}
                      {entry.text}
                    </div>
                  ))
                )}
              </div>
            )}
          </div>

          {/* Error */}
          {error && (
            <div className="flex items-center gap-2 rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400">
              <AlertTriangle className="h-4 w-4" />
              {error}
            </div>
          )}

          {/* Post-call summary (when completed) */}
          {callState === "completed" && callDetails?.callSummary && (
            <div className="rounded-lg border border-primary/30 bg-primary/5 p-4 dark:border-primary/20 dark:bg-primary/5">
              <h3 className="mb-2 text-sm font-semibold">Gespreksresultaat</h3>
              <p className="text-sm text-muted-foreground">{callDetails.callSummary}</p>
              {callDetails.recommendedNextStep && (
                <div className="mt-2">
                  <Badge
                    variant="outline"
                    className={
                      callDetails.recommendedNextStep === "proceed"
                        ? "border-green-300 bg-green-50 text-green-700 dark:border-green-900 dark:bg-green-950/30 dark:text-green-400"
                        : callDetails.recommendedNextStep === "reject"
                          ? "border-red-300 bg-red-50 text-red-700 dark:border-red-900 dark:bg-red-950/30 dark:text-red-400"
                          : "border-amber-300 bg-amber-50 text-amber-700 dark:border-amber-900 dark:bg-amber-950/30 dark:text-amber-400"
                    }
                  >
                    {callDetails.recommendedNextStep === "proceed"
                      ? "Doorgaan naar interview"
                      : callDetails.recommendedNextStep === "reject"
                        ? "Niet geschikt"
                        : "Opvolging nodig"}
                  </Badge>
                </div>
              )}
            </div>
          )}
        </div>
      </SheetContent>
    </Sheet>
  );
}
