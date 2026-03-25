"use client";
import { Zap } from "lucide-react";
import { memo } from "react";
import type { A2UIAction } from "@/src/schemas/a2ui";
import { ActionButton, StatusOverlay, useAction } from "./action-primitives";

function A2UIActionItem({ action }: { action: A2UIAction }) {
  const { state, errorMsg, execute } = useAction();

  return (
    <div className="relative">
      <StatusOverlay state={state} errorMsg={errorMsg} />
      <ActionButton
        label={action.label}
        variant="outline"
        icon={Zap}
        onClick={() => execute(action.endpoint, action.method, action.body)}
        disabled={state !== "idle"}
      />
    </div>
  );
}

/** Generic action bar that renders A2UI actions as buttons. */
export const A2UIActionBar = memo(function A2UIActionBar({ actions }: { actions: A2UIAction[] }) {
  if (actions.length === 0) return null;

  return (
    <div className="mt-2 flex flex-wrap items-center gap-2">
      {actions.map((action) => (
        <A2UIActionItem key={action.id} action={action} />
      ))}
    </div>
  );
});
