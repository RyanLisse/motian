"use client";

import { Check, ChevronRight, Pencil, Trash2, User, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useState } from "react";
import { cn } from "@/lib/utils";

export interface RecentAnalysis {
  id: string;
  name: string;
  role: string | null;
  resumeUrl: string | null;
  resumeParsedAt: Date | string;
}

interface RecentAnalysesProps {
  analyses: RecentAnalysis[];
  onSelect: (analysis: RecentAnalysis) => void;
  activeId?: string | null;
}

function timeAgo(date: Date | string): string {
  const d = new Date(date);
  const now = Date.now();
  const diff = now - d.getTime();

  const seconds = Math.floor(diff / 1000);
  const minutes = Math.floor(seconds / 60);
  const hours = Math.floor(minutes / 60);
  const days = Math.floor(hours / 24);

  if (seconds < 30) return "nu";
  if (minutes < 1) return `${seconds} sec geleden`;
  if (minutes < 60) return `${minutes} min geleden`;
  if (hours === 1) return "1 uur geleden";
  if (hours < 24) return `${hours} uur geleden`;
  if (days === 1) return "gisteren";
  if (days < 7) return `${days} dagen geleden`;
  if (days < 30) return `${Math.floor(days / 7)} weken geleden`;

  return d.toLocaleDateString("nl-NL", { day: "numeric", month: "short" });
}

function AnalysisRow({
  analysis,
  isActive,
  onSelect,
  onRemoved,
}: {
  analysis: RecentAnalysis;
  isActive: boolean;
  onSelect: () => void;
  onRemoved: () => void;
}) {
  const [editing, setEditing] = useState(false);
  const [editName, setEditName] = useState(analysis.name);
  const [busy, setBusy] = useState(false);

  const handleDelete = useCallback(
    async (e: React.MouseEvent) => {
      e.stopPropagation();
      if (!window.confirm(`CV van "${analysis.name}" verwijderen? Dit kan niet ongedaan worden.`))
        return;

      setBusy(true);
      try {
        const res = await fetch(`/api/candidates/${analysis.id}`, { method: "DELETE" });
        if (res.ok) onRemoved();
      } finally {
        setBusy(false);
      }
    },
    [analysis.id, analysis.name, onRemoved],
  );

  const handleEditStart = useCallback(
    (e: React.MouseEvent) => {
      e.stopPropagation();
      setEditName(analysis.name);
      setEditing(true);
    },
    [analysis.name],
  );

  const handleEditSave = useCallback(
    async (e?: React.MouseEvent | React.FormEvent) => {
      e?.stopPropagation();
      e?.preventDefault();
      const trimmed = editName.trim();
      if (!trimmed || trimmed === analysis.name) {
        setEditing(false);
        return;
      }

      setBusy(true);
      try {
        await fetch(`/api/candidates/${analysis.id}`, {
          method: "PATCH",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ name: trimmed }),
        });
        onRemoved(); // refresh list
      } finally {
        setBusy(false);
        setEditing(false);
      }
    },
    [analysis.id, analysis.name, editName, onRemoved],
  );

  const handleEditCancel = useCallback((e: React.MouseEvent) => {
    e.stopPropagation();
    setEditing(false);
  }, []);
  return (
    <button
      type="button"
      onClick={editing ? undefined : onSelect}
      onKeyDown={(e) => {
        if (!editing && (e.key === "Enter" || e.key === " ")) {
          e.preventDefault();
          onSelect();
        }
      }}
      className={cn(
        "group flex w-full items-center gap-3 rounded-lg border px-3 py-2.5 text-left transition-colors cursor-pointer",
        editing ? "" : "hover:bg-accent/50",
        isActive ? "border-primary bg-accent/30" : "border-transparent",
        busy && "opacity-50 pointer-events-none",
      )}
    >
      <div className="flex h-8 w-8 shrink-0 items-center justify-center rounded-full bg-muted">
        <User className="h-4 w-4 text-muted-foreground" />
      </div>

      <div className="min-w-0 flex-1">
        {editing ? (
          <form onSubmit={handleEditSave} className="flex items-center gap-1.5">
            <input
              type="text"
              value={editName}
              onChange={(e) => setEditName(e.target.value)}
              onClick={(e) => e.stopPropagation()}
              className="flex-1 min-w-0 bg-background border border-border rounded px-2 py-0.5 text-sm focus:outline-none focus:ring-1 focus:ring-primary"
            />
            <button
              type="submit"
              className="p-0.5 rounded hover:bg-green-500/10 text-green-600"
              aria-label="Opslaan"
            >
              <Check className="h-3.5 w-3.5" />
            </button>
            <button
              type="button"
              onClick={handleEditCancel}
              className="p-0.5 rounded hover:bg-muted text-muted-foreground"
              aria-label="Annuleren"
            >
              <X className="h-3.5 w-3.5" />
            </button>
          </form>
        ) : (
          <>
            <p className="truncate text-sm font-medium">
              {analysis.name}
              {analysis.role && (
                <span className="font-normal text-muted-foreground"> &mdash; {analysis.role}</span>
              )}
            </p>
            <p className="text-xs text-muted-foreground">{timeAgo(analysis.resumeParsedAt)}</p>
          </>
        )}
      </div>

      {!editing && (
        <div className="flex items-center gap-1 shrink-0">
          <button
            type="button"
            onClick={handleEditStart}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-accent transition-all"
            aria-label="Naam bewerken"
          >
            <Pencil className="h-3.5 w-3.5 text-muted-foreground" />
          </button>
          <button
            type="button"
            onClick={handleDelete}
            className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-destructive/10 transition-all"
            aria-label="Verwijderen"
          >
            <Trash2 className="h-3.5 w-3.5 text-destructive" />
          </button>
          <ChevronRight className="h-4 w-4 text-muted-foreground" />
        </div>
      )}
    </button>
  );
}

export function RecentAnalyses({ analyses, onSelect, activeId }: RecentAnalysesProps) {
  const router = useRouter();

  const handleRefresh = useCallback(() => {
    router.refresh();
  }, [router]);

  if (analyses.length === 0) {
    return (
      <div className="rounded-xl border border-border bg-card p-4">
        <h3 className="text-sm font-semibold mb-3">Recente analyses</h3>
        <p className="text-sm text-muted-foreground">Nog geen CV&apos;s geanalyseerd</p>
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-border bg-card p-4">
      <h3 className="text-sm font-semibold mb-3">Recente analyses</h3>
      <div className="max-h-[320px] overflow-y-auto -mx-1 px-1 space-y-1">
        {analyses.map((analysis) => (
          <AnalysisRow
            key={analysis.id}
            analysis={analysis}
            isActive={activeId === analysis.id}
            onSelect={() => onSelect(analysis)}
            onRemoved={handleRefresh}
          />
        ))}
      </div>
    </div>
  );
}
