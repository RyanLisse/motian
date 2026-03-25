"use client";
import { Box } from "lucide-react";
import { memo } from "react";
import type { A2UIEnvelope } from "@/src/schemas/a2ui";
import { A2UIActionBar } from "./a2ui-actions";

/** Fallback renderer for unrecognized A2UI components. Displays props as key-value pairs. */
export const A2UIFallback = memo(function A2UIFallback({ envelope }: { envelope: A2UIEnvelope }) {
  const entries = Object.entries(envelope.props);

  return (
    <div className="my-1.5 rounded-lg border border-dashed border-border bg-muted/30 p-4">
      <div className="mb-2 flex items-center gap-2">
        <Box className="h-4 w-4 text-muted-foreground" />
        <p className="text-sm font-semibold text-foreground">{envelope.component}</p>
        {envelope.metadata?.source && (
          <span className="ml-auto rounded bg-muted px-1.5 py-0.5 text-[10px] text-muted-foreground">
            {envelope.metadata.source}
          </span>
        )}
      </div>
      {entries.length > 0 && (
        <dl className="space-y-1">
          {entries.map(([key, value]) => (
            <div key={key} className="flex gap-2 text-xs">
              <dt className="min-w-[80px] font-medium text-muted-foreground">{key}</dt>
              <dd className="text-foreground">
                {typeof value === "object" ? JSON.stringify(value) : String(value ?? "—")}
              </dd>
            </div>
          ))}
        </dl>
      )}
      {envelope.actions && envelope.actions.length > 0 && (
        <A2UIActionBar actions={envelope.actions} />
      )}
    </div>
  );
});
