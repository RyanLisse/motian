"use client";

import { useTransition } from "react";
import { CheckCircle2, XCircle, Loader2 } from "lucide-react";
import { updateMatchStatus } from "./actions";

export function MatchActions({ matchId }: { matchId: string }) {
  const [isPending, startTransition] = useTransition();

  const handleAction = (status: "approved" | "rejected") => {
    startTransition(() => updateMatchStatus(matchId, status));
  };

  if (isPending) {
    return <Loader2 className="h-4 w-4 text-[#6b6b6b] animate-spin" />;
  }

  return (
    <div className="flex items-center gap-2">
      <button
        type="button"
        onClick={() => handleAction("approved")}
        className="h-7 px-3 flex items-center gap-1 bg-[#10a37f]/10 text-[#10a37f] border border-[#10a37f]/20 rounded-lg text-xs font-medium hover:bg-[#10a37f]/20 transition-colors cursor-pointer"
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
