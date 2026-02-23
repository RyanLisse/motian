"use client";

import { RefreshCw } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ScraperActions() {
  const router = useRouter();
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleScrapeAll() {
    setLoading(true);
    setMessage("");
    try {
      const res = await fetch("/api/scrape/starten", {
        method: "POST",
      });
      if (res.ok) {
        setMessage("Scrape gestart!");
        await fetch("/api/revalidate", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ tags: ["scrapers", "scrape-results", "jobs"] }),
        });
        router.refresh();
      } else {
        setMessage("Fout bij starten scrape");
      }
    } catch {
      setMessage("Kan geen verbinding maken met scraper API");
    } finally {
      setLoading(false);
    }
  }

  return (
    <div className="flex items-center gap-3">
      {message && <span className="text-sm text-muted-foreground">{message}</span>}
      <Button
        onClick={handleScrapeAll}
        disabled={loading}
        className="bg-primary text-primary-foreground hover:bg-primary/90"
      >
        <RefreshCw className={`h-4 w-4 mr-2 ${loading ? "animate-spin" : ""}`} />
        {loading ? "Bezig..." : "Alles Scrapen"}
      </Button>
    </div>
  );
}
