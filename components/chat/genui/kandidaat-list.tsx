"use client";
import { User, Users } from "lucide-react";
import Link from "next/link";
import { useState } from "react";
import { ToolErrorBlock } from "./tool-error-block";

type KandidaatItem = {
  id: string;
  name: string;
  role?: string | null;
  email?: string | null;
  location?: string | null;
  availability?: string | null;
};

type KandidaatListOutput = { total: number; kandidaten: KandidaatItem[] };

function isKandidaatList(o: unknown): o is KandidaatListOutput {
  return (
    typeof o === "object" &&
    o !== null &&
    "kandidaten" in o &&
    Array.isArray((o as KandidaatListOutput).kandidaten)
  );
}

export function KandidaatListCard({ output }: { output: unknown }) {
  const [showAll, setShowAll] = useState(false);

  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
  if (!isKandidaatList(output)) return null;
  if (output.kandidaten.length === 0) {
    return (
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Users className="h-4 w-4" />
          <span>Geen kandidaten gevonden</span>
        </div>
      </div>
    );
  }

  const MAX_VISIBLE = 5;
  const visible = showAll ? output.kandidaten : output.kandidaten.slice(0, MAX_VISIBLE);
  const hasMore = output.kandidaten.length > MAX_VISIBLE;

  return (
    <div className="my-1.5 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Users className="h-3.5 w-3.5" />
        <span>
          {output.total} kandidat{output.total !== 1 ? "en" : ""} gevonden
        </span>
      </div>
      <div className="space-y-1.5">
        {visible.map((item) => (
          <Link key={item.id} href={`/kandidaten/${item.id}`}>
            <div className="rounded-lg border border-border bg-card p-3 transition-colors hover:border-primary/40 hover:bg-accent cursor-pointer">
              <div className="flex items-start gap-3">
                <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
                  <User className="h-3.5 w-3.5 text-muted-foreground" />
                </div>
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-semibold text-foreground truncate">{item.name}</p>
                  <div className="flex flex-wrap gap-x-3 gap-y-0.5 mt-0.5">
                    {item.role && (
                      <span className="text-xs text-muted-foreground truncate">{item.role}</span>
                    )}
                    {item.location && (
                      <span className="text-xs text-muted-foreground truncate">
                        {item.location}
                      </span>
                    )}
                    {item.availability && (
                      <span className="text-xs text-emerald-600">{item.availability}</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </Link>
        ))}
      </div>
      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-primary hover:underline"
        >
          + {output.kandidaten.length - MAX_VISIBLE} meer tonen
        </button>
      )}
    </div>
  );
}
