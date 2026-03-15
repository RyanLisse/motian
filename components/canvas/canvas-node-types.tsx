"use client";
import type { Node, NodeProps } from "@xyflow/react";
import { Briefcase, User } from "lucide-react";
import { memo } from "react";

// ── Node data types ──
export type KandidaatNodeData = {
  name: string;
  role: string | null;
  candidateId: string;
};

export type VacatureNodeData = {
  title: string;
  company: string | null;
  platform: string;
  jobId: string;
};

export type AppNode = Node<KandidaatNodeData, "kandidaat"> | Node<VacatureNodeData, "vacature">;

// ── Kandidaat Node ──
export const KandidaatNode = memo(function KandidaatNode({
  data,
}: NodeProps<Node<KandidaatNodeData>>) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm min-w-[160px] max-w-[200px]">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-emerald-500/10">
          <User className="h-3.5 w-3.5 text-emerald-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{data.name}</p>
          {data.role && <p className="text-[10px] text-muted-foreground truncate">{data.role}</p>}
        </div>
      </div>
    </div>
  );
});

// ── Vacature Node ──
export const VacatureNode = memo(function VacatureNode({
  data,
}: NodeProps<Node<VacatureNodeData>>) {
  return (
    <div className="rounded-lg border border-border bg-card p-3 shadow-sm min-w-[160px] max-w-[200px]">
      <div className="flex items-center gap-2">
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/10">
          <Briefcase className="h-3.5 w-3.5 text-blue-600" />
        </div>
        <div className="min-w-0">
          <p className="text-xs font-semibold text-foreground truncate">{data.title}</p>
          {data.company && (
            <p className="text-[10px] text-muted-foreground truncate">{data.company}</p>
          )}
        </div>
      </div>
    </div>
  );
});

// ── Node types registry (define outside component!) ──
export const canvasNodeTypes = {
  kandidaat: KandidaatNode,
  vacature: VacatureNode,
} as const;
