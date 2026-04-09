"use client";

import { Link2 } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function VacatureShareButton({ title, path }: { title: string; path: string }) {
  const [feedback, setFeedback] = useState<string | null>(null);

  const shareUrl =
    typeof window === "undefined"
      ? path
      : `${window.location.origin}${path.startsWith("/") ? path : `/${path}`}`;

  const handleShare = async () => {
    try {
      if (navigator.share) {
        await navigator.share({
          title,
          url: shareUrl,
        });
        setFeedback("Vacature gedeeld");
      } else {
        await navigator.clipboard.writeText(shareUrl);
        setFeedback("Link gekopieerd");
      }
    } catch {
      setFeedback("Delen mislukt");
    } finally {
      window.setTimeout(() => setFeedback(null), 2000);
    }
  };

  return (
    <div className="flex flex-col items-end gap-1">
      <Button
        type="button"
        variant="outline"
        size="sm"
        className="gap-1.5"
        onClick={() => void handleShare()}
      >
        <Link2 className="h-4 w-4" />
        Vacature delen
      </Button>
      {feedback ? <span className="text-xs text-muted-foreground">{feedback}</span> : null}
    </div>
  );
}
