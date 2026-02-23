"use client";

import { GripVertical } from "lucide-react";
import { type DragEvent, useCallback, useState } from "react";

interface DraggableCandidateProps {
  candidateId: string;
  candidateName: string;
  children: React.ReactNode;
}

export function DraggableCandidate({
  candidateId,
  candidateName,
  children,
}: DraggableCandidateProps) {
  const [isDragging, setIsDragging] = useState(false);

  const handleDragStart = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.dataTransfer.setData("text/plain", candidateId);
      e.dataTransfer.setData(
        "application/x-candidate",
        JSON.stringify({ id: candidateId, name: candidateName }),
      );
      e.dataTransfer.effectAllowed = "link";
      setIsDragging(true);
    },
    [candidateId, candidateName],
  );

  const handleDragEnd = useCallback(() => {
    setIsDragging(false);
  }, []);

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drag source requires div wrapper
    <div
      draggable
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      className={`group relative ${isDragging ? "opacity-50" : ""}`}
    >
      <div className="absolute left-1 top-1/2 -translate-y-1/2 z-10 opacity-0 group-hover:opacity-60 transition-opacity pointer-events-none">
        <GripVertical className="h-4 w-4 text-muted-foreground" />
      </div>
      {children}
    </div>
  );
}
