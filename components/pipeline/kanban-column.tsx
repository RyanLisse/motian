"use client";

import { type DragEvent, useCallback, useState } from "react";
import { KanbanCard, type KanbanCardData } from "./kanban-card";

interface KanbanColumnProps {
  stage: string;
  label: string;
  color: string;
  cards: KanbanCardData[];
  onDrop: (applicationId: string, targetStage: string) => void;
}

export function KanbanColumn({ stage, label, color, cards, onDrop }: KanbanColumnProps) {
  const [isDragOver, setIsDragOver] = useState(false);

  const onDragOver = useCallback((e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    e.dataTransfer.dropEffect = "move";
    setIsDragOver(true);
  }, []);

  const onDragLeave = useCallback(() => {
    setIsDragOver(false);
  }, []);

  const onDropHandler = useCallback(
    (e: DragEvent<HTMLDivElement>) => {
      e.preventDefault();
      setIsDragOver(false);
      const applicationId = e.dataTransfer.getData("application/x-application-id");
      if (applicationId) {
        onDrop(applicationId, stage);
      }
    },
    [onDrop, stage],
  );

  return (
    // biome-ignore lint/a11y/noStaticElementInteractions: drop zone requires drag event handlers
    <div
      className={`flex flex-col min-w-[280px] w-[280px] shrink-0 rounded-xl border transition-colors ${
        isDragOver ? "border-primary/50 bg-primary/5" : "border-border bg-muted/30"
      }`}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDropHandler}
    >
      {/* Column header */}
      <div className="flex items-center gap-2 px-3 py-2.5 border-b border-border">
        <div className={`h-2 w-2 rounded-full ${color}`} />
        <span className="text-sm font-medium text-foreground">{label}</span>
        <span className="ml-auto text-xs text-muted-foreground bg-muted rounded-full px-2 py-0.5">
          {cards.length}
        </span>
      </div>

      {/* Cards area */}
      <div className="flex-1 p-2 space-y-2 overflow-y-auto max-h-[calc(100vh-320px)]">
        {cards.length === 0 ? (
          <div className="py-8 text-center">
            <p className="text-xs text-muted-foreground">Geen kandidaten</p>
          </div>
        ) : (
          cards.map((card) => <KanbanCard key={card.id} card={card} />)
        )}
      </div>
    </div>
  );
}
