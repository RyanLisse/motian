import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

const statusConfig: Record<string, { label: string; className: string }> = {
  success: {
    label: "Geslaagd",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  partial: {
    label: "Gedeeltelijk",
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  failed: {
    label: "Mislukt",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  gezond: {
    label: "Gezond",
    className: "bg-emerald-500/10 text-emerald-400 border-emerald-500/20",
  },
  waarschuwing: {
    label: "Waarschuwing",
    className: "bg-yellow-500/10 text-yellow-400 border-yellow-500/20",
  },
  kritiek: {
    label: "Kritiek",
    className: "bg-red-500/10 text-red-400 border-red-500/20",
  },
  inactief: {
    label: "Inactief",
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  },
};

interface StatusBadgeProps {
  status: string;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const config = statusConfig[status] ?? {
    label: status,
    className: "bg-zinc-500/10 text-zinc-400 border-zinc-500/20",
  };

  return (
    <Badge variant="outline" className={cn(config.className, className)}>
      {config.label}
    </Badge>
  );
}
