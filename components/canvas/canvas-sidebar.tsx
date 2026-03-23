"use client";
import { Briefcase, ExternalLink, User, X } from "lucide-react";
import Link from "next/link";

type CanvasSidebarProps = {
  type: "kandidaat" | "vacature" | null;
  id: string | null;
  name: string | null;
  subtitle: string | null;
  onClose: () => void;
};

export function CanvasSidebar({ type, id, name, subtitle, onClose }: CanvasSidebarProps) {
  if (!type || !id) return null;

  const href = type === "kandidaat" ? `/kandidaten/${id}` : `/vacatures/${id}`;
  const Icon = type === "kandidaat" ? User : Briefcase;

  return (
    <div className="absolute right-0 top-0 bottom-0 w-72 border-l border-border bg-card p-4 shadow-lg z-10">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Icon className="h-4 w-4 text-muted-foreground" />
          <span className="text-sm font-semibold">
            {type === "kandidaat" ? "Kandidaat" : "Vacature"}
          </span>
        </div>
        <button type="button" onClick={onClose} className="rounded p-1 hover:bg-muted">
          <X className="h-4 w-4" />
        </button>
      </div>
      {name && <p className="text-sm font-medium text-foreground">{name}</p>}
      {subtitle && <p className="text-xs text-muted-foreground mt-0.5">{subtitle}</p>}
      <Link
        href={href}
        className="mt-4 inline-flex items-center gap-1.5 text-xs text-primary hover:underline"
      >
        <ExternalLink className="h-3 w-3" />
        Open detailpagina
      </Link>
    </div>
  );
}
