"use client";

import { Check, Share2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

const RESET_DELAY_MS = 2_000;

type ShareState = "idle" | "copied" | "error";

export function buildVacatureShareUrl(jobId: string, origin: string) {
  return new URL(`/vacatures/${jobId}`, origin).toString();
}

function isAbortedShare(error: unknown) {
  return (
    typeof error === "object" && error !== null && "name" in error && error.name === "AbortError"
  );
}

export function VacatureShareButton({ jobId, jobTitle }: { jobId: string; jobTitle: string }) {
  const [shareState, setShareState] = useState<ShareState>("idle");

  const resetShareState = () => {
    window.setTimeout(() => setShareState("idle"), RESET_DELAY_MS);
  };

  const handleShare = async () => {
    const shareUrl = buildVacatureShareUrl(jobId, window.location.origin);

    if (typeof navigator.share === "function") {
      try {
        await navigator.share({
          title: jobTitle,
          text: `Bekijk vacature: ${jobTitle}`,
          url: shareUrl,
        });
        return;
      } catch (error) {
        if (isAbortedShare(error)) {
          return;
        }
      }
    }

    try {
      await navigator.clipboard.writeText(shareUrl);
      setShareState("copied");
    } catch {
      setShareState("error");
    }

    resetShareState();
  };

  const isCopied = shareState === "copied";

  return (
    <div className="flex items-center gap-2">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="border-border"
        onClick={handleShare}
      >
        {isCopied ? <Check className="mr-2 h-4 w-4" /> : <Share2 className="mr-2 h-4 w-4" />}
        {isCopied ? "Link gekopieerd" : "Deel vacature"}
      </Button>
      <span className="sr-only" aria-live="polite">
        {shareState === "copied"
          ? "Vacaturelink gekopieerd"
          : shareState === "error"
            ? "Vacaturelink kopiëren mislukt"
            : ""}
      </span>
    </div>
  );
}
