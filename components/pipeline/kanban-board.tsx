"use client";

import { useCallback, useEffect, useState } from "react";
import { useDataMutationNotifier } from "@/components/data-refresh-listener";
import { moveStageCard } from "@/src/lib/mobile-optimistic";
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
  const notifyDataMutation = useDataMutationNotifier();
  const [boardState, setBoardState] = useState(byStage);
  const [savingMove, setSavingMove] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setBoardState(byStage);
  }, [byStage]);

  const handleDrop = useCallback(
    async (applicationId: string, targetStage: string) => {
      // Find the card's current stage
      let fromStage = "";
      for (const [stage, cards] of Object.entries(boardState)) {
        if (cards.some((c) => c.id === applicationId)) {
          fromStage = stage;
          break;
        }
      }
      if (!fromStage || fromStage === targetStage) return;

      const previousState = boardState;
      const action: OptimisticAction = { applicationId, fromStage, toStage: targetStage };
      setError(null);
      setSavingMove(true);
      setBoardState((currentState) =>
        moveStageCard(currentState, {
          cardId: action.applicationId,
          fromStage: action.fromStage,
          toStage: action.toStage,
        }),
      );

      try {
        const res = await fetch(`/api/sollicitaties/${applicationId}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ stage: targetStage }),
        });

        const body = (await res.json().catch(() => null)) as { error?: string } | null;
        if (!res.ok) {
          throw new Error(body?.error ?? "Pipeline-fase opslaan mislukt");
        }

        notifyDataMutation(["pipeline"]);
      } catch (err) {
        setBoardState(previousState);
        setError(err instanceof Error ? err.message : "Pipeline-fase opslaan mislukt");
      } finally {
        setSavingMove(false);
      }
    },
    [boardState, notifyDataMutation],
  );

  return (
    <div className="relative">
      {savingMove && (
        <div className="absolute top-0 right-0 z-10">
          <span className="text-xs text-muted-foreground animate-pulse">Opslaan...</span>
        </div>
      )}
      {error ? (
        <div className="mb-3 rounded-md border border-destructive/20 bg-destructive/5 px-3 py-2 text-sm text-destructive">
          {error}
        </div>
      ) : null}
      <div className="flex gap-3 overflow-x-auto pb-4">
        {STAGES.map((stage) => (
          <KanbanColumn
            key={stage.key}
            stage={stage.key}
            label={stage.label}
            color={stage.color}
            cards={boardState[stage.key] ?? []}
            onDrop={handleDrop}
          />
        ))}
      </div>
    </div>
  );
}
