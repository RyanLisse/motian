"use client";
import { Maximize2, Minimize2, Network } from "lucide-react";
import dynamic from "next/dynamic";
import { memo, useCallback, useState } from "react";
import { getToolErrorMessage, isToolError } from "./genui-utils";
import { ToolErrorBlock } from "./tool-error-block";

const MatchNetworkCanvas = dynamic(
  () =>
    import("../../canvas/match-network-canvas").then((m) => ({ default: m.MatchNetworkCanvas })),
  { ssr: false, loading: () => <div className="h-[400px] animate-pulse rounded-lg bg-muted" /> },
);

const CanvasSidebar = dynamic(
  () => import("../../canvas/canvas-sidebar").then((m) => ({ default: m.CanvasSidebar })),
  { ssr: false },
);

type CanvasOutput = {
  type: "match-network";
  kandidaten: Array<{ id: string; name: string; role: string | null }>;
  vacatures: Array<{ id: string; title: string; company: string | null; platform: string }>;
  matches: Array<{ kandidaatId: string; vacatureId: string; score: number; status: string }>;
};

function isCanvasOutput(o: unknown): o is CanvasOutput {
  return (
    typeof o === "object" &&
    o !== null &&
    "type" in o &&
    (o as CanvasOutput).type === "match-network" &&
    "kandidaten" in o &&
    "vacatures" in o &&
    "matches" in o
  );
}

export const CanvasEmbed = memo(function CanvasEmbed({ output }: { output: unknown }) {
  const [expanded, setExpanded] = useState(false);
  const [sidebar, setSidebar] = useState<{
    type: "kandidaat" | "vacature";
    id: string;
    name: string;
    subtitle: string;
  } | null>(null);

  if (isToolError(output)) {
    return <ToolErrorBlock message={getToolErrorMessage(output, "Canvas niet beschikbaar")} />;
  }
  if (!isCanvasOutput(output)) return null;

  const handleNodeClick = useCallback(
    (type: "kandidaat" | "vacature", id: string) => {
      const item =
        type === "kandidaat"
          ? output.kandidaten.find((k) => k.id === id)
          : output.vacatures.find((v) => v.id === id);
      if (!item) return;
      setSidebar({
        type,
        id,
        name: "name" in item ? item.name : (item as { title: string }).title,
        subtitle:
          "role" in item ? (item.role ?? "") : ((item as { company: string | null }).company ?? ""),
      });
    },
    [output],
  );

  return (
    <div
      className={`my-2 rounded-lg border border-border bg-card overflow-hidden relative ${expanded ? "h-[600px]" : "h-[400px]"}`}
    >
      <div className="flex items-center justify-between border-b border-border px-3 py-2">
        <div className="flex items-center gap-2 text-xs text-muted-foreground">
          <Network className="h-3.5 w-3.5" />
          <span>Match netwerk — {output.matches.length} matches</span>
        </div>
        <button
          type="button"
          onClick={() => setExpanded(!expanded)}
          className="rounded p-1 hover:bg-muted"
          title={expanded ? "Verkleinen" : "Vergroten"}
        >
          {expanded ? <Minimize2 className="h-3.5 w-3.5" /> : <Maximize2 className="h-3.5 w-3.5" />}
        </button>
      </div>
      <div className="relative" style={{ height: "calc(100% - 37px)" }}>
        <MatchNetworkCanvas data={output} onNodeClick={handleNodeClick} />
        <CanvasSidebar
          type={sidebar?.type ?? null}
          id={sidebar?.id ?? null}
          name={sidebar?.name ?? null}
          subtitle={sidebar?.subtitle ?? null}
          onClose={() => setSidebar(null)}
        />
      </div>
    </div>
  );
});
