"use client";

import {
  Background,
  Controls,
  type Edge,
  MiniMap,
  type Node,
  Panel,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import "@xyflow/react/dist/style.css";
import { useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";

export type PipelineWorkflowStepId = "analyse" | "grade" | "match";

interface PipelineWorkflowCanvasProps {
  /** Welke stap is actief (voor visuele highlight). */
  activeStepId?: PipelineWorkflowStepId | null;
  /** Of de pipeline nog loopt (pending/active). */
  isRunning?: boolean;
  className?: string;
}

const NODE_IDS: PipelineWorkflowStepId[] = ["analyse", "grade", "match"];
const STEP_LABELS: Record<PipelineWorkflowStepId, string> = {
  analyse: "Analyse",
  grade: "Grade",
  match: "Match",
};

function buildInitialNodes(activeStepId: PipelineWorkflowStepId | null): Node[] {
  return NODE_IDS.map((id, i) => ({
    id,
    type: "default",
    position: { x: 80 + i * 180, y: 80 },
    data: {
      label: STEP_LABELS[id],
      isActive: activeStepId === id,
      isComplete: activeStepId ? NODE_IDS.indexOf(activeStepId) > NODE_IDS.indexOf(id) : false,
    },
    className: cn(
      "rounded-lg border-2 px-4 py-2 font-medium shadow-sm",
      activeStepId === id && "border-primary bg-primary/10 ring-2 ring-primary/20",
      activeStepId &&
        NODE_IDS.indexOf(activeStepId) > NODE_IDS.indexOf(id) &&
        "border-green-500/50 bg-green-50 dark:bg-green-950/20",
    ),
  }));
}

const INITIAL_EDGES: Edge[] = [
  { id: "e-analyse-grade", source: "analyse", target: "grade", type: "smoothstep" },
  { id: "e-grade-match", source: "grade", target: "match", type: "smoothstep" },
];

export function PipelineWorkflowCanvas({
  activeStepId = null,
  isRunning = false,
  className = "",
}: PipelineWorkflowCanvasProps) {
  const nodesFromStep = useMemo(() => buildInitialNodes(activeStepId ?? null), [activeStepId]);
  const [nodes, setNodes, onNodesChange] = useNodesState(nodesFromStep);
  const [edges, , onEdgesChange] = useEdgesState(INITIAL_EDGES);

  useEffect(() => {
    setNodes(buildInitialNodes(activeStepId ?? null));
  }, [activeStepId, setNodes]);

  return (
    <div className={cn("h-[220px] w-full rounded-lg border border-border bg-muted/20", className)}>
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        fitView
        fitViewOptions={{ padding: 0.2 }}
        minZoom={0.5}
        maxZoom={1.2}
        nodesDraggable={false}
        nodesConnectable={false}
        elementsSelectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={12} size={1} className="bg-transparent" />
        <Controls
          showInteractive={false}
          className="rounded-md border border-border bg-background shadow-sm"
        />
        <MiniMap
          nodeStrokeWidth={3}
          className="rounded-md border border-border bg-background"
          maskColor="hsl(var(--background) / 0.8)"
        />
        <Panel position="top-left" className="text-xs font-medium text-muted-foreground">
          {isRunning ? "Pipeline actief" : "Pipeline"}
        </Panel>
      </ReactFlow>
    </div>
  );
}
