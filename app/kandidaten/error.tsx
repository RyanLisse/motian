"use client";

import * as Sentry from "@sentry/nextjs";
import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

interface Props {
  error: Error & { digest?: string };
  reset: () => void;
}

export default function KandidatenError({ error, reset }: Props) {
  useEffect(() => {
    console.error("Kandidaten error boundary:", error);
    Sentry.captureException(error);
  }, [error]);

  return (
    <div className="flex flex-col items-center justify-center min-h-[400px] gap-4">
      <AlertCircle className="h-12 w-12 text-destructive" />
      <h2 className="text-xl font-semibold text-foreground">Laden mislukt</h2>
      <p className="text-sm text-muted-foreground text-center max-w-md">
        Er is een fout opgetreden bij het laden van kandidaten. Probeer het opnieuw.
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
