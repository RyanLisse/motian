"use client";

import { RefreshCw } from "lucide-react";
import { useState } from "react";
import { Button } from "@/components/ui/button";

export function ScraperActions() {
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");

  async function handleScrapeAll() {
    setLoading(true);
    setMessage("");
    try {
      // Call the Motia API master-scrape endpoint
      const res = await fetch("http://localhost:3000/master-scrape", {
        method: "POST",
      });
      if (res.ok) {
        setMessage("Scrape gestart!");
        // Revalidate after a delay
        setTimeout(async () => {
          await fetch("/api/revalidate", {
            method: "POST",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ tags: ["scrapers", "scrape-results", "jobs"] }),
          });
          window.location.reload();
        }, 3000);
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
