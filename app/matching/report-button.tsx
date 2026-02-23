"use client";

import { FileText, Loader2 } from "lucide-react";
import { useState } from "react";

interface ReportButtonProps {
  matchId: string;
}

export function ReportButton({ matchId }: ReportButtonProps) {
  const [loading, setLoading] = useState(false);

  const handleClick = async () => {
    setLoading(true);
    try {
      const res = await fetch("/api/reports", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ matchId, publish: true }),
      });

      if (!res.ok) {
        const data = await res.json();
        console.error("[ReportButton]", data.error);
        return;
      }

      const data = await res.json();

      if (data.url) {
        window.open(data.url, "_blank", "noopener");
      } else {
        // Fallback: open markdown as blob
        const blob = new Blob([data.markdown], { type: "text/markdown" });
        const url = URL.createObjectURL(blob);
        window.open(url, "_blank");
      }
    } catch (err) {
      console.error("[ReportButton]", err);
    } finally {
      setLoading(false);
    }
  };

  return (
    <button
      type="button"
      onClick={handleClick}
      disabled={loading}
      className="h-7 px-3 flex items-center gap-1 bg-card text-muted-foreground border border-border rounded-lg text-xs font-medium hover:bg-accent hover:text-foreground transition-colors cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed"
    >
      {loading ? <Loader2 className="h-3 w-3 animate-spin" /> : <FileText className="h-3 w-3" />}
      Rapport
    </button>
  );
}
