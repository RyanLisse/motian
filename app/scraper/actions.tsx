"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { useEventSource } from "@/src/hooks/use-event-source";

export function ScraperActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  const handlers = useMemo(
    () => ({
      "scrape:start": (data: Record<string, unknown>) => {
        setMessage(`Scrape ${data.platform} gestart...`);
      },
      "scrape:complete": (data: Record<string, unknown>) => {
        setMessage(`${data.platform}: ${data.jobsNew} nieuw, ${data.duplicates} dubbel`);
        router.refresh();
      },
      "scrape:error": (data: Record<string, unknown>) => {
        setMessage(`${data.platform}: fout — ${(data.errors as string[])?.[0] ?? "onbekend"}`);
        setLoading(false);
      },
    }),
    [router],
  );

  useEventSource(handlers);

  async function handleScrapeAll() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/scrape/starten", {
        method: "POST",
      });
      if (res.ok) {
        setMessage("Scrape gestart!");
      } else {
        setMessage("Fout bij starten scrape");
        setLoading(false);
      }
    } catch {
      setMessage("Kan geen verbinding maken met scraper API");
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-sm text-[#8e8e8e]">{message}</span>}
      <Button
        onClick={handleScrapeAll}
        disabled={loading}
        className="bg-[#10a37f] text-white hover:bg-[#10a37f]/90"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Bezig..." : "Alles Scrapen"}
      </Button>
    </div>
  );
}
