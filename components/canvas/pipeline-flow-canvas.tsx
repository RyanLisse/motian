"use client";
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  type Node,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { memo, useMemo } from "react";
import "@xyflow/react/dist/style.css";

type StageData = {
  stage: string;
  label: string;
  count: number;
  kandidaten: Array<{ id: string; name: string }>;
};

export type PipelineFlowData = {
  stages: StageData[];
};

const STAGE_COLORS: Record<string, string> = {
  new: "#3b82f6",
  screening: "#f59e0b",
  interview: "#8b5cf6",
  offer: "#22c55e",
  hired: "#16a34a",
  rejected: "#ef4444",
};

const StageNode = memo(function StageNode({
  data,
}: {
  data: { label: string; count: number; color: string };
}) {
  return (
    <div
      className="rounded-lg border-2 bg-card p-3 min-w-[140px] text-center shadow-sm"
      style={{ borderColor: data.color }}
    >
      <p className="text-xs font-semibold text-foreground">{data.label}</p>
      <p className="text-2xl font-bold mt-1" style={{ color: data.color }}>
        {data.count}
      </p>
      <p className="text-[10px] text-muted-foreground mt-0.5">kandidaten</p>
    </div>
  );
});

const pipelineNodeTypes = { stage: StageNode } as const;

function buildPipelineGraph(data: PipelineFlowData) {
  const X_GAP = 200;
  const nodes: Node[] = data.stages.map((s, i) => ({
    id: `stage-${s.stage}`,
    type: "stage" as const,
    position: { x: i * X_GAP + 50, y: 100 },
    sourcePosition: Position.Right,
    targetPosition: Position.Left,
    data: { label: s.label, count: s.count, color: STAGE_COLORS[s.stage] ?? "#6b7280" },
  }));

  const edges: Edge[] = data.stages.slice(0, -1).map((s, i) => {
    const next = data.stages[i + 1];
    const conversionRate = s.count > 0 ? Math.round((next.count / s.count) * 100) : 0;
    return {
      id: `e-${s.stage}-${next.stage}`,
      source: `stage-${s.stage}`,
      target: `stage-${next.stage}`,
      label: `${conversionRate}%`,
      style: { stroke: "#94a3b8", strokeWidth: 2 },
      markerEnd: { type: MarkerType.ArrowClosed, color: "#94a3b8" },
      labelStyle: { fontSize: 10, fill: "#64748b" },
    };
  });

  return { nodes, edges };
}

type Props = { data: PipelineFlowData };

export function PipelineFlowCanvas({ data }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(
    () => buildPipelineGraph(data),
    [data],
  );
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  if (data.stages.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Geen pipeline data beschikbaar
      </div>
    );
  }

  return (
    <div className="h-full w-full">
      <ReactFlow
        nodes={nodes}
        edges={edges}
        onNodesChange={onNodesChange}
        onEdgesChange={onEdgesChange}
        nodeTypes={pipelineNodeTypes}
        fitView
        minZoom={0.5}
        maxZoom={1.5}
        nodesDraggable={false}
        nodesConnectable={false}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
      </ReactFlow>
    </div>
  );
}
