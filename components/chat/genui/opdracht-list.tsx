"use client";
import { Briefcase } from "lucide-react";
import { useState } from "react";
import { JobCard } from "@/components/job-card";
import { ToolErrorBlock } from "./tool-error-block";

type OpdrachtItem = {
  id: string;
  title: string;
  company: string | null;
  location: string | null;
  platform: string;
  contractType?: string | null;
  workArrangement?: string | null;
  rateMin?: number | null;
  rateMax?: number | null;
  applicationDeadline?: string | Date | null;
  postedAt?: string | Date | null;
  score?: number;
};

type OpdrachtListOutput = { total: number; opdrachten: OpdrachtItem[] };

function isOpdrachtList(o: unknown): o is OpdrachtListOutput {
  return (
    typeof o === "object" &&
    o !== null &&
    "opdrachten" in o &&
    Array.isArray((o as OpdrachtListOutput).opdrachten)
  );
}

function toDate(v: string | Date | null | undefined): Date | null {
  if (v == null) return null;
  if (v instanceof Date) return v;
  const d = new Date(v);
  return Number.isNaN(d.getTime()) ? null : d;
}

export function OpdrachtListCard({ output }: { output: unknown }) {
  const [showAll, setShowAll] = useState(false);

  if (typeof output === "object" && output !== null && "error" in output) {
    return <ToolErrorBlock message={String((output as { error: unknown }).error)} />;
  }
  if (!isOpdrachtList(output)) return null;
  if (output.opdrachten.length === 0) {
    return (
      <div className="my-1.5 rounded-lg border border-border bg-card p-4 text-sm text-muted-foreground">
        <div className="flex items-center gap-2">
          <Briefcase className="h-4 w-4" />
          <span>Geen opdrachten gevonden</span>
        </div>
      </div>
    );
  }

  const MAX_VISIBLE = 5;
  const visible = showAll ? output.opdrachten : output.opdrachten.slice(0, MAX_VISIBLE);
  const hasMore = output.opdrachten.length > MAX_VISIBLE;

  return (
    <div className="my-1.5 space-y-2">
      <div className="flex items-center gap-2 text-xs text-muted-foreground">
        <Briefcase className="h-3.5 w-3.5" />
        <span>
          {output.total} opdracht{output.total !== 1 ? "en" : ""} gevonden
        </span>
      </div>
      <div className="space-y-2">
        {visible.map((item) => (
          <JobCard
            key={item.id}
            job={{
              id: item.id,
              title: item.title,
              company: item.company ?? null,
              location: item.location ?? null,
              platform: item.platform,
              contractType: item.contractType ?? null,
              workArrangement: item.workArrangement ?? null,
              rateMin: item.rateMin ?? null,
              rateMax: item.rateMax ?? null,
              applicationDeadline: toDate(item.applicationDeadline),
              postedAt: toDate(item.postedAt),
            }}
          />
        ))}
      </div>
      {hasMore && !showAll && (
        <button
          type="button"
          onClick={() => setShowAll(true)}
          className="text-xs text-primary hover:underline"
        >
          + {output.opdrachten.length - MAX_VISIBLE} meer tonen
        </button>
      )}
    </div>
  );
}
