"use client";
import {
  Background,
  Controls,
  type Edge,
  MarkerType,
  MiniMap,
  type Node,
  Position,
  ReactFlow,
  useEdgesState,
  useNodesState,
} from "@xyflow/react";
import { useCallback, useMemo } from "react";
import "@xyflow/react/dist/style.css";
import {
  canvasNodeTypes,
  type KandidaatNodeData,
  type VacatureNodeData,
} from "./canvas-node-types";

export type MatchNetworkData = {
  kandidaten: Array<{ id: string; name: string; role: string | null }>;
  vacatures: Array<{ id: string; title: string; company: string | null; platform: string }>;
  matches: Array<{ kandidaatId: string; vacatureId: string; score: number; status: string }>;
};

function scoreColor(score: number): string {
  if (score >= 80) return "#22c55e";
  if (score >= 60) return "#eab308";
  return "#ef4444";
}

function buildGraph(data: MatchNetworkData) {
  const Y_GAP = 100;
  const X_LEFT = 50;
  const X_RIGHT = 450;

  const nodes: Node[] = [
    ...data.kandidaten.map((k, i) => ({
      id: `k-${k.id}`,
      type: "kandidaat" as const,
      position: { x: X_LEFT, y: i * Y_GAP + 50 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: { name: k.name, role: k.role, candidateId: k.id } satisfies KandidaatNodeData,
    })),
    ...data.vacatures.map((v, i) => ({
      id: `v-${v.id}`,
      type: "vacature" as const,
      position: { x: X_RIGHT, y: i * Y_GAP + 50 },
      sourcePosition: Position.Right,
      targetPosition: Position.Left,
      data: {
        title: v.title,
        company: v.company,
        platform: v.platform,
        jobId: v.id,
      } satisfies VacatureNodeData,
    })),
  ];

  const edges: Edge[] = data.matches.map((m) => ({
    id: `e-${m.kandidaatId}-${m.vacatureId}`,
    source: `k-${m.kandidaatId}`,
    target: `v-${m.vacatureId}`,
    label: `${Math.round(m.score)}%`,
    style: {
      stroke: scoreColor(m.score),
      strokeWidth: Math.max(1, m.score / 30),
    },
    markerEnd: { type: MarkerType.ArrowClosed, color: scoreColor(m.score) },
    animated: m.score >= 80,
  }));

  return { nodes, edges };
}

type Props = {
  data: MatchNetworkData;
  onNodeClick?: (type: "kandidaat" | "vacature", id: string) => void;
};

export function MatchNetworkCanvas({ data, onNodeClick }: Props) {
  const { nodes: initialNodes, edges: initialEdges } = useMemo(() => buildGraph(data), [data]);
  const [nodes, , onNodesChange] = useNodesState(initialNodes);
  const [edges, , onEdgesChange] = useEdgesState(initialEdges);

  const handleNodeClick = useCallback(
    (_: React.MouseEvent, node: Node) => {
      if (!onNodeClick) return;
      if (node.type === "kandidaat") {
        onNodeClick("kandidaat", (node.data as KandidaatNodeData).candidateId);
      } else if (node.type === "vacature") {
        onNodeClick("vacature", (node.data as VacatureNodeData).jobId);
      }
    },
    [onNodeClick],
  );

  if (data.matches.length === 0) {
    return (
      <div className="flex h-full items-center justify-center text-sm text-muted-foreground">
        Geen matches om te visualiseren
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
        onNodeClick={handleNodeClick}
        nodeTypes={canvasNodeTypes}
        fitView
        minZoom={0.3}
        maxZoom={2}
        proOptions={{ hideAttribution: true }}
      >
        <Background gap={20} size={1} />
        <Controls showInteractive={false} />
        <MiniMap nodeStrokeWidth={3} zoomable pannable />
      </ReactFlow>
    </div>
  );
}
