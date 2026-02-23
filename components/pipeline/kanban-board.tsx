"use client";

import { useRouter } from "next/navigation";
import { useCallback, useOptimistic, useTransition } from "react";
import type { KanbanCardData } from "./kanban-card";
import { KanbanColumn } from "./kanban-column";

const STAGES = [
  { key: "new", label: "Nieuw", color: "bg-yellow-500" },
  { key: "screening", label: "Screening", color: "bg-blue-500" },
  { key: "interview", label: "Interview", color: "bg-purple-500" },
  { key: "offer", label: "Aanbod", color: "bg-orange-500" },
  { key: "hired", label: "Geplaatst", color: "bg-green-500" },
] as const;

interface KanbanBoardProps {
  byStage: Record<string, KanbanCardData[]>;
}

type OptimisticAction = { applicationId: string; fromStage: string; toStage: string };

export function KanbanBoard({ byStage }: KanbanBoardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const [optimisticByStage, addOptimisticMove] = useOptimistic(
    byStage,
    (state, action: OptimisticAction) => {
      const next = { ...state };
      // Remove card from old stage
      const fromCards = [...(next[action.fromStage] ?? [])];
      const cardIndex = fromCards.findIndex((c) => c.id === action.applicationId);
      if (cardIndex === -1) return state;
      const [card] = fromCards.splice(cardIndex, 1);
      next[action.fromStage] = fromCards;
      // Add card to new stage
      next[action.toStage] = [card, ...(next[action.toStage] ?? [])];
      return next;
    },
  );

  const handleDrop = useCallback(
    (applicationId: string, targetStage: string) => {
      // Find the card's current stage
      let fromStage = "";
      for (const [stage, cards] of Object.entries(optimisticByStage)) {
        if (cards.some((c) => c.id === applicationId)) {
          fromStage = stage;
          break;
        }
      }
      if (!fromStage || fromStage === targetStage) return;

      startTransition(async () => {
        addOptimisticMove({ applicationId, fromStage, toStage: targetStage });

        try {
          const res = await fetch(`/api/sollicitaties/${applicationId}`, {
            method: "PATCH",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({ stage: targetStage }),
          });

          if (!res.ok) {
            console.error("Failed to update stage:", await res.text());
          }
        } catch (err) {
          console.error("Network error updating stage:", err);
        }

        router.refresh();
      });
    },
    [optimisticByStage, addOptimisticMove, router],
  );

  return (
    <div className="relative">
      {isPending && (
        <div className="absolute top-0 right-0 z-10">
          <span className="text-xs text-muted-foreground animate-pulse">Opslaan...</span>
        </div>
      )}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.key}
            stage={stage.key}
            label={stage.label}
            color={stage.color}
            cards={optimisticByStage[stage.key] ?? []}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
