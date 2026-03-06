"use client";

import { Check, Copy } from "lucide-react";
import { useCallback, useState } from "react";
import { Button } from "@/components/ui/button";

type JsonPayloadViewerProps = {
  data: Record<string, unknown> | null;
  title?: string;
  className?: string;
};

/** Toont ruwe JSON leesbaar geformatteerd met optionele copy-knop. */
export function JsonPayloadViewer({ data, title, className = "" }: JsonPayloadViewerProps) {
  const [copied, setCopied] = useState(false);

  const formatted = data === null ? "Geen data" : JSON.stringify(data, null, 2);

  const handleCopy = useCallback(async () => {
    if (formatted === "Geen data") return;
    await navigator.clipboard.writeText(formatted);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  }, [formatted]);

  return (
    <div className={className}>
      {(title || formatted !== "Geen data") && (
        <div className="flex items-center justify-between gap-2 mb-2">
          {title && <span className="text-sm font-medium text-muted-foreground">{title}</span>}
          {formatted !== "Geen data" && (
            <Button
              type="button"
              variant="ghost"
              size="sm"
              className="h-8 gap-1"
              onClick={handleCopy}
            >
              {copied ? (
                <Check className="h-3.5 w-3.5 text-green-500" />
              ) : (
                <Copy className="h-3.5 w-3.5" />
              )}
              {copied ? "Gekopieerd" : "Kopiëren"}
            </Button>
          )}
        </div>
      )}
      <pre className="rounded-md bg-muted/50 border border-border p-4 text-xs overflow-auto max-h-[70vh] whitespace-pre-wrap wrap-break-word font-mono">
        {formatted}
      </pre>
    </div>
  );
}
