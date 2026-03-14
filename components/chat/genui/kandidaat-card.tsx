"use client";

import { User } from "lucide-react";
import Link from "next/link";
import { ToolErrorBlock } from "./tool-error-block";

type CandidateOutput = {
  id: string;
  name: string;
  role?: string | null;
  email?: string | null;
};

function isCandidateOutput(o: unknown): o is CandidateOutput {
  return typeof o === "object" && o !== null && "id" in o && "name" in o;
}

export function KandidaatGenUICard({ output }: { output: unknown }) {
  if (typeof output === "object" && output !== null && "error" in output) {
    const msg =
      typeof (output as { error: unknown }).error === "string"
        ? (output as { error: string }).error
        : "Kandidaat niet gevonden";
    return <ToolErrorBlock message={msg} />;
  }
  if (!isCandidateOutput(output)) return null;
  return (
    <Link href={`/kandidaten/${output.id}`}>
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 transition-colors hover:border-primary/40 hover:bg-accent cursor-pointer">
        <div className="flex items-start gap-3">
          <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-full bg-muted">
            <User className="h-4 w-4 text-muted-foreground" />
          </div>
          <div className="min-w-0 flex-1">
            <p className="text-sm font-semibold text-foreground truncate">{output.name}</p>
            {output.role && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{output.role}</p>
            )}
            {output.email && (
              <p className="text-xs text-muted-foreground truncate mt-0.5">{output.email}</p>
            )}
          </div>
        </div>
      </div>
    </Link>
  );
}
