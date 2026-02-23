"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function ScraperError({ error, reset }: Props) {
  useEffect(() => {
    console.error("Scraper error boundary:", error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold text-foreground">Scraper fout</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Er is een fout opgetreden bij het laden van de scraper pagina.
      </p>
      <button
        type="button"
        onClick={reset}
        className="inline-flex items-center rounded-md bg-primary px-4 py-2 text-sm font-medium text-primary-foreground hover:bg-primary/90 transition-colors"
      >
        Probeer opnieuw
      </button>
    </div>
  );
}
