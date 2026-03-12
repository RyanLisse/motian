"use client";

import { Check, Loader2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { type DragEvent, useCallback, useState } from "react";
import { cn } from "@/lib/utils";
import { linkCandidateToJob } from "@/src/actions/match-linking";

interface DroppableVacancyProps {
  className?: string;
  jobId: string;
  /** Unused but kept for context — callers pass title for future toast/log use */
  jobTitle?: string;
  children: React.ReactNode;
}

type DropStatus = "idle" | "over" | "loading" | "success" | "error";

export function DroppableVacancy({ className, jobId, children }: DroppableVacancyProps) {
  const router = useRouter();
  const [status, setStatus] = useState<DropStatus>("idle");
  const [errorMessage, setErrorMessage] = useState("");

  const handleDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    if (e.dataTransfer.types.includes("application/x-candidate")) {
      e.preventDefault();
      e.dataTransfer.dropEffect = "link";
      setStatus("over");
    }
  }, []);

  const handleDragLeave = useCallback(() => {
    setStatus("idle");
  }, []);

  const handleDrop = useCallback(
    async (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      const candidateId = e.dataTransfer.getData("text/plain");
      if (!candidateId) {
        setStatus("idle");
        return;
      }

      setStatus("loading");
      const result = await linkCandidateToJob(jobId, candidateId);

      if (result.success) {
        setStatus("success");
        router.refresh();
        setTimeout(() => setStatus("idle"), 2000);
      } else {
        setErrorMessage(result.error ?? "Onbekende fout");
        setStatus("error");
        setTimeout(() => setStatus("idle"), 3000);
      }
    },
    [jobId, router],
  );

  const borderClass = status === "over" ? "ring-2 ring-primary/20 border-primary" : "";

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop target requires div wrapper
    <div
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      className={cn("relative rounded-lg transition-all", borderClass, className)}
    >
      {children}

      {status === "loading" && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded bg-muted px-3 py-1.5 text-xs text-muted-foreground">
          <Loader2 className="h-3 w-3 animate-spin" />
          Kandidaat koppelen...
        </div>
      )}

      {status === "success" && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded bg-emerald-500/10 px-3 py-1.5 text-xs text-emerald-600">
          <Check className="h-3 w-3" />
          Gekoppeld!
        </div>
      )}

      {status === "error" && (
        <div className="absolute bottom-2 left-2 right-2 flex items-center gap-2 rounded bg-destructive/10 px-3 py-1.5 text-xs text-destructive">
          <X className="h-3 w-3" />
          Koppeling mislukt: {errorMessage}
        </div>
      )}
    </div>
  );
}
