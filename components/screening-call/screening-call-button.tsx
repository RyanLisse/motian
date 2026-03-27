"use client";

import { Phone, PhoneCall, PhoneOff, Loader2 } from "lucide-react";
import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { ScreeningCallPanel } from "./screening-call-panel";

type CallState = "idle" | "creating" | "ready" | "active" | "completed" | "error";

interface ScreeningCallButtonProps {
  candidateId: string;
  candidateName: string;
  jobId?: string;
  jobTitle?: string;
  matchId?: string;
  applicationId?: string;
  matchScore?: number;
  variant?: "icon" | "compact" | "full";
  className?: string;
}

export function ScreeningCallButton({
  candidateId,
  candidateName,
  jobId,
  jobTitle,
  matchId,
  applicationId,
  matchScore,
  variant = "compact",
  className,
}: ScreeningCallButtonProps) {
  const [callState, setCallState] = useState<CallState>("idle");
  const [callData, setCallData] = useState<any>(null);
  const [panelOpen, setPanelOpen] = useState(false);

  const initiateCall = useCallback(async () => {
    setCallState("creating");
    try {
      const res = await fetch("/api/screening-calls", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          candidateId,
          jobId,
          matchId,
          applicationId,
        }),
      });
      if (!res.ok) throw new Error("Kan screening call niet aanmaken");
      const json = await res.json();
      setCallData(json.data ?? json);
      setCallState("ready");
      setPanelOpen(true);
    } catch {
      setCallState("error");
      setTimeout(() => setCallState("idle"), 3000);
    }
  }, [candidateId, jobId, matchId, applicationId]);

  const handleClose = useCallback(() => {
    setPanelOpen(false);
    setCallState("idle");
    setCallData(null);
  }, []);

  const icon = {
    idle: <Phone className="h-3.5 w-3.5" />,
    creating: <Loader2 className="h-3.5 w-3.5 animate-spin" />,
    ready: <PhoneCall className="h-3.5 w-3.5" />,
    active: <PhoneCall className="h-3.5 w-3.5 animate-pulse" />,
    completed: <PhoneOff className="h-3.5 w-3.5" />,
    error: <Phone className="h-3.5 w-3.5" />,
  }[callState];

  const label = {
    idle: "Bel kandidaat",
    creating: "Verbinden…",
    ready: "Klaar om te bellen",
    active: "In gesprek",
    completed: "Gesprek afgerond",
    error: "Fout — probeer opnieuw",
  }[callState];

  if (variant === "icon") {
    return (
      <>
        <Button
          variant="outline"
          size="icon"
          className={`h-8 w-8 ${
            callState === "active"
              ? "border-green-500 text-green-600 dark:border-green-600 dark:text-green-400"
              : ""
          } ${className ?? ""}`}
          onClick={initiateCall}
          disabled={callState === "creating"}
          title={label}
        >
          {icon}
        </Button>
        {panelOpen && callData && (
          <ScreeningCallPanel
            open={panelOpen}
            onClose={handleClose}
            callId={callData.id}
            candidateName={candidateName}
            jobTitle={jobTitle}
            matchScore={matchScore}
            onStateChange={setCallState}
          />
        )}
      </>
    );
  }

  return (
    <>
      <Button
        variant={
          callState === "error"
            ? "destructive"
            : callState === "active"
              ? "default"
              : "outline"
        }
        size="sm"
        className={`gap-1.5 ${
          callState === "active"
            ? "bg-green-600 hover:bg-green-700 dark:bg-green-700 dark:hover:bg-green-600"
            : ""
        } ${className ?? ""}`}
        onClick={initiateCall}
        disabled={callState === "creating"}
      >
        {icon}
        {variant === "full" || variant === "compact" ? (
          <span className={variant === "compact" ? "hidden sm:inline" : ""}>
            {label}
          </span>
        ) : null}
      </Button>
      {panelOpen && callData && (
        <ScreeningCallPanel
          open={panelOpen}
          onClose={handleClose}
          callId={callData.id}
          candidateName={candidateName}
          jobTitle={jobTitle}
          matchScore={matchScore}
          onStateChange={setCallState}
        />
      )}
    </>
  );
}
