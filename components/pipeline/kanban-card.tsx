"use client";

import { GripVertical } from "lucide-react";
import Link from "next/link";
import { type DragEvent, useCallback, useRef, useState } from "react";
import { ScreeningCallButton } from "@/components/screening-call/screening-call-button";
import { Badge } from "@/components/ui/badge";

export interface KanbanCardData {
  id: string;
  candidateId: string | null;
  candidateName: string | null;
  candidateEmail: string | null;
  jobId: string | null;
  jobTitle: string | null;
  jobCompany: string | null;
  source: string | null;
  createdAt: string | null;
  matchScore: number | null;
}

interface KanbanCardProps {
  card: KanbanCardData;
}

export function KanbanCard({ card }: KanbanCardProps) {
  const [isDragging, setIsDragging] = useState(false);
  const didDrag = useRef(false);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("application/x-application-id", card.id);
      e.dataTransfer.effectAllowed = "move";
      setIsDragging(true);
      didDrag.current = true;
    },
    [card.id],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
    // Reset drag flag after a tick so the click handler can check it
    setTimeout(() => {
      didDrag.current = false;
    }, 0);
  }, []);

  const initials = (card.candidateName ?? "?")
    .split(" ")
    .map((n) => n[0])
    .join("")
    .slice(0, 2)
    .toUpperCase();

  const candidateHref = card.candidateId ? `/kandidaten/${card.candidateId}` : null;

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag source
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group bg-card border border-border rounded-lg p-3 cursor-grab active:cursor-grabbing hover:border-primary/40 transition-all ${
        isDragging ? "opacity-40 scale-95" : ""
      }`}
    >
      <div className="flex items-start gap-2.5">
        {/* Grip */}
        <div className="opacity-0 group-hover:opacity-60 transition-opacity pt-0.5">
          <GripVertical className="h-3.5 w-3.5 text-muted-foreground" />
        </div>

        {/* Avatar */}
        <div className="h-8 w-8 rounded-full bg-primary/10 flex items-center justify-center shrink-0">
          <span className="text-[10px] font-semibold text-primary">{initials}</span>
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          {candidateHref ? (
            <Link
              href={candidateHref}
              onClick={(e) => {
                if (didDrag.current) e.preventDefault();
              }}
              className="text-sm font-medium text-foreground truncate block hover:text-primary transition-colors"
            >
              {card.candidateName ?? "Onbekend"}
            </Link>
          ) : (
            <p className="text-sm font-medium text-foreground truncate">
              {card.candidateName ?? "Onbekend"}
            </p>
          )}
          {card.jobTitle && (
            <p className="text-xs text-muted-foreground truncate">
              {card.jobTitle}
              {card.jobCompany && <span className="opacity-60"> - {card.jobCompany}</span>}
            </p>
          )}

          <div className="flex items-center gap-1.5 mt-1.5 flex-wrap">
            {card.matchScore != null && (
              <Badge
                variant="outline"
                className={`text-[9px] px-1.5 py-0 ${
                  card.matchScore >= 80
                    ? "bg-primary/10 text-primary border-primary/20"
                    : card.matchScore >= 60
                      ? "bg-yellow-500/10 text-yellow-600 border-yellow-500/20"
                      : "bg-muted text-muted-foreground"
                }`}
              >
                {Math.round(card.matchScore)}%
              </Badge>
            )}
            {card.candidateId && (
              <ScreeningCallButton
                candidateId={card.candidateId}
                candidateName={card.candidateName ?? "Kandidaat"}
                jobId={card.jobId ?? undefined}
                jobTitle={card.jobTitle ?? undefined}
                matchScore={card.matchScore ?? undefined}
                variant="icon"
              />
            )}
            {card.source && (
              <span className="text-[9px] text-muted-foreground capitalize">{card.source}</span>
            )}
            {card.createdAt && (
              <span className="text-[9px] text-muted-foreground">
                {new Date(card.createdAt).toLocaleDateString("nl-NL", {
                  day: "numeric",
                  month: "short",
                })}
              </span>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
