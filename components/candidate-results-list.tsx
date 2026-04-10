"use client";

import { Euro, MapPin } from "lucide-react";
import Link from "next/link";
import { DraggableCandidate } from "@/components/draggable-candidate";
import { VirtualList } from "@/components/shared/virtual-list";
import { Badge } from "@/components/ui/badge";
import { useIsMobile } from "@/hooks/use-mobile";

const MOBILE_VIRTUALIZATION_THRESHOLD = 18;
const MOBILE_CANDIDATE_ESTIMATE = 236;

const availabilityLabels: Record<string, string> = {
  direct: "Direct beschikbaar",
  "1_maand": "Binnen 1 maand",
  "3_maanden": "Binnen 3 maanden",
};

export type CandidateResultsListItem = {
  id: string;
  name: string;
  role: string | null;
  source: string | null;
  location: string | null;
  hourlyRate: number | null;
  availability: string | null;
  skills: unknown;
};

function CandidateResultCard({ candidate }: { candidate: CandidateResultsListItem }) {
  const skills = Array.isArray(candidate.skills) ? (candidate.skills as string[]) : [];

  return (
    <DraggableCandidate candidateId={candidate.id} candidateName={candidate.name}>
      <Link href={`/kandidaten/${candidate.id}`}>
        <div className="bg-card border border-border rounded-lg p-3 sm:p-4 hover:border-primary/40 hover:bg-accent transition-colors cursor-pointer pl-6">
          <div className="flex items-start justify-between gap-2 mb-2 sm:mb-3">
            <div>
              <h3 className="text-sm font-semibold text-foreground leading-snug">
                {candidate.name}
              </h3>
              {candidate.role && (
                <p className="text-xs text-muted-foreground mt-0.5">{candidate.role}</p>
              )}
            </div>
            {candidate.source && (
              <Badge
                variant="outline"
                className="shrink-0 text-[10px] capitalize border-border text-muted-foreground bg-transparent"
              >
                {candidate.source}
              </Badge>
            )}
          </div>

          <div className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground mb-2 sm:mb-3">
            {candidate.location && (
              <span className="flex items-center gap-1.5">
                <MapPin className="h-3.5 w-3.5" />
                {candidate.location}
              </span>
            )}
            {candidate.hourlyRate && (
              <span className="flex items-center gap-1.5">
                <Euro className="h-3.5 w-3.5" />
                {candidate.hourlyRate}/uur
              </span>
            )}
          </div>

          {skills.length > 0 && (
            <div className="flex flex-wrap gap-1.5 mb-2 sm:mb-3">
              {skills.slice(0, 5).map((skill) => (
                <Badge
                  key={`${candidate.id}-${skill}`}
                  variant="outline"
                  className="bg-primary/10 text-primary border-primary/20 text-[10px]"
                >
                  {skill}
                </Badge>
              ))}
              {skills.length > 5 && (
                <Badge
                  variant="outline"
                  className="text-[10px] border-border text-muted-foreground bg-transparent"
                >
                  +{skills.length - 5}
                </Badge>
              )}
            </div>
          )}

          {candidate.availability && (
            <Badge
              variant="outline"
              className={
                candidate.availability === "direct"
                  ? "bg-primary/10 text-primary border-primary/20 text-[10px]"
                  : "text-[10px] border-border text-muted-foreground bg-transparent"
              }
            >
              {availabilityLabels[candidate.availability] ?? candidate.availability}
            </Badge>
          )}
        </div>
      </Link>
    </DraggableCandidate>
  );
}

export function CandidateResultsList({ candidates }: { candidates: CandidateResultsListItem[] }) {
  const isMobile = useIsMobile();
  const shouldVirtualize = isMobile && candidates.length > MOBILE_VIRTUALIZATION_THRESHOLD;

  if (shouldVirtualize) {
    return (
      <VirtualList
        items={candidates}
        getItemKey={(candidate) => candidate.id}
        estimateSize={() => MOBILE_CANDIDATE_ESTIMATE}
        scrollMode="parent"
        gap={12}
        className="min-h-0"
        renderItem={(candidate) => <CandidateResultCard candidate={candidate} />}
      />
    );
  }

  return (
    <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
      {candidates.map((candidate) => (
        <CandidateResultCard key={candidate.id} candidate={candidate} />
      ))}
    </div>
  );
}
