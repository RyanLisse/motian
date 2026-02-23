"use client";

import { CheckCircle2, Loader2, XCircle } from "lucide-react";
import { useTransition } from "react";
import { updateMatchStatus } from "./actions";

export function MatchActions({ matchId }: { matchId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleAction = (status: "approved" | "rejected") => {
    startTransition(() => updateMatchStatus(matchId, status));
  };

  if (isPending) {
    return <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" />;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handleAction("approved")}
        className="h-7 px-3 flex items-center gap-1 bg-primary/10 text-primary border border-primary/20 rounded-lg text-xs font-medium hover:bg-primary/20 transition-colors cursor-pointer"
      >
        <CheckCircle2 className="h-3 w-3" />
        Goedkeuren
      </button>
      <button
        type="button"
        onClick={() => handleAction("rejected")}
        className="h-7 px-3 flex items-center gap-1 bg-red-500/10 text-red-500 border border-red-500/20 rounded-lg text-xs font-medium hover:bg-red-500/20 transition-colors cursor-pointer"
      >
        <XCircle className="h-3 w-3" />
        Afwijzen
      </button>
    </div>
  );
}
