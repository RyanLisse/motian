"use client";
import { type Check, CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useState } from "react";

export type ActionState = "idle" | "loading" | "success" | "error";

/** Shared hook for executing API actions with loading/success/error states. */
export function useAction() {
  const [state, setState] = useState<ActionState>("idle");
  const [errorMsg, setErrorMsg] = useState("");

  const execute = async (endpoint: string, method: string, body?: Record<string, unknown>) => {
    setState("loading");
    setErrorMsg("");
    try {
      const res = await fetch(endpoint, {
        method,
        headers: { "Content-Type": "application/json" },
        ...(body ? { body: JSON.stringify(body) } : {}),
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

/** Reusable action button with variant styling. */
export function ActionButton({
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

/** Overlay that shows loading spinner, success, or error state. */
export function StatusOverlay({ state, errorMsg }: { state: ActionState; errorMsg: string }) {
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
