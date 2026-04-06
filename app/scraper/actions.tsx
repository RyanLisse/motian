"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { Button } from "@/components/ui/button";

const SCRAPER_POLL_INTERVAL_MS = 15_000;
const SCRAPER_POLL_TIMEOUT_MS = 2 * 60_000;

export function ScraperActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const pollIntervalRef = useRef<number | null>(null);
  const pollTimeoutRef = useRef<number | null>(null);

  useEffect(() => {
    return () => {
      if (pollIntervalRef.current !== null) {
        window.clearInterval(pollIntervalRef.current);
      }
      if (pollTimeoutRef.current !== null) {
        window.clearTimeout(pollTimeoutRef.current);
      }
    };
  }, []);

  function stopPolling() {
    if (pollIntervalRef.current !== null) {
      window.clearInterval(pollIntervalRef.current);
      pollIntervalRef.current = null;
    }
    if (pollTimeoutRef.current !== null) {
      window.clearTimeout(pollTimeoutRef.current);
      pollTimeoutRef.current = null;
    }
  }

  function startPolling() {
    stopPolling();

    pollIntervalRef.current = window.setInterval(() => {
      if (document.visibilityState === "visible") {
        router.refresh();
      }
    }, SCRAPER_POLL_INTERVAL_MS);

    pollTimeoutRef.current = window.setTimeout(() => {
      stopPolling();
      setLoading(false);
      setMessage("Scrape gestart. Dashboard automatisch ververst, controleer de recente runs.");
      router.refresh();
    }, SCRAPER_POLL_TIMEOUT_MS);
  }

  async function handleScrapeAll() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/scrape/starten", {
        method: "POST",
      });
      if (res.ok) {
        setMessage("Scrape gestart. We verversen het dashboard tijdelijk automatisch.");
        router.refresh();
        startPolling();
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
    <div className="flex w-full flex-col items-stretch gap-2 sm:w-auto sm:flex-row sm:items-center sm:justify-end">
      {message && (
        <p aria-live="polite" className="max-w-full text-sm text-muted-foreground sm:max-w-xs">
          {message}
        </p>
      )}
      <Button
        onClick={handleScrapeAll}
        disabled={loading}
        className="w-full bg-primary text-white hover:bg-primary/90 sm:w-auto"
      >
        <RefreshCw className={`mr-2 h-4 w-4 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Bezig..." : "Alles Scrapen"}
      </Button>
    </div>
  );
}
